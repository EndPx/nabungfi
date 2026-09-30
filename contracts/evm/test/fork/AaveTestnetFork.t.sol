// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IAaveReceipt, AaveSupplyAdapter} from "../../src/AaveSupplyAdapter.sol";
import {NabungGoalVault} from "../../src/NabungGoalVault.sol";
import {NabungLzRouter} from "../../src/NabungLzRouter.sol";
import {NabungVaultFactory} from "../../src/NabungVaultFactory.sol";
import {MockMessageTransport} from "../mocks/MockMessageTransport.sol";
import {DeployNabungFi} from "../../script/DeployNabungFi.s.sol";

/// @notice Independent LOCAL forks with both Circle USDC custody and legacy Aave test assets.
/// @dev RPC reads only. USDC deal, time warp, and injected coordinator commands are test facilities.
///      No funded public goal, live LayerZero delivery, or multi-peer aggregation is proved here.
abstract contract AaveTestnetForkTest is Test {
    bytes32 internal constant GOAL = keccak256("testnet-fork-goal");
    bytes32 internal constant CONFIG = keccak256("local-auth-injection-not-public-layerzero");
    bytes32 internal constant COORDINATOR = keccak256("local-fork-coordinator");
    uint256 internal constant DEPOSIT = 100e6;
    address internal constant OWNER = address(0xBEEF);

    NabungGoalVault internal vault;
    MockMessageTransport internal transport;
    IERC20 internal usdc;
    IAaveReceipt internal receipt;
    NabungLzRouter internal deployedRouter;
    NabungVaultFactory internal deployedFactory;
    address internal pool;
    uint256 internal forkBlock;
    bool internal forkEnabled;

    function network() internal pure virtual returns (string memory prefix, uint256 chainId);

    function setUp() public {
        forkEnabled = vm.envOr("RUN_EVM_TESTNET_FORKS", false);
        if (!forkEnabled) return;
        (string memory prefix, uint256 expectedChain) = network();
        forkBlock = vm.envUint(string.concat(prefix, "_FORK_BLOCK"));
        require(forkBlock != 0, "explicit fork block required");
        string memory forkRpc =
            vm.envOr(string.concat(prefix, "_FORK_RPC_URL"), vm.envString(string.concat(prefix, "_RPC_URL")));
        vm.createSelectFork(forkRpc, forkBlock);
        assertEq(block.chainid, expectedChain, "wrong RPC chain");
        usdc = IERC20(vm.envAddress(string.concat(prefix, "_LEGACY_AAVE_USDC")));
        pool = vm.envAddress(string.concat(prefix, "_LEGACY_AAVE_POOL"));
        receipt = IAaveReceipt(vm.envAddress(string.concat(prefix, "_LEGACY_AAVE_ATOKEN")));
        deployedRouter = NabungLzRouter(vm.envAddress(string.concat(prefix, "_LEGACY_ROUTER")));
        deployedFactory = NabungVaultFactory(vm.envAddress(string.concat(prefix, "_LEGACY_FACTORY")));
        transport = new MockMessageTransport();
    }

    function _newVault(uint256 target) internal {
        vault = new NabungGoalVault(
            NabungGoalVault.GoalConfig({
                owner: OWNER,
                goalId: GOAL,
                configHash: CONFIG,
                target: target,
                messenger: address(transport),
                sourceCoordinator: COORDINATOR,
                minimumIdle: 0
            }),
            address(usdc),
            pool,
            address(receipt)
        );
    }

    function _deposit(uint256 amount) internal {
        deal(address(usdc), OWNER, amount);
        vm.startPrank(OWNER);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function _supply() internal {
        _deposit(DEPOSIT);
        vm.prank(OWNER);
        vault.invest(DEPOSIT);
        (bool ok, bytes memory accountData) =
            pool.staticcall(abi.encodeWithSignature("getUserAccountData(address)", address(vault)));
        assertTrue(ok);
        (, uint256 totalDebtBase,,,,) =
            abi.decode(accountData, (uint256, uint256, uint256, uint256, uint256, uint256));
        assertEq(totalDebtBase, 0, "supply-only vault never borrows");
    }

    function _command(NabungGoalVault.MessageKind kind, uint64 round, uint64 sequence) internal {
        transport.deliver(vault, 1, COORDINATOR, _commandData(kind, round, sequence));
    }

    function _commandData(NabungGoalVault.MessageKind kind, uint64 round, uint64 sequence)
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
            round: round,
            sequence: sequence,
            messageKind: kind,
            preparedAssets: prepared,
            aggregateReserved: prepared
        });
    }

    function _rejectShortCommit(uint64 round, uint64 sequence) internal {
        NabungGoalVault.Command memory command =
            _commandData(NabungGoalVault.MessageKind.Commit, round, sequence);
        vm.expectRevert(NabungGoalVault.TargetNotMet.selector);
        transport.deliver(vault, 1, COORDINATOR, command);
    }

    function testForkLegacyDeploymentAndAaveUSDCConfiguration() public {
        vm.skip(!forkEnabled);
        (string memory prefix,) = network();
        assertGt(address(deployedRouter).code.length, 0);
        assertGt(address(deployedFactory).code.length, 0);
        assertEq(address(deployedRouter.endpoint()), vm.envAddress(string.concat(prefix, "_ENDPOINT")));
        assertEq(address(deployedRouter.factory()), address(deployedFactory));
        assertEq(deployedFactory.router(), address(deployedRouter));
        assertEq(deployedFactory.asset(), address(usdc));
        assertEq(deployedFactory.pool(), pool);
        assertEq(deployedFactory.receipt(), address(receipt));
        assertEq(receipt.UNDERLYING_ASSET_ADDRESS(), address(usdc));
        assertEq(receipt.POOL(), pool);
        assertEq(IERC20Metadata(address(usdc)).decimals(), 6);
        assertEq(IERC20Metadata(address(usdc)).symbol(), "USDC");
        assertEq(deployedRouter.peers(deployedRouter.solanaEid()), deployedRouter.solanaOApp());
        assertEq(deployedFactory.creationNonce(), 1, "snapshot deployment has zero goals");
        assertFalse(deployedRouter.routeSealed(), "staging route must remain unsealed");
        vm.expectRevert(NabungLzRouter.RouteNotSealed.selector);
        deployedRouter.createGoal(
            NabungVaultFactory.GoalRequest(GOAL, bytes32(uint256(1)), COORDINATOR, 100e6, 0)
        );
        emit log_named_uint("fork_block", forkBlock);
        emit log_named_address("actual_Aave_USDC", address(usdc));
    }

    function testForkCanonicalCircleUSDCCashCustodyAndGoalClaim() public {
        vm.skip(!forkEnabled);
        (string memory prefix, uint256 chainId) = network();
        address canonical = vm.envAddress(string.concat(prefix, "_USDC"));
        if (chainId == 421614) {
            assertEq(canonical, address(usdc), "Arbitrum Aave underlying is Circle USDC");
        } else {
            assertNotEq(canonical, address(usdc), "legacy Aave test token is not Circle USDC");
        }
        usdc = IERC20(canonical);
        pool = address(0);
        receipt = IAaveReceipt(address(0));
        assertGt(canonical.code.length, 0);
        assertEq(IERC20Metadata(canonical).decimals(), 6);
        assertEq(IERC20Metadata(canonical).symbol(), "USDC");
        _newVault(DEPOSIT);
        assertFalse(vault.earningEnabled(), "cash-only vault must not claim yield");
        _deposit(DEPOSIT - 1);
        assertEq(vault.totalAssets(), DEPOSIT - 1);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT - 1);
        NabungGoalVault.Report memory progress = vault.reportProgress();
        assertEq(progress.amount, DEPOSIT - 1);
        assertEq(vault.claimableAssets(), 0);
        vm.startPrank(OWNER);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.claim(1);
        vm.stopPrank();
        _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        vault.markReady();
        _rejectShortCommit(1, 2);
        _command(NabungGoalVault.MessageKind.Abort, 1, 2);
        _deposit(1);
        _command(NabungGoalVault.MessageKind.Prepare, 2, 3);
        vault.markReady();
        _command(NabungGoalVault.MessageKind.Commit, 2, 4);
        vm.prank(OWNER);
        vault.claim(DEPOSIT);
        assertEq(usdc.balanceOf(OWNER), DEPOSIT);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(vault.claimedAssets(), DEPOSIT);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
        emit log_named_address("canonical_Circle_USDC", canonical);
    }

    function testForkActualDeploymentScriptReadsEnvironmentAndCreatesUnsealedRouter() public {
        vm.skip(!forkEnabled);
        (string memory prefix, uint256 chainId) = network();
        address administrator = vm.envAddress("DEPLOYER_ADDRESS");
        uint64 expectedNonce = uint64(vm.envUint(string.concat(prefix, "_EXPECTED_DEPLOYER_NONCE")));
        assertEq(vm.getNonce(administrator), expectedNonce, "snapshot must match configured deployer nonce");
        address expectedRouter = vm.computeCreateAddress(administrator, expectedNonce);
        string memory previousChain = vm.envString("TESTNET_CHAIN_ID");
        vm.setEnv("TESTNET_CHAIN_ID", vm.toString(chainId));
        // Actual run/loadConfig paths, actual public Endpoint and canonical Circle token contracts.
        // startBroadcast records/simulates only inside forge test; no RPC write/signing is performed.
        NabungLzRouter router = new DeployNabungFi().run();
        vm.setEnv("TESTNET_CHAIN_ID", previousChain);
        NabungVaultFactory factory = router.factory();
        assertEq(address(router), expectedRouter);
        assertEq(vm.getNonce(administrator), expectedNonce + 1);
        assertEq(router.owner(), administrator);
        assertEq(address(router.endpoint()), vm.envAddress(string.concat(prefix, "_ENDPOINT")));
        assertEq(router.solanaEid(), vm.envUint("SOLANA_DEVNET_EID"));
        assertEq(router.solanaOApp(), vm.envBytes32("SOLANA_DEVNET_STORE"));
        assertEq(router.peers(router.solanaEid()), vm.envBytes32("SOLANA_DEVNET_STORE"));
        assertEq(factory.router(), address(router));
        assertEq(factory.asset(), vm.envAddress(string.concat(prefix, "_USDC")));
        assertEq(factory.pool(), vm.envAddress(string.concat(prefix, "_AAVE_POOL")));
        assertEq(factory.receipt(), vm.envAddress(string.concat(prefix, "_ATOKEN")));
        assertEq(factory.creationNonce(), 1);
        assertFalse(router.routeSealed());
        assertEq(IERC20Metadata(factory.asset()).decimals(), 6);
        bool cashOnly = vm.envBool(string.concat(prefix, "_CASH_ONLY"));
        assertEq(cashOnly, chainId != 421614, "reviewed network earning availability");
        assertEq(factory.pool() == address(0) && factory.receipt() == address(0), cashOnly);
        (bool ok, bytes memory delegateData) = address(router.endpoint())
            .staticcall(abi.encodeWithSignature("delegates(address)", address(router)));
        assertTrue(ok);
        assertEq(abi.decode(delegateData, (address)), administrator);
        emit log_named_address("LOCAL_ONLY_script_router", address(router));
        emit log_named_address("LOCAL_ONLY_script_factory", address(factory));
    }
}

