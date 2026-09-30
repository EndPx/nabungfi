// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {NabungGoalVault} from "../src/NabungGoalVault.sol";
import {NabungMultiLzRouter} from "../src/NabungMultiLzRouter.sol";
import {NabungMultiVaultFactory} from "../src/NabungMultiVaultFactory.sol";
import {NabungMultiWire} from "../src/NabungMultiWire.sol";
import {MockLayerZeroEndpoint} from "./mocks/MockLayerZeroEndpoint.sol";
import {MockUSDC} from "./mocks/MockAavePool.sol";
import {MultichainConfig} from "../script/MultichainConfig.sol";

contract MultichainConfigHarness is MultichainConfig {}

contract MultiEndpointMock is MockLayerZeroEndpoint {
    uint32 public immutable eid;

    constructor(uint32 eid_) {
        eid = eid_;
    }
}

contract MultiWireHarness {
    function decode(bytes calldata raw) external pure returns (NabungMultiWire.Packet memory) {
        return NabungMultiWire.decode(raw);
    }
}

contract MultichainV2Test is Test {
    string private fixture;
    MockUSDC private asset;
    address private constant OWNER = address(0xbeef);
    bytes32 private constant PEER = bytes32(uint256(99));
    MultiEndpointMock private endpoint;
    NabungMultiLzRouter private router;
    MultiWireHarness private codec;

    function setUp() public {
        fixture = vm.readFile("../../shared/protocol/wire-v2.json");
        asset = new MockUSDC();
        codec = new MultiWireHarness();
        asset.mint(OWNER, 100e6);
        vm.deal(address(this), 1 ether);
    }

    function testDeploymentSecurityTuplePinsExactWorkersAndConfirmations() public {
        MultichainConfigHarness harness = new MultichainConfigHarness();
        MultichainConfig.Config memory c;
        c.domain = 2;
        c.eid = 40245;
        c.sendConfirmations = 2;
        c.receiveConfirmations = 10;
        c.endpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        c.sendLibrary = 0xC1868e054425D378095A003EcbA3823a5D0135C9;
        c.receiveLibrary = 0x12523de19dc41c91F7d2093E0CFbB76b17012C8d;
        c.executor = 0x8A3D588D9f6AC041476b094f97FF94ec30169d3D;
        c.dvn = 0xe1a12515F9AB2764b887bF60B923Ca494EBbB2d6;
        assertTrue(harness.matchesSecurity(c));
        c.sendConfirmations = 1;
        assertFalse(harness.matchesSecurity(c));
        c.sendConfirmations = 2;
        c.dvn = address(1);
        assertFalse(harness.matchesSecurity(c));
    }

    function solana() internal view returns (NabungMultiVaultFactory.SolanaDeployment memory) {
        return NabungMultiVaultFactory.SolanaDeployment(
            vm.parseJsonBytes32(fixture, ".config.program"),
            vm.parseJsonBytes32(fixture, ".config.usdcMint"),
            vm.parseJsonBytes32(fixture, ".config.transportProgram")
        );
    }

    function deploy(uint32 domain) internal {
        uint32 eid = domain == 2 ? 40245 : domain == 3 ? 40231 : 40161;
        vm.chainId(domain == 2 ? 84532 : domain == 3 ? 421614 : 11155111);
        endpoint = new MultiEndpointMock(eid);
        router = new NabungMultiLzRouter(
            address(endpoint),
            address(this),
            40168,
            PEER,
            domain,
            eid,
            address(asset),
            address(0),
            address(0),
            solana()
        );
        router.sealRoute();
    }

    function create(uint256 id) internal returns (NabungGoalVault vault) {
        vm.prank(OWNER);
        vault = NabungGoalVault(
            router.createGoal(
                NabungMultiVaultFactory.GoalRequest(
                    bytes32(id), bytes32(uint256(44)), bytes32(id + 100), 10e6, 0
                )
            )
        );
    }

    function packet(
        NabungGoalVault vault,
        uint8 kind,
        uint64 round,
        uint64 seq,
        uint64 amount,
        uint64 aggregate
    ) internal view returns (NabungMultiWire.Packet memory p) {
        p = NabungMultiWire.Packet(
            kind,
            1,
            router.domain(),
            vault.goalId(),
            vault.configHash(),
            vault.sourceCoordinator(),
            vault.vaultId(),
            NabungMultiWire.addressId(OWNER),
            round,
            seq,
            amount,
            aggregate,
            1,
            1
        );
    }

    function deliver(NabungMultiWire.Packet memory p) internal {
        endpoint.deliver(router, Origin(40168, PEER, 1), NabungMultiWire.encode(p));
    }

    function register(NabungGoalVault vault) internal {
        deliver(packet(vault, 7, 0, 0, 10e6, 0));
    }

    function testGoldenV2WireAndRejectV1Version() public {
        bytes memory raw = vm.parseJsonBytes(fixture, ".packet.encoded");
        NabungMultiWire.Packet memory p = codec.decode(raw);
        assertEq(p.destinationDomain, 3);
        assertEq(p.evmOwner, vm.parseJsonBytes32(fixture, ".packet.evmOwner"));
        assertEq(NabungMultiWire.encode(p), raw);
        raw[4] = bytes1(uint8(1));
        vm.expectRevert(NabungMultiWire.InvalidPacket.selector);
        codec.decode(raw);
    }

    function testThreeGoldenLeafHashesBindAssetRouterDomainAndEid() public {
        for (uint256 i; i < 3; i++) {
            string memory prefix = string.concat(".pairs[", vm.toString(i), "]");
            address fixtureAsset = vm.parseJsonAddress(fixture, string.concat(prefix, ".asset"));
            address fixtureRouter = vm.parseJsonAddress(fixture, string.concat(prefix, ".router"));
            vm.etch(fixtureAsset, address(asset).code);
            vm.prank(fixtureRouter);
            NabungMultiVaultFactory factory = new NabungMultiVaultFactory(
                fixtureAsset,
                address(0),
                address(0),
                uint32(vm.parseJsonUint(fixture, string.concat(prefix, ".domain"))),
                uint32(vm.parseJsonUint(fixture, string.concat(prefix, ".eid"))),
                solana()
            );
            NabungMultiVaultFactory.GoalRequest memory r = NabungMultiVaultFactory.GoalRequest(
                vm.parseJsonBytes32(fixture, ".config.goalId"),
                vm.parseJsonBytes32(fixture, ".config.solanaOwner"),
                vm.parseJsonBytes32(fixture, ".config.solanaGoal"),
                uint64(vm.parseJsonUint(fixture, ".config.target")),
                0
            );
            bytes32 hash = factory.configurationHash(
                vm.parseJsonAddress(fixture, string.concat(prefix, ".owner")),
                r,
                vm.parseJsonAddress(fixture, string.concat(prefix, ".vault"))
            );
            assertEq(hash, vm.parseJsonBytes32(fixture, string.concat(prefix, ".expectedHash")));
            r.target++;
            assertNotEq(
                hash,
                factory.configurationHash(
                    vm.parseJsonAddress(fixture, string.concat(prefix, ".owner")),
                    r,
                    vm.parseJsonAddress(fixture, string.concat(prefix, ".vault"))
                )
            );
        }
    }

    function testEachDomainReportsOwnDomainAndClaimsRemainPermanent() public {
        for (uint32 domain = 2; domain <= 4; domain++) {
            deploy(domain);
            NabungGoalVault vault = create(domain);
            register(vault);
            vm.startPrank(OWNER);
            asset.approve(address(vault), 2e6);
            vault.deposit(2e6);
            vm.stopPrank();
            router.sendProgress{value: endpoint.FEE()}(address(vault), "");
            assertEq(codec.decode(endpoint.lastMessage()).sourceDomain, domain);
            deliver(packet(vault, 1, 1, 1, 0, 0));
            vault.markReady();
            router.sendReport{value: endpoint.FEE()}(address(vault), 1, "");
            assertEq(codec.decode(endpoint.lastMessage()).sourceDomain, domain);
            deliver(packet(vault, 2, 1, 2, 2e6, 10e6));
            vm.prank(OWNER);
            vault.claim(1e6);
            vm.prank(OWNER);
            vault.claim(1e6);
            assertEq(vault.claimedAssets(), 2e6);
            assertEq(uint256(vault.phase()), 3);
            assertEq(vault.destinationDomain(), domain);
            deliver(packet(vault, 2, 1, 2, 2e6, 10e6));
            assertEq(vault.claimedAssets(), 2e6);
        }
    }

    function testWrongNetworkDomainEidAndEndpointRejected() public {
        vm.chainId(421614);
        endpoint = new MultiEndpointMock(40231);
        vm.expectRevert(NabungMultiLzRouter.InvalidRoute.selector);
        new NabungMultiLzRouter(
            address(endpoint),
            address(this),
            40168,
            PEER,
            2,
            40245,
            address(asset),
            address(0),
            address(0),
            solana()
        );
        endpoint = new MultiEndpointMock(40245);
        vm.expectRevert(NabungMultiLzRouter.InvalidRoute.selector);
        new NabungMultiLzRouter(
            address(endpoint),
            address(this),
            40168,
            PEER,
            3,
            40231,
            address(asset),
            address(0),
            address(0),
            solana()
        );
    }

    function testDomainSubstitutionAndGoalSubstitutionRejected() public {
        deploy(3);
        NabungGoalVault vault = create(1);
        NabungGoalVault other = create(2);
        NabungMultiWire.Packet memory p = packet(vault, 7, 0, 0, 10e6, 0);
        p.destinationDomain = 2;
        vm.expectRevert(NabungMultiLzRouter.InvalidRoute.selector);
        deliver(p);
        p.destinationDomain = 3;
        p.destination = other.vaultId();
        vm.expectRevert(NabungMultiLzRouter.InvalidRoute.selector);
        deliver(p);
        assertFalse(router.isGoalRegistered(address(vault)));
        assertFalse(router.isGoalRegistered(address(other)));
    }

    function testZeroReadyAbortOutboxAndFutureSequenceRollback() public {
        deploy(4);
        NabungGoalVault vault = create(1);
        register(vault);
        NabungMultiWire.Packet memory future = packet(vault, 1, 1, 2, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(NabungGoalVault.WrongSequence.selector, uint64(1), uint64(2)));
        deliver(future);
        assertEq(vault.commandSequence(), 0);
        deliver(packet(vault, 1, 1, 1, 0, 0));
        vault.markReady();
        assertEq(vault.preparedAssets(), 0);
        deliver(packet(vault, 3, 1, 2, 0, 0));
        assertEq(uint256(vault.phase()), 0);
        router.sendReport{value: endpoint.FEE()}(address(vault), 1, "");
        NabungMultiWire.Packet memory p = codec.decode(endpoint.lastMessage());
        assertEq(p.kind, 4);
        assertEq(p.amount, 0);
        assertEq(p.sourceDomain, 4);
        deliver(packet(vault, 1, 2, 3, 0, 0));
        vault.markReady();
        deliver(packet(vault, 2, 2, 4, 0, 10e6));
        assertEq(uint256(vault.phase()), 3);
        assertEq(vault.claimableAssets(), 0);
    }
}
