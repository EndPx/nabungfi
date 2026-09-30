// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {NabungGoalVault} from "../src/NabungGoalVault.sol";
import {AaveSupplyAdapter} from "../src/AaveSupplyAdapter.sol";
import {MockUSDC, MockAToken, MockAavePool} from "./mocks/MockAavePool.sol";
import {MockMessageTransport} from "./mocks/MockMessageTransport.sol";

contract NabungGoalVaultTest is Test {
    MockUSDC internal usdc;
    MockAavePool internal pool;
    MockAToken internal receipt;
    MockMessageTransport internal transport;
    NabungGoalVault internal vault;
    address internal owner = address(0xBEEF);
    address internal stranger = address(0xBAD);
    bytes32 internal constant GOAL = keccak256("goal-1");
    bytes32 internal constant CONFIG = keccak256("test-only-config-1");
    bytes32 internal constant COORDINATOR = keccak256("test-only-solana-coordinator");
    uint256 internal constant TARGET = 10_000e6;

    function setUp() public {
        usdc = new MockUSDC();
        pool = new MockAavePool(usdc);
        receipt = pool.receipt();
        transport = new MockMessageTransport();
        vault = _newVault(0);
        usdc.mint(owner, 1_000_000e6);
        vm.prank(owner);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _config(uint256 minimumIdle) internal view returns (NabungGoalVault.GoalConfig memory) {
        return NabungGoalVault.GoalConfig({
            owner: owner,
            goalId: GOAL,
            configHash: CONFIG,
            target: TARGET,
            messenger: address(transport),
            sourceCoordinator: COORDINATOR,
            minimumIdle: minimumIdle
        });
    }

    function _newVault(uint256 minimumIdle) internal returns (NabungGoalVault) {
        return new NabungGoalVault(_config(minimumIdle), address(usdc), address(pool), address(receipt));
    }

    function _deposit(uint256 amount) internal {
        vm.prank(owner);
        vault.deposit(amount);
    }

    function _invest(uint256 amount) internal {
        vm.prank(owner);
        vault.invest(amount);
    }

    function _command(NabungGoalVault.MessageKind kind, uint64 round, uint64 sequence)
        internal
        view
        returns (NabungGoalVault.Command memory)
    {
        return NabungGoalVault.Command({
            goalId: GOAL,
            configHash: CONFIG,
            destinationChain: 2,
            destinationVault: vault.vaultId(),
            round: round,
            sequence: sequence,
            messageKind: kind,
            preparedAssets: kind == NabungGoalVault.MessageKind.Commit ? vault.preparedAssets() : 0,
            aggregateReserved: kind == NabungGoalVault.MessageKind.Commit ? TARGET : 0
        });
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

    function testConstructorRejectsZeroOwnerTargetAndEOAMessenger() public {
        NabungGoalVault.GoalConfig memory config = _config(0);
        config.owner = address(0);
        vm.expectRevert(NabungGoalVault.InvalidConfiguration.selector);
        new NabungGoalVault(config, address(usdc), address(pool), address(receipt));
        config = _config(0);
        config.target = 0;
        vm.expectRevert(NabungGoalVault.InvalidConfiguration.selector);
        new NabungGoalVault(config, address(usdc), address(pool), address(receipt));
        config = _config(0);
        config.messenger = stranger;
        vm.expectRevert(NabungGoalVault.InvalidConfiguration.selector);
        new NabungGoalVault(config, address(usdc), address(pool), address(receipt));
    }

    function testConstructorRejectsWrongAaveReceipt() public {
        MockAavePool other = new MockAavePool(usdc);
        address otherReceipt = address(other.receipt());
        NabungGoalVault.GoalConfig memory config = _config(0);
        vm.expectRevert(AaveSupplyAdapter.InvalidStrategy.selector);
        new NabungGoalVault(config, address(usdc), address(pool), otherReceipt);
    }

    function testOnlyOwnerCanDepositInvestOrClaim() public {
        vm.startPrank(stranger);
        vm.expectRevert(NabungGoalVault.Unauthorized.selector);
        vault.deposit(100e6);
        vm.expectRevert(NabungGoalVault.Unauthorized.selector);
        vault.invest(100e6);
        vm.expectRevert(NabungGoalVault.Unauthorized.selector);
        vault.claim(100e6);
        vm.stopPrank();
    }

    function testPrincipalAndReceiptRemainOwnedByVault() public {
        _deposit(1_000e6);
        _invest(900e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
        assertEq(receipt.balanceOf(address(vault)), 900e6);
        assertEq(receipt.balanceOf(owner), 0);
        assertEq(usdc.allowance(address(vault), address(pool)), 0);
        assertEq(vault.totalAssets(), 1_000e6);
        assertEq(vault.depositedAssets(), 1_000e6);
        assertEq(vault.claimableAssets(), 0);
    }

    function testIdleFloorCannotBeInvested() public {
        vault = _newVault(100e6);
        vm.prank(owner);
        usdc.approve(address(vault), type(uint256).max);
        _deposit(1_000e6);
        vm.prank(owner);
        vm.expectRevert(NabungGoalVault.IdleFloorViolated.selector);
        vault.invest(901e6);
        _invest(900e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
    }

    function testInterestAndRecognizedLossDoNotDoubleCountPrincipal() public {
        _deposit(1_000e6);
        _invest(800e6);
        pool.accrue(address(vault), 50e6);
        assertEq(vault.totalAssets(), 1_050e6);
        assertEq(vault.depositedAssets(), 1_000e6);
        pool.recognizeLoss(address(vault), 200e6);
        assertEq(vault.totalAssets(), 850e6);
        assertEq(vault.claimableAssets(), 0);
    }

    function testNoDeadlineOrOwnerEarlyWithdrawalEscape() public {
        _deposit(1_000e6);
        vm.warp(block.timestamp + 100 * 365 days);
        vm.prank(owner);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.claim(1e6);
        assertEq(vault.claimableAssets(), 0);
    }

    function testOwnerCanRecallIntoStillLockedCash() public {
        _deposit(1_000e6);
        _invest(1_000e6);
        vm.prank(stranger);
        vm.expectRevert(NabungGoalVault.Unauthorized.selector);
        vault.redeem(100e6, 100e6);
        vm.prank(owner);
        vault.redeem(100e6, 100e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
        assertEq(vault.totalAssets(), 1_000e6);
        assertEq(vault.claimableAssets(), 0);
    }

    function testIlliquidityDoesNotErasePreparationOrMakeReady() public {
        _deposit(1_000e6);
        _invest(1_000e6);
        _prepare();
        pool.setAvailableLiquidity(0);
        vm.expectRevert(MockAavePool.Illiquid.selector);
        vault.redeem(type(uint256).max, 0);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Preparing));
        vm.expectRevert(NabungGoalVault.PositionNotRedeemed.selector);
        vault.markReady();
        assertEq(vault.preparedAssets(), 0);
        pool.setAvailableLiquidity(1_000e6);
        vault.redeem(type(uint256).max, 1_000e6);
        vault.markReady();
        assertEq(vault.preparedAssets(), 1_000e6);
    }

    function testPartialExitThenRemainingExitRequiresAllReceiptsRedeemed() public {
        _deposit(1_000e6);
        _invest(1_000e6);
        _prepare();
        pool.setAvailableLiquidity(300e6);
        vault.redeem(300e6, 300e6);
        vm.expectRevert(NabungGoalVault.PositionNotRedeemed.selector);
        vault.markReady();
        assertEq(receipt.balanceOf(address(vault)), 700e6);
        pool.setAvailableLiquidity(700e6);
        vault.redeem(type(uint256).max, 700e6);
        vault.markReady();
        assertEq(vault.preparedAssets(), 1_000e6);
    }

    function testMinimumReceivedFailureRollsBackRedemption() public {
        _deposit(1_000e6);
        _invest(1_000e6);
        _prepare();
        pool.setExitShortfall(10e6);
        vm.expectRevert(
            abi.encodeWithSelector(AaveSupplyAdapter.MinimumReceivedNotMet.selector, 990e6, 1_000e6)
        );
        vault.redeem(type(uint256).max, 1_000e6);
        assertEq(receipt.balanceOf(address(vault)), 1_000e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
        vault.redeem(type(uint256).max, 990e6);
        vault.markReady();
        assertEq(vault.preparedAssets(), 990e6);
    }

    function testPreparingTopUpStaysCashReadyTopUpIsRejected() public {
        _deposit(1_000e6);
        _prepare();
        _deposit(100e6);
        vm.prank(owner);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.invest(100e6);
        vault.markReady();
        assertEq(vault.preparedAssets(), 1_100e6);
        vm.prank(owner);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.deposit(100e6);
    }

    function testReadyReserveCannotBeInvestedOrClaimed() public {
        _deposit(1_000e6);
        _prepare();
        vault.markReady();
        vm.startPrank(owner);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.invest(1e6);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        vault.claim(1e6);
        vm.stopPrank();
        assertEq(vault.preparedAssets(), usdc.balanceOf(address(vault)));
    }

    function testNonMessengerCannotSpoofCoordinator() public {
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        vm.expectRevert(NabungGoalVault.Unauthorized.selector);
        vault.receiveCommand(1, COORDINATOR, command);
    }

    function testWrongRemoteChainOrCoordinatorRejected() public {
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        vm.expectRevert(NabungGoalVault.WrongPeer.selector);
        transport.deliver(vault, 2, COORDINATOR, command);
        vm.expectRevert(NabungGoalVault.WrongPeer.selector);
        transport.deliver(vault, 1, bytes32(uint256(99)), command);
        assertEq(vault.commandSequence(), 0);
    }

    function testWrongGoalConfigurationAndDestinationRejected() public {
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Prepare, 1, 1);
        command.goalId = bytes32(uint256(7));
        vm.expectRevert(NabungGoalVault.WrongGoal.selector);
        _deliver(command);
        command.goalId = GOAL;
        command.configHash = bytes32(uint256(8));
        vm.expectRevert(NabungGoalVault.WrongGoal.selector);
        _deliver(command);
        command.configHash = CONFIG;
        command.destinationVault = bytes32(uint256(9));
        vm.expectRevert(NabungGoalVault.WrongDestination.selector);
        _deliver(command);
        command.destinationVault = vault.vaultId();
        command.destinationChain = 1;
        vm.expectRevert(NabungGoalVault.WrongDestination.selector);
        _deliver(command);
    }

    function testOutOfOrderAndDuplicateCommandsDoNotConsumeSequence() public {
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Prepare, 1, 2);
        vm.expectRevert(abi.encodeWithSelector(NabungGoalVault.WrongSequence.selector, uint64(1), uint64(2)));
        _deliver(command);
        assertEq(vault.commandSequence(), 0);
        command.sequence = 1;
        _deliver(command);
        vm.expectRevert(abi.encodeWithSelector(NabungGoalVault.WrongSequence.selector, uint64(2), uint64(1)));
        _deliver(command);
        assertEq(vault.commandSequence(), 1);
    }

    function testInvalidMessageKindCannotBeInterpretedAsAbort() public {
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Invalid, 1, 1);
        vm.expectRevert(NabungGoalVault.InvalidMessageKind.selector);
        _deliver(command);
        assertEq(vault.commandSequence(), 0);
        assertEq(vault.currentRound(), 0);
    }

    function testCommitRequiresReadyMatchingReserveAndSufficientAggregate() public {
        _deposit(1_000e6);
        _prepare();
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Commit, 1, 2);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        _deliver(command);
        vault.markReady();
        command.preparedAssets = 999e6;
        vm.expectRevert(NabungGoalVault.ReserveMismatch.selector);
        _deliver(command);
        command.preparedAssets = 1_000e6;
        command.aggregateReserved = TARGET - 1;
        vm.expectRevert(NabungGoalVault.TargetNotMet.selector);
        _deliver(command);
        assertEq(vault.claimableAssets(), 0);
        command.aggregateReserved = TARGET;
        _deliver(command);
        assertEq(vault.claimableAssets(), 1_000e6);
    }

    function testReserveLossAfterReadyPreventsCommit() public {
        _deposit(1_000e6);
        _prepare();
        vault.markReady();
        usdc.burn(address(vault), 1);
        NabungGoalVault.Command memory command = _command(NabungGoalVault.MessageKind.Commit, 1, 2);
        vm.expectRevert(NabungGoalVault.ReserveMismatch.selector);
        _deliver(command);
        assertEq(vault.claimableAssets(), 0);
    }

    function testAbortConsumesRoundAndOldCommitCannotRelease() public {
        _deposit(1_000e6);
        _prepare();
        vault.markReady();
        _deliver(_command(NabungGoalVault.MessageKind.Abort, 1, 2));
        assertEq(uint256(vault.roundOutcome(1)), uint256(NabungGoalVault.RoundOutcome.Aborted));
        assertEq(vault.reportSequence(), 2); // Ready followed by AbortAck.
        assertEq(vault.preparedAssets(), 0);
        NabungGoalVault.Command memory stale = _command(NabungGoalVault.MessageKind.Commit, 1, 3);
        vm.expectRevert(NabungGoalVault.WrongRound.selector);
        _deliver(stale);
        NabungGoalVault.Command memory reuse = _command(NabungGoalVault.MessageKind.Prepare, 1, 3);
        vm.expectRevert(NabungGoalVault.WrongRound.selector);
        _deliver(reuse);
        _invest(500e6); // Only an authenticated abort allowed this change.
        _prepare();
        assertEq(vault.currentRound(), 2);
        vm.expectRevert(NabungGoalVault.WrongRound.selector);
        stale.sequence = 4;
        _deliver(stale);
        assertEq(vault.claimableAssets(), 0);
    }

    function testAbortBeforeReadyAcknowledgesAndAllowsFreshRound() public {
        _deposit(1_000e6);
        _invest(1_000e6);
        _prepare();
        _deliver(_command(NabungGoalVault.MessageKind.Abort, 1, 2));
        assertEq(vault.reportSequence(), 1);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Locked));
        assertEq(vault.totalAssets(), 1_000e6);
        _prepare();
        assertEq(vault.currentRound(), 2);
    }

    function testCommitCannotBeAbortedOrRelockedAfterPartialClaims() public {
        _deposit(1_000e6);
        _prepare();
        vault.markReady();
        _commit();
        vm.prank(owner);
        vault.claim(600e6);
        assertEq(vault.claimableAssets(), 400e6);
        NabungGoalVault.Command memory abort = _command(NabungGoalVault.MessageKind.Abort, 1, 3);
        vm.expectRevert(NabungGoalVault.WrongRound.selector);
        _deliver(abort);
        NabungGoalVault.Command memory prepare = _command(NabungGoalVault.MessageKind.Prepare, 2, 3);
        vm.expectRevert(NabungGoalVault.WrongPhase.selector);
        _deliver(prepare);
        vm.prank(owner);
        vault.claim(400e6);
        assertEq(vault.claimableAssets(), 0);
        assertEq(vault.claimedAssets(), 1_000e6);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
    }

    function testEmptyLocalVaultMayParticipateWhenOtherChainFundsGoal() public {
        _prepare();
        vault.markReady();
        assertEq(vault.preparedAssets(), 0);
        _commit();
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
        assertEq(vault.claimableAssets(), 0);
    }

    function testUnsolicitedDonationsCannotChangeAcknowledgedReserveOrBypassLock() public {
        _deposit(1_000e6);
        usdc.mint(address(vault), 100e6);
        _prepare();
        vault.markReady();
        assertEq(vault.preparedAssets(), 1_100e6);
        usdc.mint(address(vault), 25e6);
        assertEq(vault.preparedAssets(), 1_100e6);
        assertEq(vault.claimableAssets(), 0);
        _commit();
        vm.prank(owner);
        vault.claim(1_125e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(vault.claimedAssets(), 1_125e6);
    }

    function testReceiptDonationAfterReadyCanOnlyIncreaseCashReserve() public {
        _deposit(1_000e6);
        _prepare();
        vault.markReady();
        pool.accrue(address(vault), 10e6); // Models a receipt donation after all real receipts were redeemed.
        vault.redeem(type(uint256).max, 10e6);
        assertEq(vault.preparedAssets(), 1_000e6);
        assertEq(usdc.balanceOf(address(vault)), 1_010e6);
        assertEq(vault.claimableAssets(), 0);
    }

    function testPausedStrategyDoesNotConsumeIdleDepositOrAllowance() public {
        _deposit(1_000e6);
        pool.setPaused(true);
        vm.prank(owner);
        vm.expectRevert(MockAavePool.Paused.selector);
        vault.invest(1_000e6);
        assertEq(usdc.balanceOf(address(vault)), 1_000e6);
        assertEq(usdc.allowance(address(vault), address(pool)), 0);
    }

    function testProgressIsComputedFromOwnedPositionAndSequenced() public {
        _deposit(1_000e6);
        _invest(500e6);
        pool.accrue(address(vault), 20e6);
        vm.prank(stranger);
        vault.reportProgress();
        assertEq(vault.progressSequence(), 1);
        assertEq(vault.reportSequence(), 0);
        assertEq(vault.totalAssets(), 1_020e6);
        _prepare();
        vault.redeem(type(uint256).max, 520e6);
        vault.markReady();
        assertEq(vault.reportSequence(), 1);
        assertEq(vault.preparedAssets(), 1_020e6);
    }

    function testProgressSpamCannotSkipLifecycleReadyOrAbortAckSequence() public {
        _deposit(100e6);
        for (uint256 i; i < 10; ++i) {
            vault.reportProgress();
        }
        assertEq(vault.progressSequence(), 10);
        assertEq(vault.reportSequence(), 0);
        _prepare();
        vault.markReady();
        assertEq(vault.reportSequence(), 1);
        for (uint256 i; i < 10; ++i) {
            vault.reportProgress();
        }
        assertEq(vault.reportSequence(), 1);
        _deliver(_command(NabungGoalVault.MessageKind.Abort, 1, 2));
        assertEq(vault.reportSequence(), 2);
    }

    function testFuzzConservationAcrossInterestLossAndPartialClaims(
        uint64 depositSeed,
        uint64 interestSeed,
        uint64 lossSeed,
        uint64 claimSeed
    ) public {
        uint256 principal = bound(depositSeed, 1, 9_000e6);
        uint256 interest = bound(interestSeed, 0, 500e6);
        uint256 loss = bound(lossSeed, 0, principal + interest);
        uint256 finalAssets = principal + interest - loss;
        _deposit(principal);
        _invest(principal);
        pool.accrue(address(vault), interest);
        pool.recognizeLoss(address(vault), loss);
        assertEq(vault.totalAssets(), finalAssets);
        _prepare();
        if (finalAssets != 0) vault.redeem(type(uint256).max, finalAssets);
        vault.markReady();
        _commit(); // Other registered chain's funds are assumed by this test transport.
        if (finalAssets != 0) {
            uint256 firstClaim = bound(claimSeed, 1, finalAssets);
            vm.prank(owner);
            vault.claim(firstClaim);
            assertEq(vault.claimedAssets() + vault.claimableAssets(), finalAssets);
            if (firstClaim != finalAssets) {
                vm.prank(owner);
                vault.claim(finalAssets - firstClaim);
            }
        }
        assertEq(vault.claimedAssets(), finalAssets);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(receipt.balanceOf(address(vault)), 0);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
    }
}
