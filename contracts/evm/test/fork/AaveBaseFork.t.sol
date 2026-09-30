// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NabungGoalVault} from "../../src/NabungGoalVault.sol";
import {MockMessageTransport} from "../mocks/MockMessageTransport.sol";

/// @notice LOCAL fork execution against actual Aave V3/Base USDC bytecode and storage.
/// @dev RPC is read-only. deal/prank and a mock message transport are local test facilities.
///      No wallet is signed, no transaction broadcast, no real interest earned by this test.
contract AaveBaseForkTest is Test {
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address internal constant A_TOKEN = 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB;
    uint256 internal constant SNAPSHOT_BLOCK = 51_893_120;
    bytes32 internal constant GOAL = keccak256("fork-goal");
    bytes32 internal constant CONFIG = keccak256("fork-config-no-real-transport");
    bytes32 internal constant COORDINATOR = keccak256("fork-coordinator-mock");

    NabungGoalVault internal vault;
    MockMessageTransport internal transport;
    address internal owner = address(0xBEEF);
    bool internal forkEnabled;

    function setUp() public {
        // Default suite reports this test as SKIPPED, not falsely passed, without RPC opt-in.
        forkEnabled = vm.envOr("RUN_BASE_FORK", false);
        if (!forkEnabled) return;
        vm.createSelectFork(
            vm.envOr("BASE_RPC_URL", string("https://base-rpc.publicnode.com")), SNAPSHOT_BLOCK
        );
        assertEq(block.chainid, 8453, "Base mainnet chain ID");
        transport = new MockMessageTransport();
        vault = new NabungGoalVault(
            NabungGoalVault.GoalConfig({
                owner: owner,
                goalId: GOAL,
                configHash: CONFIG,
                target: 100e6,
                messenger: address(transport),
                sourceCoordinator: COORDINATOR,
                minimumIdle: 0
            }),
            USDC,
            POOL,
            A_TOKEN
        );
        // Creates artificial USDC only in this isolated fork's storage.
        deal(USDC, owner, 100e6);
        vm.startPrank(owner);
        IERC20(USDC).approve(address(vault), 100e6);
        vault.deposit(100e6);
        vault.invest(100e6);
        vm.stopPrank();
    }

    function _command(NabungGoalVault.MessageKind kind, uint64 sequence)
        internal
        view
        returns (NabungGoalVault.Command memory)
    {
        uint256 prepared = kind == NabungGoalVault.MessageKind.Commit ? vault.preparedAssets() : 0;
        return NabungGoalVault.Command({
            goalId: GOAL,
            configHash: CONFIG,
            destinationChain: 2,
            destinationVault: vault.vaultId(),
            round: 1,
            sequence: sequence,
            messageKind: kind,
            preparedAssets: prepared,
            aggregateReserved: prepared
        });
    }

    function testForkRealAaveSupplyRedeemMeasuresRounding() public {
        vm.skip(!forkEnabled);
        assertEq(IERC20(USDC).balanceOf(address(vault)), 0);
        // This fixed reserve snapshot rounds scaled balances down by two raw USDC units.
        assertEq(IERC20(A_TOKEN).balanceOf(address(vault)), 100e6 - 2);
        assertEq(IERC20(A_TOKEN).balanceOf(owner), 0);
        assertEq(IERC20(USDC).allowance(address(vault), POOL), 0);
        assertEq(vault.claimableAssets(), 0);
        transport.deliver(vault, 1, COORDINATOR, _command(NabungGoalVault.MessageKind.Prepare, 1));
        uint256 realized = vault.redeem(type(uint256).max, 100e6 - 2);
        assertEq(realized, 100e6 - 2);
        assertEq(IERC20(A_TOKEN).balanceOf(address(vault)), 0);
        vault.markReady();
        assertEq(vault.preparedAssets(), IERC20(USDC).balanceOf(address(vault)));
        NabungGoalVault.Command memory insufficient = _command(NabungGoalVault.MessageKind.Commit, 2);
        vm.expectRevert(NabungGoalVault.TargetNotMet.selector);
        transport.deliver(vault, 1, COORDINATOR, insufficient);
        assertEq(vault.claimableAssets(), 0);
        emit log_named_uint("immediate_roundtrip_USDC_raw", realized);

        // Exact accounting: no epsilon unlock. Abort the frozen Ready round and fund the deficit.
        transport.deliver(vault, 1, COORDINATOR, _command(NabungGoalVault.MessageKind.Abort, 2));
        deal(USDC, owner, 2);
        vm.startPrank(owner);
        IERC20(USDC).approve(address(vault), 2);
        vault.deposit(2);
        vm.stopPrank();
        NabungGoalVault.Command memory next = _command(NabungGoalVault.MessageKind.Prepare, 3);
        next.round = 2;
        transport.deliver(vault, 1, COORDINATOR, next);
        vault.markReady();
        assertEq(vault.preparedAssets(), 100e6);
        next = _command(NabungGoalVault.MessageKind.Commit, 4);
        next.round = 2;
        transport.deliver(vault, 1, COORDINATOR, next);
        assertEq(vault.claimableAssets(), 100e6);
    }

    function testForkRealAaveAccrualThenLocalCompletionAndClaim() public {
        vm.skip(!forkEnabled);
        uint256 before = vault.totalAssets();
        vm.warp(block.timestamp + 1 days);
        uint256 afterAccrual = vault.totalAssets();
        assertGt(afterAccrual, before, "real aToken view accrues from fork rate and simulated time");
        transport.deliver(vault, 1, COORDINATOR, _command(NabungGoalVault.MessageKind.Prepare, 1));
        uint256 realized = vault.redeem(type(uint256).max, 100e6);
        assertGt(realized, 100e6);
        vault.markReady();
        transport.deliver(vault, 1, COORDINATOR, _command(NabungGoalVault.MessageKind.Commit, 2));
        vm.prank(owner);
        vault.claim(realized);
        assertEq(IERC20(USDC).balanceOf(owner), realized);
        assertEq(IERC20(USDC).balanceOf(address(vault)), 0);
        assertEq(IERC20(A_TOKEN).balanceOf(address(vault)), 0);
        assertEq(vault.claimedAssets(), realized);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
        emit log_named_uint("fork_block", SNAPSHOT_BLOCK);
        emit log_named_uint("simulated_one_day_realized_USDC_raw", realized);
    }
}
