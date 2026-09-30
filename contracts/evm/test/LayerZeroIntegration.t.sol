// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {OApp, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OAppReceiver} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppReceiver.sol";
import {IOAppCore} from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppCore.sol";
import {NabungGoalVault} from "../src/NabungGoalVault.sol";
import {NabungLzRouter} from "../src/NabungLzRouter.sol";
import {NabungVaultFactory} from "../src/NabungVaultFactory.sol";
import {NabungWire} from "../src/NabungWire.sol";
import {MockUSDC, MockAToken, MockAavePool} from "./mocks/MockAavePool.sol";
import {MockLayerZeroEndpoint} from "./mocks/MockLayerZeroEndpoint.sol";

contract WireHarness {
    function decode(bytes calldata raw) external pure returns (NabungWire.Packet memory) {
        return NabungWire.decode(raw);
    }
}

contract LayerZeroIntegrationTest is Test {
    using stdStorage for StdStorage;
    MockLayerZeroEndpoint internal endpoint;
    NabungLzRouter internal router;
    MockUSDC internal usdc;
    MockAavePool internal pool;
    MockAToken internal receipt;
    WireHarness internal codec;
    address internal owner = address(0xBEEF);
    bytes32 internal constant SOL_PEER = bytes32(uint256(999));
    uint32 internal constant SOL_EID = 30168; // Local harness identifier, not a network connection.
    string internal fixture;

    function setUp() public {
        fixture = vm.readFile("../../shared/protocol/wire-v1.json");
        endpoint = new MockLayerZeroEndpoint();
        usdc = new MockUSDC();
        pool = new MockAavePool(usdc);
        receipt = pool.receipt();
        codec = new WireHarness();
        router = new NabungLzRouter(
            address(endpoint),
            address(this),
            SOL_EID,
            SOL_PEER,
            address(usdc),
            address(pool),
            address(receipt),
            _solana()
        );
        router.sealRoute();
        usdc.mint(owner, 100_000e6);
        vm.deal(address(this), 10 ether);
    }

    function _solana() internal view returns (NabungVaultFactory.SolanaDeployment memory) {
        return NabungVaultFactory.SolanaDeployment({
            program: vm.parseJsonBytes32(fixture, ".config.program"),
            usdcMint: vm.parseJsonBytes32(fixture, ".config.usdcMint"),
            kaminoMarket: vm.parseJsonBytes32(fixture, ".config.kaminoMarket"),
            kaminoReserve: vm.parseJsonBytes32(fixture, ".config.kaminoReserve"),
            collateralMint: vm.parseJsonBytes32(fixture, ".config.collateralMint"),
            liquiditySupply: vm.parseJsonBytes32(fixture, ".config.liquiditySupply"),
            transportProgram: vm.parseJsonBytes32(fixture, ".config.transportProgram")
        });
    }

    function _request(bytes32 id) internal pure returns (NabungVaultFactory.GoalRequest memory) {
        return NabungVaultFactory.GoalRequest(
            id, bytes32(uint256(44)), keccak256(abi.encode("sol-goal", id)), 10_000e6, 0
        );
    }

    function _create(bytes32 id) internal returns (NabungGoalVault vault) {
        vm.prank(owner);
        vault = NabungGoalVault(router.createGoal(_request(id)));
        vm.prank(owner);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _packet(
        NabungGoalVault vault,
        uint8 kind,
        uint64 round,
        uint64 sequence,
        uint64 amount,
        uint64 aggregate
    ) internal view returns (NabungWire.Packet memory) {
        return NabungWire.Packet({
            kind: kind,
            sourceDomain: 1,
            destinationDomain: 2,
            goalId: vault.goalId(),
            configHash: vault.configHash(),
            source: vault.sourceCoordinator(),
            destination: vault.vaultId(),
            baseOwner: NabungWire.addressId(vault.owner()),
            round: round,
            sequence: sequence,
            amount: amount,
            aggregate: aggregate,
            observation: 1234,
            observedAt: 1_700_000_000
        });
    }

    function _deliver(NabungWire.Packet memory packet) internal {
        endpoint.deliver(router, Origin(SOL_EID, SOL_PEER, packet.sequence + 1), NabungWire.encode(packet));
    }

    function _register(NabungGoalVault vault) internal {
        _deliver(_packet(vault, NabungWire.REGISTER, 0, 0, uint64(vault.target()), 0));
    }

    function _deposit(NabungGoalVault vault, uint256 amount) internal {
        vm.prank(owner);
        vault.deposit(amount);
    }

    function testWireMatchesSharedGoldenBytesAndRejectsMalformedData() public {
        bytes memory golden = vm.parseJsonBytes(fixture, ".packet.encoded");
        NabungWire.Packet memory decoded = codec.decode(golden);
        assertEq(NabungWire.encode(decoded), golden);
        assertEq(decoded.amount, 4_100e6);
        assertEq(decoded.aggregate, 10_200e6);
        assertEq(decoded.round, 7);
        vm.expectRevert(NabungWire.InvalidPacket.selector);
        codec.decode(bytes.concat(golden, hex"00"));
        golden[4] = 0x02;
        vm.expectRevert(NabungWire.InvalidPacket.selector);
        codec.decode(golden);
        decoded.kind = NabungWire.READY; // READY cannot originate from the Solana command direction.
        vm.expectRevert(NabungWire.InvalidPacket.selector);
        this.encodePacket(decoded);
    }

    function encodePacket(NabungWire.Packet calldata packet) external pure returns (bytes memory) {
        return NabungWire.encode(packet);
    }

    function testConfigurationHashMatchesSolanaGoldenCommitment() public view {
        NabungVaultFactory.GoalRequest memory request = NabungVaultFactory.GoalRequest({
            goalId: vm.parseJsonBytes32(fixture, ".packet.goalId"),
            solanaOwner: vm.parseJsonBytes32(fixture, ".config.solanaOwner"),
            solanaGoal: vm.parseJsonBytes32(fixture, ".packet.source"),
            target: uint64(vm.parseJsonUint(fixture, ".config.target")),
            minimumIdle: 0
        });
        address baseOwner = address(uint160(uint256(vm.parseJsonBytes32(fixture, ".packet.baseOwner"))));
        address vault = address(uint160(uint256(vm.parseJsonBytes32(fixture, ".packet.destination"))));
        assertEq(
            router.factory().configurationHash(baseOwner, request, vault),
            vm.parseJsonBytes32(fixture, ".config.expectedHash")
        );
    }

    function testFactoryPredictionsMatchCreateAcrossRlpNonceBoundaries() public {
        uint64[6] memory nonces = [uint64(1), 127, 128, 255, 256, 65536];
        NabungVaultFactory factory = router.factory();
        for (uint256 i; i < nonces.length; ++i) {
            stdstore.target(address(factory)).sig("creationNonce()").checked_write(nonces[i]);
            vm.setNonce(address(factory), nonces[i]);
            address expected = vm.computeCreateAddress(address(factory), nonces[i]);
            assertEq(factory.predictNextVault(), expected);
            NabungGoalVault created = _create(keccak256(abi.encode("nonce", i)));
            assertEq(address(created), expected);
        }
    }

    function testRegisteredPairRequiredAndRouteAuthorityIsSealed() public {
        NabungGoalVault vault = _create(keccak256("car"));
        vm.prank(owner);
        vm.expectRevert(NabungGoalVault.GoalNotRegistered.selector);
        vault.deposit(100e6);
        _register(vault);
        _deposit(vault, 100e6);
        assertEq(vault.totalAssets(), 100e6);
        assertEq(router.owner(), address(0));
        assertEq(endpoint.delegates(address(router)), address(router));
        vm.expectRevert();
        router.setPeer(SOL_EID, bytes32(uint256(17)));
        vm.expectRevert();
        router.setDelegate(owner);
    }

    function testRealOAppEndpointAndPeerGuardsRejectForgedDelivery() public {
        NabungGoalVault vault = _create(keccak256("car"));
        bytes memory packet = NabungWire.encode(_packet(vault, NabungWire.REGISTER, 0, 0, 10_000e6, 0));
        vm.expectRevert(abi.encodeWithSelector(OAppReceiver.OnlyEndpoint.selector, address(this)));
        router.lzReceive(Origin(SOL_EID, SOL_PEER, 1), bytes32(0), packet, address(this), "");
        bytes32 stranger = bytes32(uint256(77));
        vm.expectRevert(abi.encodeWithSelector(IOAppCore.OnlyPeer.selector, SOL_EID, stranger));
        endpoint.deliver(router, Origin(SOL_EID, stranger, 1), packet);
        assertFalse(router.isGoalRegistered(address(vault)));
    }

    function testPendingCloneCannotSquatOrRebindAnotherOwnersGoal() public {
        bytes32 id = keccak256("same-goal");
        vm.prank(address(0xBAD));
        NabungGoalVault attacker = NabungGoalVault(router.createGoal(_request(id)));
        NabungGoalVault legitimate = _create(id);
        _register(legitimate);
        assertEq(router.vaultForCoordinator(legitimate.sourceCoordinator()), address(legitimate));
        NabungWire.Packet memory wrong = _packet(attacker, NabungWire.REGISTER, 0, 0, 10_000e6, 0);
        vm.expectRevert(NabungLzRouter.InvalidRoute.selector);
        _deliver(wrong);
        assertFalse(router.isGoalRegistered(address(attacker)));
    }

    function testLifecycleSendsActualReadySnapshotThenAcceptsCommitAndClaims() public {
        NabungGoalVault vault = _create(keccak256("car"));
        _register(vault);
        router.sendRegistration{value: endpoint.FEE()}(address(vault), hex"0003");
        NabungWire.Packet memory ack = codec.decode(endpoint.lastMessage());
        assertEq(ack.kind, NabungWire.REGISTERED);
        assertEq(ack.amount, 10_000e6);
        _deposit(vault, 4_000e6);
        vm.prank(owner);
        vault.invest(4_000e6);
        pool.accrue(address(vault), 100e6);
        _deliver(_packet(vault, NabungWire.PREPARE, 1, 1, 0, 0));
        vault.redeem(type(uint256).max, 4_100e6);
        vault.markReady();
        router.sendReport{value: endpoint.FEE()}(address(vault), 1, hex"0003");
        NabungWire.Packet memory ready = codec.decode(endpoint.lastMessage());
        assertEq(ready.kind, NabungWire.READY);
        assertEq(ready.amount, 4_100e6);
        assertEq(ready.source, vault.vaultId());
        assertEq(ready.sequence, 1);
        _deliver(_packet(vault, NabungWire.COMMIT, 1, 2, 4_100e6, 10_200e6));
        vm.prank(owner);
        vault.claim(4_100e6);
        assertEq(vault.claimedAssets(), 4_100e6);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
        _deliver(_packet(vault, NabungWire.PREPARE, 1, 1, 0, 0)); // Authenticated stale retry is a no-op.
        assertEq(vault.commandSequence(), 2);
    }

    function testReadyOutboxSurvivesAbortAndFeeFailureDoesNotLoseIt() public {
        NabungGoalVault vault = _create(keccak256("car"));
        _register(vault);
        _deposit(vault, 1_000e6);
        _deliver(_packet(vault, NabungWire.PREPARE, 1, 1, 0, 0));
        vault.markReady();
        _deliver(_packet(vault, NabungWire.ABORT, 1, 2, 0, 0));
        vm.expectRevert(MockLayerZeroEndpoint.InsufficientFee.selector);
        router.sendReport(address(vault), 1, hex"0003");
        router.sendReport{value: endpoint.FEE()}(address(vault), 1, hex"0003");
        NabungWire.Packet memory ready = codec.decode(endpoint.lastMessage());
        assertEq(ready.kind, NabungWire.READY);
        assertEq(ready.amount, 1_000e6);
        router.sendReport{value: endpoint.FEE()}(address(vault), 2, hex"0003");
        NabungWire.Packet memory abortAck = codec.decode(endpoint.lastMessage());
        assertEq(abortAck.kind, NabungWire.ABORT_ACK);
        assertEq(abortAck.amount, 0);
        assertEq(abortAck.sequence, 2);
        assertEq(abortAck.round, 1);
    }

    function testProgressUsesOwnAssetsAndFailedSendRollsBackCounter() public {
        NabungGoalVault car = _create(keccak256("car"));
        NabungGoalVault laptop = _create(keccak256("laptop"));
        _register(car);
        _register(laptop);
        _deposit(car, 100e6);
        _deposit(laptop, 200e6);
        vm.expectRevert(MockLayerZeroEndpoint.InsufficientFee.selector);
        router.sendProgress(address(car), hex"0003");
        assertEq(car.progressSequence(), 0);
        router.sendProgress{value: endpoint.FEE()}(address(car), hex"0003");
        NabungWire.Packet memory progress = codec.decode(endpoint.lastMessage());
        assertEq(progress.kind, NabungWire.PROGRESS);
        assertEq(progress.amount, 100e6);
        assertEq(progress.goalId, car.goalId());
        assertEq(laptop.progressSequence(), 0);
        assertEq(car.claimableAssets(), 0);
        assertEq(laptop.claimableAssets(), 0);
    }
}
