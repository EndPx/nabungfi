// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {NabungGoalVault} from "../src/NabungGoalVault.sol";
import {MockUSDC, MockAToken, MockAavePool} from "./mocks/MockAavePool.sol";
import {MockMessageTransport} from "./mocks/MockMessageTransport.sol";

/// @dev Same-owner isolation against local mocks, not proof of an authenticated bridge.
contract MultiGoalIsolationTest is Test {
    MockUSDC internal usdc;
    MockAavePool internal pool;
    MockAToken internal receipt;
    MockMessageTransport internal transport;
    NabungGoalVault internal car;
    NabungGoalVault internal laptop;
    NabungGoalVault internal house;
    address internal owner = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        pool = new MockAavePool(usdc);
        receipt = pool.receipt();
        transport = new MockMessageTransport();
        car = _create("car", 10_000e6);
        laptop = _create("laptop", 2_000e6);
        house = _create("house", 100_000e6);
        usdc.mint(owner, 1_000_000e6);
    }

    function _create(string memory name, uint256 target) internal returns (NabungGoalVault goal) {
        bytes32 id = keccak256(bytes(name));
        bytes32 coordinator = keccak256(abi.encode("test-solana-goal", owner, id));
        goal = new NabungGoalVault(
            NabungGoalVault.GoalConfig({
                owner: owner,
                goalId: id,
                configHash: keccak256(abi.encode("test-config", owner, id, target, coordinator)),
                target: target,
                messenger: address(transport),
                sourceCoordinator: coordinator,
                minimumIdle: 0
            }),
            address(usdc),
            address(pool),
            address(receipt)
        );
        vm.prank(owner);
        usdc.approve(address(goal), type(uint256).max);
    }

    function _fund(NabungGoalVault goal, uint256 amount, uint256 invested) internal {
        vm.startPrank(owner);
        goal.deposit(amount);
        if (invested != 0) goal.invest(invested);
        vm.stopPrank();
    }

    function _command(NabungGoalVault goal, NabungGoalVault.MessageKind kind, uint256 aggregate)
        internal
        view
        returns (NabungGoalVault.Command memory)
    {
        return NabungGoalVault.Command({
            goalId: goal.goalId(),
            configHash: goal.configHash(),
            destinationChain: 2,
            destinationVault: goal.vaultId(),
            round: kind == NabungGoalVault.MessageKind.Prepare
                ? goal.currentRound() + 1
                : goal.currentRound(),
            sequence: goal.commandSequence() + 1,
            messageKind: kind,
            preparedAssets: kind == NabungGoalVault.MessageKind.Commit ? goal.preparedAssets() : 0,
            aggregateReserved: aggregate
        });
    }

    function _deliver(NabungGoalVault goal, NabungGoalVault.MessageKind kind, uint256 aggregate) internal {
        transport.deliver(goal, 1, goal.sourceCoordinator(), _command(goal, kind, aggregate));
    }

    function _snapshot(NabungGoalVault goal) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                goal.phase(),
                goal.currentRound(),
                goal.commandSequence(),
                goal.reportSequence(),
                goal.progressSequence(),
                goal.depositedAssets(),
                goal.preparedAssets(),
                goal.claimedAssets(),
                goal.roundOutcome(goal.currentRound()),
                usdc.balanceOf(address(goal)),
                receipt.balanceOf(address(goal))
            )
        );
    }

    function testSameOwnerHasIndependentPrincipalReceiptsInterestAndLoss() public {
        _fund(car, 6_000e6, 5_000e6);
        _fund(laptop, 1_800e6, 1_600e6);
        _fund(house, 12_000e6, 10_000e6);
        pool.accrue(address(laptop), 200e6);
        pool.recognizeLoss(address(house), 100e6);

        assertEq(car.owner(), laptop.owner());
        assertEq(laptop.owner(), house.owner());
        assertEq(car.totalAssets(), 6_000e6);
        assertEq(laptop.totalAssets(), 2_000e6);
        assertEq(house.totalAssets(), 11_900e6);
        assertEq(car.depositedAssets(), 6_000e6);
        assertEq(laptop.depositedAssets(), 1_800e6);
        assertEq(house.depositedAssets(), 12_000e6);
        assertEq(receipt.balanceOf(address(car)), 5_000e6);
        assertEq(receipt.balanceOf(address(laptop)), 1_800e6);
        assertEq(receipt.balanceOf(address(house)), 9_900e6);
        assertEq(receipt.balanceOf(owner), 0);
        assertEq(car.claimableAssets() + laptop.claimableAssets() + house.claimableAssets(), 0);
    }

    function testCompletingAndClaimingLaptopPreservesOtherGoalsExactly() public {
        _fund(car, 6_000e6, 5_000e6);
        _fund(laptop, 1_800e6, 1_800e6);
        _fund(house, 12_000e6, 10_000e6);
        pool.accrue(address(laptop), 200e6);
        bytes32 carBefore = _snapshot(car);
        bytes32 houseBefore = _snapshot(house);
        uint256 ownerBefore = usdc.balanceOf(owner);

        _deliver(laptop, NabungGoalVault.MessageKind.Prepare, 0);
        laptop.redeem(type(uint256).max, 2_000e6);
        laptop.markReady();
        _deliver(laptop, NabungGoalVault.MessageKind.Commit, 2_000e6);
        vm.startPrank(owner);
        laptop.claim(600e6);
        laptop.claim(1_400e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(owner) - ownerBefore, 2_000e6);
        assertEq(laptop.claimedAssets(), 2_000e6);
        assertEq(laptop.totalAssets(), 0);
        assertEq(uint256(laptop.phase()), uint256(NabungGoalVault.Phase.Achieved));
        assertEq(_snapshot(car), carBefore);
        assertEq(_snapshot(house), houseBefore);
    }

    function testCrossGoalPeerIdentityAndDestinationAreRejectedWithoutMutation() public {
        bytes32 before = _snapshot(laptop);
        NabungGoalVault.Command memory wrong = _command(car, NabungGoalVault.MessageKind.Prepare, 0);
        bytes32 carCoordinator = car.sourceCoordinator();
        bytes32 laptopCoordinator = laptop.sourceCoordinator();
        vm.expectRevert(NabungGoalVault.WrongPeer.selector);
        transport.deliver(laptop, 1, carCoordinator, wrong);
        vm.expectRevert(NabungGoalVault.WrongGoal.selector);
        transport.deliver(laptop, 1, laptopCoordinator, wrong);

        wrong = _command(laptop, NabungGoalVault.MessageKind.Prepare, 0);
        wrong.destinationVault = car.vaultId();
        vm.expectRevert(NabungGoalVault.WrongDestination.selector);
        transport.deliver(laptop, 1, laptopCoordinator, wrong);
        assertEq(_snapshot(laptop), before);
    }

    function testCarCommitCannotUnlockAnotherReadyGoalWithSameOwner() public {
        _fund(car, 10_000e6, 0);
        _fund(laptop, 2_000e6, 0);
        _deliver(car, NabungGoalVault.MessageKind.Prepare, 0);
        _deliver(laptop, NabungGoalVault.MessageKind.Prepare, 0);
        car.markReady();
        laptop.markReady();
        bytes32 before = _snapshot(laptop);
        NabungGoalVault.Command memory carCommit = _command(car, NabungGoalVault.MessageKind.Commit, 10_000e6);
        bytes32 laptopCoordinator = laptop.sourceCoordinator();
        vm.expectRevert(NabungGoalVault.WrongGoal.selector);
        transport.deliver(laptop, 1, laptopCoordinator, carCommit);
        assertEq(_snapshot(laptop), before);
        assertEq(laptop.claimableAssets(), 0);

        _deliver(car, NabungGoalVault.MessageKind.Commit, 10_000e6);
        assertEq(_snapshot(laptop), before);
        _deliver(laptop, NabungGoalVault.MessageKind.Commit, 2_000e6);
        assertEq(laptop.claimableAssets(), 2_000e6);
    }

    function testAbortRoundsAndProgressCountersRemainPerGoal() public {
        _fund(laptop, 2_000e6, 0);
        bytes32 houseBefore = _snapshot(house);
        _deliver(car, NabungGoalVault.MessageKind.Prepare, 0);
        _deliver(laptop, NabungGoalVault.MessageKind.Prepare, 0);
        laptop.markReady();
        for (uint256 i; i < 5; ++i) {
            laptop.reportProgress();
        }
        _deliver(car, NabungGoalVault.MessageKind.Abort, 0);
        _deliver(car, NabungGoalVault.MessageKind.Prepare, 0);
        _deliver(laptop, NabungGoalVault.MessageKind.Commit, 2_000e6);

        assertEq(car.currentRound(), 2);
        assertEq(car.commandSequence(), 3);
        assertEq(uint256(car.roundOutcome(1)), uint256(NabungGoalVault.RoundOutcome.Aborted));
        assertEq(car.progressSequence(), 0);
        assertEq(laptop.currentRound(), 1);
        assertEq(laptop.commandSequence(), 2);
        assertEq(laptop.reportSequence(), 1);
        assertEq(laptop.progressSequence(), 5);
        assertEq(uint256(laptop.roundOutcome(1)), uint256(NabungGoalVault.RoundOutcome.Committed));
        assertEq(_snapshot(house), houseBefore);
    }

    function testIlliquidInvestedGoalDoesNotBlockCashFundedGoal() public {
        _fund(house, 12_000e6, 12_000e6);
        _fund(laptop, 2_000e6, 0);
        _deliver(house, NabungGoalVault.MessageKind.Prepare, 0);
        bytes32 houseBefore = _snapshot(house);
        pool.setAvailableLiquidity(0);
        vm.expectRevert(MockAavePool.Illiquid.selector);
        house.redeem(type(uint256).max, 0);

        _deliver(laptop, NabungGoalVault.MessageKind.Prepare, 0);
        laptop.markReady();
        _deliver(laptop, NabungGoalVault.MessageKind.Commit, 2_000e6);
        vm.prank(owner);
        laptop.claim(2_000e6);
        assertEq(_snapshot(house), houseBefore);
        assertEq(house.claimableAssets(), 0);
        assertEq(laptop.claimedAssets(), 2_000e6);
    }
}