abstract contract AaveSupplyingTestnetForkTest is AaveTestnetForkTest {
    function testForkRoundtripAndExactOneUnitShortDoesNotUnlock() public {
        vm.skip(!forkEnabled);
        _newVault(200e6);
        _supply();
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(receipt.balanceOf(OWNER), 0);
        assertEq(vault.totalAssets(), receipt.balanceOf(address(vault)));
        assertEq(vault.depositedAssets(), DEPOSIT);
        assertEq(usdc.allowance(address(vault), pool), 0);
        NabungGoalVault.Report memory progress = vault.reportProgress();
        assertEq(progress.amount, receipt.balanceOf(address(vault)));
        assertEq(vault.claimableAssets(), 0, "progress is not a reserve commitment");
        vm.startPrank(OWNER);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.claim(1);
        vm.stopPrank();

        _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        vm.expectRevert(NabungGoalVault.PositionNotRedeemed.selector);
        vault.markReady();
        uint256 positionBefore = receipt.balanceOf(address(vault));
        vm.expectPartialRevert(AaveSupplyAdapter.MinimumReceivedNotMet.selector);
        vault.redeem(type(uint256).max, type(uint256).max);
        assertEq(receipt.balanceOf(address(vault)), positionBefore, "minimum-output revert is atomic");
        uint256 realized = vault.redeem(type(uint256).max, 0);
        assertEq(usdc.balanceOf(address(vault)), realized);
        assertEq(receipt.balanceOf(address(vault)), 0);
        assertEq(vault.totalAssets(), realized, "receipt must not be counted twice");
        vault.markReady();
        assertEq(vault.preparedAssets(), realized);
        _rejectShortCommit(1, 2);

        // Use the measured roundtrip, not an assumed shared dust tolerance across markets.
        assertLt(realized, vault.target() - 1);
        _command(NabungGoalVault.MessageKind.Abort, 1, 2);
        _deposit(vault.target() - realized - 1);
        _command(NabungGoalVault.MessageKind.Prepare, 2, 3);
        vault.markReady();
        assertEq(vault.preparedAssets(), vault.target() - 1);
        _rejectShortCommit(2, 4);
        assertEq(vault.claimableAssets(), 0);
        assertEq(vault.commandSequence(), 3, "failed commit must remain retryable");
        emit log_named_uint("immediate_roundtrip_USDC_raw", realized);
        emit log_named_uint("exact_deficit_USDC_raw", 1);
    }

    function testForkAccrualRealizationAndPartialFullClaimConservation() public {
        vm.skip(!forkEnabled);
        _newVault(100e6);
        _supply();
        uint256 beforeAccrual = vault.totalAssets();
        vm.warp(block.timestamp + 1 days);
        assertGt(vault.totalAssets(), beforeAccrual, "aToken accrues using snapshot rate and simulated time");
        assertEq(vault.claimableAssets(), 0);
        _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        uint256 realized = vault.redeem(type(uint256).max, DEPOSIT);
        assertGt(realized, DEPOSIT);
        vault.markReady();
        _command(NabungGoalVault.MessageKind.Commit, 1, 2);
        assertEq(vault.preparedAssets(), realized);
        uint256 firstClaim = realized / 3;
        vm.prank(OWNER);
        vault.claim(firstClaim);
        assertEq(usdc.balanceOf(OWNER) + usdc.balanceOf(address(vault)), realized);
        assertEq(vault.claimableAssets(), realized - firstClaim);
        vm.prank(OWNER);
        vault.claim(realized - firstClaim);
        assertEq(usdc.balanceOf(OWNER), realized);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(receipt.balanceOf(address(vault)), 0);
        assertEq(vault.claimedAssets(), realized);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
        emit log_named_uint("simulated_one_day_realized_USDC_raw", realized);
    }
}

