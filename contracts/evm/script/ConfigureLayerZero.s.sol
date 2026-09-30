// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {
    ILayerZeroEndpointV2,
    MessagingParams,
    MessagingFee
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {SetConfigParam} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/IMessageLibManager.sol";
import {NabungLzRouter} from "../src/NabungLzRouter.sol";
import {NabungWire} from "../src/NabungWire.sol";

// ABI-compatible configuration structs; no production library inheritance in deployment tooling.
struct UlnConfig {
    uint64 confirmations;
    uint8 requiredDVNCount;
    uint8 optionalDVNCount;
    uint8 optionalDVNThreshold;
    address[] requiredDVNs;
    address[] optionalDVNs;
}

struct ExecutorConfig {
    uint32 maxMessageSize;
    address executor;
}

interface IUlnReadback {
    function getUlnConfig(address oapp, uint32 eid) external view returns (UlnConfig memory);
    function getAppUlnConfig(address oapp, uint32 eid) external view returns (UlnConfig memory);
}

interface IEndpointDelegate {
    function delegates(address oapp) external view returns (address);
}

/// @notice Explicit Base Sepolia -> Solana Devnet wiring. Never seals the route or creates a goal.
/// @dev A single required LayerZero Labs DVN is the reviewed testnet stack, not a production quorum.
contract ConfigureLayerZero is Script {
    struct Config {
        address administrator;
        address endpoint;
        address router;
        address sendLibrary;
        address receiveLibrary;
        address executor;
        address dvn;
        uint64 sendConfirmations;
        uint64 receiveConfirmations;
        uint32 maxMessageSize;
        uint64 expectedNonce;
    }

    error InvalidConfiguration();
    error InvalidReadback();

    function load() public view returns (Config memory c) {
        c = Config({
            administrator: vm.envAddress("DEPLOYER_ADDRESS"),
            endpoint: vm.envAddress("BASE_SEPOLIA_ENDPOINT"),
            router: vm.envAddress("BASE_SEPOLIA_ROUTER"),
            sendLibrary: vm.envAddress("BASE_SEPOLIA_LZ_SEND_LIBRARY"),
            receiveLibrary: vm.envAddress("BASE_SEPOLIA_LZ_RECEIVE_LIBRARY"),
            executor: vm.envAddress("BASE_SEPOLIA_LZ_EXECUTOR"),
            dvn: vm.envAddress("BASE_SEPOLIA_LZ_REQUIRED_DVN"),
            sendConfirmations: uint64(envBound("BASE_SEPOLIA_LZ_SEND_CONFIRMATIONS", type(uint64).max)),
            receiveConfirmations: uint64(envBound("BASE_SEPOLIA_LZ_RECEIVE_CONFIRMATIONS", type(uint64).max)),
            maxMessageSize: uint32(envBound("BASE_SEPOLIA_LZ_MAX_MESSAGE_SIZE", type(uint32).max)),
            expectedNonce: uint64(envBound("BASE_SEPOLIA_LZ_CONFIG_NONCE", type(uint64).max))
        });
        validate(c);
    }

    function validate(Config memory c) public view {
        NabungLzRouter router = NabungLzRouter(c.router);
        if (
            block.chainid != 84532 || c.administrator == address(0)
                || c.endpoint != 0x6EDCE65403992e310A62460808c4b910D972f10f
                || c.router != 0x9B897086dBDF754ED88cE3610E2a40c3dF1aB40b
                || c.sendLibrary != 0xC1868e054425D378095A003EcbA3823a5D0135C9
                || c.receiveLibrary != 0x12523de19dc41c91F7d2093E0CFbB76b17012C8d
                || c.executor != 0x8A3D588D9f6AC041476b094f97FF94ec30169d3D
                || c.dvn != 0xe1a12515F9AB2764b887bF60B923Ca494EBbB2d6 || c.sendConfirmations != 2
                || c.receiveConfirmations != 10 || c.maxMessageSize != 10000 || c.endpoint.code.length == 0
                || c.sendLibrary.code.length == 0 || c.receiveLibrary.code.length == 0
                || c.executor.code.length == 0 || c.dvn.code.length == 0
                || address(router.endpoint()) != c.endpoint || router.solanaEid() != 40168
                || router.solanaOApp() != 0x454257dcb2f8449ec59059f823c55d3cc76f8aa49e6d9777e9545bbbfb30d382
        ) revert InvalidConfiguration();
    }

    function uln(address dvn, uint64 confirmations) public pure returns (UlnConfig memory config) {
        config.confirmations = confirmations;
        config.requiredDVNCount = 1;
        // NIL optional count means literal empty, not a mutable global default.
        config.optionalDVNCount = type(uint8).max;
        config.requiredDVNs = new address[](1);
        config.requiredDVNs[0] = dvn;
        config.optionalDVNs = new address[](0);
    }

    function envBound(string memory key, uint256 maximum) public view returns (uint256 value) {
        value = vm.envUint(key);
        if (value > maximum) revert InvalidConfiguration();
    }

    function run() external {
        Config memory c = load();
        NabungLzRouter router = NabungLzRouter(c.router);
        if (
            router.routeSealed() || router.owner() != c.administrator
                || vm.getNonce(c.administrator) != c.expectedNonce
        ) {
            revert InvalidConfiguration();
        }
        ILayerZeroEndpointV2 endpoint = ILayerZeroEndpointV2(c.endpoint);
        SetConfigParam[] memory send = new SetConfigParam[](2);
        send[0] = SetConfigParam(40168, 1, abi.encode(ExecutorConfig(c.maxMessageSize, c.executor)));
        send[1] = SetConfigParam(40168, 2, abi.encode(uln(c.dvn, c.sendConfirmations)));
        SetConfigParam[] memory inbound = new SetConfigParam[](1);
        inbound[0] = SetConfigParam(40168, 2, abi.encode(uln(c.dvn, c.receiveConfirmations)));
        vm.startBroadcast(c.administrator);
        endpoint.setSendLibrary(c.router, 40168, c.sendLibrary);
        endpoint.setReceiveLibrary(c.router, 40168, c.receiveLibrary, 0);
        endpoint.setConfig(c.router, c.sendLibrary, send);
        endpoint.setConfig(c.router, c.receiveLibrary, inbound);
        vm.stopBroadcast();
        assertReadback(c);
        console2.log("Explicit LayerZero configuration applied; route remains unsealed:", c.router);
    }

    function assertReadback(Config memory c) public view {
        ILayerZeroEndpointV2 endpoint = ILayerZeroEndpointV2(c.endpoint);
        (address receiveLibrary, bool defaultReceive) = endpoint.getReceiveLibrary(c.router, 40168);
        if (
            endpoint.getSendLibrary(c.router, 40168) != c.sendLibrary
                || endpoint.isDefaultSendLibrary(c.router, 40168) || receiveLibrary != c.receiveLibrary
                || defaultReceive
        ) revert InvalidReadback();
        if (
            keccak256(abi.encode(IUlnReadback(c.sendLibrary).getAppUlnConfig(c.router, 40168)))
                    != keccak256(abi.encode(uln(c.dvn, c.sendConfirmations)))
                || keccak256(abi.encode(IUlnReadback(c.receiveLibrary).getAppUlnConfig(c.router, 40168)))
                    != keccak256(abi.encode(uln(c.dvn, c.receiveConfirmations)))
        ) revert InvalidReadback();
        ExecutorConfig memory executor =
            abi.decode(endpoint.getConfig(c.router, c.sendLibrary, 40168, 1), (ExecutorConfig));
        if (executor.executor != c.executor || executor.maxMessageSize != c.maxMessageSize) {
            revert InvalidReadback();
        }
    }

    function audit() external view {
        Config memory c = load();
        assertReadback(c);
        console2.log("Explicit configuration readback matches on Base Sepolia:", c.router);
        console2.log("Route sealed:", NabungLzRouter(c.router).routeSealed());
        console2.log("Router owner:", NabungLzRouter(c.router).owner());
        console2.log("Endpoint delegate:", IEndpointDelegate(c.endpoint).delegates(c.router));
        console2.log("Current administrator nonce:", vm.getNonce(c.administrator));
    }

    function options(uint128 computeUnits, uint128 lamports) public pure returns (bytes memory) {
        // Official type-3 executor worker option: worker=1, LZ_RECEIVE=1, uint128 gas/value.
        if (lamports == 0) return abi.encodePacked(uint16(3), uint8(1), uint16(17), uint8(1), computeUnits);
        return abi.encodePacked(uint16(3), uint8(1), uint16(33), uint8(1), computeUnits, lamports);
    }

    /// @notice Real worker quote for the actual sender/store and a valid 222-byte REGISTERED packet.
    /// @dev Goal identities here are illustrative; this checks fees, not registration or delivery.
    function quote() external view returns (MessagingFee memory fee) {
        Config memory c = load();
        NabungWire.Packet memory packet;
        packet.kind = NabungWire.REGISTERED;
        packet.sourceDomain = 2;
        packet.destinationDomain = 1;
        packet.goalId = bytes32(uint256(1));
        packet.configHash = bytes32(uint256(2));
        packet.source = NabungWire.addressId(c.router);
        packet.destination = bytes32(uint256(3));
        packet.baseOwner = NabungWire.addressId(c.administrator);
        packet.amount = 10_000_000;
        packet.observation = NabungWire.narrow(block.number);
        packet.observedAt = NabungWire.narrow(block.timestamp);
        fee = ILayerZeroEndpointV2(c.endpoint)
            .quote(
                MessagingParams(
                    40168,
                    NabungLzRouter(c.router).solanaOApp(),
                    NabungWire.encode(packet),
                    options(
                        uint128(envBound("SOLANA_DEVNET_LZ_RECEIVE_COMPUTE", type(uint128).max)),
                        uint128(envBound("SOLANA_DEVNET_LZ_RECEIVE_LAMPORTS", type(uint128).max))
                    ),
                    false
                ),
                c.router
            );
        console2.log("Real Endpoint/ULN/DVN/Executor native fee (wei):", fee.nativeFee);
    }
}
