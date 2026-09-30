// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {NabungGoalVault} from "../src/NabungGoalVault.sol";
import {AaveSupplyAdapter} from "../src/AaveSupplyAdapter.sol";
import {MockUSDC, MockAToken, MockAavePool} from "./mocks/MockAavePool.sol";
import {MockMessageTransport} from "./mocks/MockMessageTransport.sol";

contract CashOnlyGoalVaultTest is Test {
    MockUSDC internal usdc;
    MockAavePool internal pool;
    MockAToken internal receipt;
    MockMessageTransport internal transport;
    NabungGoalVault internal vault;
    address internal owner = address(0xBEEF);
    uint256 internal constant TARGET = 10_000e6;
    bytes32 internal constant GOAL = keccak256("cash-goal");
    bytes32 internal constant CONFIG = keccak256("cash-test-config");
    bytes32 internal constant COORDINATOR = keccak256("cash-test-coordinator");

    function setUp() public {
        usdc = new MockUSDC();
        pool = new MockAavePool(usdc);
        receipt = pool.receipt();
        transport = new MockMessageTransport();
        usdc.mint(owner, TARGET);
    }

    function _config(uint256 floor) internal view returns (NabungGoalVault.GoalConfig memory) {
        return NabungGoalVault.GoalConfig(owner, GOAL, CONFIG, TARGET, address(transport), COORDINATOR, floor);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(owner);
        vault.deposit(amount);
    }

    function _command(NabungGoalVault.MessageKind kind, uint64 round, uint64 sequence)
        internal
        view
        returns (NabungGoalVault.Command memory)
    {
        return NabungGoalVault.Command(
            GOAL,
            CONFIG,
            2,
            vault.vaultId(),
            round,
            sequence,
            kind,
            kind == NabungGoalVault.MessageKind.Commit ? vault.preparedAssets() : 0,
            kind == NabungGoalVault.MessageKind.Commit ? TARGET : 0
        );
    }

    function _deliver(NabungGoalVault.Command memory command) internal {
        transport.deliver(vault, 1, COORDINATOR, command);
    }

    function _prepare() internal {
        _deliver(
            _command(
                NabungGoalVault.MessageKind.Prepare, vault.currentRound() + 1, vault.commandSequence() + 1
            )
        );
    }

    function _commit() internal {
        _deliver(
            _command(NabungGoalVault.MessageKind.Commit, vault.currentRound(), vault.commandSequence() + 1)
        );
    }

    function testCashOnlyPreservesExactReservesAndPermanentAchievement() public {
        vault = new NabungGoalVault(_config(0), address(usdc), address(0), address(0));
        vm.prank(owner);
        usdc.approve(address(vault), TARGET);
        _deposit(TARGET - 1);
        assertFalse(vault.earningEnabled());
        assertEq(vault.totalAssets(), TARGET - 1);
        assertEq(vault.strategyReceiptBalance(), 0);
        assertEq(vault.claimableAssets(), 0);
        _prepare();
        vault.markReady();
        NabungGoalVault.Command memory belowTarget = _command(NabungGoalVault.MessageKind.Commit, 1, 2);
        belowTarget.aggregateReserved = TARGET - 1;
        vm.expectRevert(NabungGoalVault.TargetNotMet.selector);
        _deliver(belowTarget);
        _deliver(_command(NabungGoalVault.MessageKind.Abort, 1, 2));
        _deposit(1);
        _prepare();
        vault.markReady();
        _commit();
        vm.startPrank(owner);
        vault.claim(TARGET / 2);
        assertEq(uint8(vault.phase()), uint8(NabungGoalVault.Phase.Achieved));
        vault.claim(TARGET / 2);
        vm.stopPrank();
        assertEq(vault.claimedAssets(), TARGET);
        assertEq(vault.totalAssets(), 0);
    }

    function testCashOnlyCannotInvestOrRedeemAndKeepsCashOnFailure() public {
        vault = new NabungGoalVault(_config(0), address(usdc), address(0), address(0));
        vm.prank(owner);
        usdc.approve(address(vault), TARGET);
        _deposit(TARGET);
        vm.prank(owner);
        vm.expectRevert(AaveSupplyAdapter.StrategyDisabled.selector);
        vault.invest(1);
        vm.prank(owner);
        vm.expectRevert(AaveSupplyAdapter.StrategyDisabled.selector);
        vault.redeem(1, 0);
        assertEq(vault.totalAssets(), TARGET);
        assertEq(vault.depositedAssets(), TARGET);
        assertEq(usdc.allowance(address(vault), address(pool)), 0);
        vm.prank(owner);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.claim(1);
    }

    function testOnlyPairedZeroStrategyAddressesEnableCashOnly() public {
        vm.expectRevert(AaveSupplyAdapter.InvalidStrategy.selector);
        new NabungGoalVault(_config(0), address(usdc), address(pool), address(0));
        vm.expectRevert(AaveSupplyAdapter.InvalidStrategy.selector);
        new NabungGoalVault(_config(0), address(usdc), address(0), address(receipt));
    }
}