contract AaveBaseSepoliaForkTest is AaveSupplyingTestnetForkTest {
    function network() internal pure override returns (string memory, uint256) {
        return ("BASE_SEPOLIA", 84532);
    }
}

contract AaveArbitrumSepoliaForkTest is AaveSupplyingTestnetForkTest {
    function network() internal pure override returns (string memory, uint256) {
        return ("ARBITRUM_SEPOLIA", 421614);
    }
}

contract AaveEthereumSepoliaForkTest is AaveTestnetForkTest {
    function network() internal pure override returns (string memory, uint256) {
        return ("ETHEREUM_SEPOLIA", 11155111);
    }

    function testForkSupplyCapFailurePreservesIdleUSDCAndIsRetryable() public {
        vm.skip(!forkEnabled);
        _newVault(DEPOSIT);
        _deposit(DEPOSIT);
        // Actual Sepolia market is over its cap at this snapshot. Never change protocol storage.
        (bool configOk, bytes memory encoded) =
            pool.staticcall(abi.encodeWithSignature("getConfiguration(address)", address(usdc)));
        assertTrue(configOk);
        uint256 supplyCap = (abi.decode(encoded, (uint256)) >> 116) & ((uint256(1) << 36) - 1);
        assertGt(supplyCap, 0);
        assertGt(receipt.totalSupply(), supplyCap * 1e6);
        vm.startPrank(OWNER);
        vm.expectRevert(bytes("51")); // Aave V3 SUPPLY_CAP_EXCEEDED.
        vault.invest(DEPOSIT);
        vm.expectRevert(bytes("51"));
        vault.invest(1);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.claim(1);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT);
        assertEq(receipt.balanceOf(address(vault)), 0);
        assertEq(vault.totalAssets(), DEPOSIT);
        assertEq(vault.depositedAssets(), DEPOSIT);
        assertEq(usdc.allowance(address(vault), pool), 0, "failed supply rolls approval back");
        assertEq(vault.claimableAssets(), 0);
        emit log_named_uint("actual_market_supply_cap_USDC", supplyCap);
        emit log_named_uint("actual_market_receipt_total_supply_raw", receipt.totalSupply());
    }

    function testForkCashOnlyCompletionAndClaimWhenStrategyIsUnavailable() public {
        vm.skip(!forkEnabled);
        _newVault(DEPOSIT);
        _deposit(DEPOSIT - 1);
        _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        vault.markReady();
        _rejectShortCommit(1, 2);
        _command(NabungGoalVault.MessageKind.Abort, 1, 2);
        _deposit(1);
        _command(NabungGoalVault.MessageKind.Prepare, 2, 3);
        vault.markReady();
        _command(NabungGoalVault.MessageKind.Commit, 2, 4);
        vm.prank(OWNER);
        vault.claim(DEPOSIT);
        assertEq(usdc.balanceOf(OWNER), DEPOSIT);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(receipt.balanceOf(address(vault)), 0);
        assertEq(vault.claimedAssets(), DEPOSIT);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
    }
}
