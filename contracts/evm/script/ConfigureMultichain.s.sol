// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {console2} from "forge-std/Script.sol";
import {
    ILayerZeroEndpointV2,
    MessagingParams,
    MessagingFee
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {SetConfigParam} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/IMessageLibManager.sol";
import {UlnConfig, ExecutorConfig, IUlnReadback, IEndpointDelegate} from "./ConfigureLayerZero.s.sol";
import {MultichainConfig} from "./MultichainConfig.sol";
import {NabungMultiLzRouter} from "../src/NabungMultiLzRouter.sol";
import {NabungMultiWire} from "../src/NabungMultiWire.sol";

contract ConfigureMultichain is MultichainConfig {
    function uln(address dvn, uint64 confirmations) public pure returns (UlnConfig memory c) {
        c.confirmations = confirmations;
        c.requiredDVNCount = 1;
        c.optionalDVNCount = 255;
        c.requiredDVNs = new address[](1);
        c.requiredDVNs[0] = dvn;
        c.optionalDVNs = new address[](0);
    }

    function assertRouter(Config memory c) public view {
        NabungMultiLzRouter r = NabungMultiLzRouter(c.router);
        (bytes32 program, bytes32 usdcMint, bytes32 transport) = r.factory().solana();
        if (
            address(r.endpoint()) != c.endpoint || r.domain() != c.domain || r.eid() != c.eid
                || r.solanaEid() != 40168 || r.solanaOApp() != c.store || r.factory().asset() != c.asset
                || r.factory().pool() != c.pool || r.factory().receipt() != c.receipt
                || r.factory().domain() != c.domain || r.factory().eid() != c.eid
                || program != c.solana.program || usdcMint != c.solana.usdcMint
                || transport != c.solana.transportProgram
        ) revert InvalidMultichainConfig();
    }

    function run() external {
        Config memory c = load();
        assertRouter(c);
        NabungMultiLzRouter router = NabungMultiLzRouter(c.router);
        if (
            router.routeSealed() || router.owner() != c.administrator
                || vm.getNonce(c.administrator) != c.expectedNonce
        ) revert InvalidMultichainConfig();
        SetConfigParam[] memory send = new SetConfigParam[](2);
        send[0] = SetConfigParam(40168, 1, abi.encode(ExecutorConfig(10000, c.executor)));
        send[1] = SetConfigParam(40168, 2, abi.encode(uln(c.dvn, c.sendConfirmations)));
        SetConfigParam[] memory inbound = new SetConfigParam[](1);
        inbound[0] = SetConfigParam(40168, 2, abi.encode(uln(c.dvn, c.receiveConfirmations)));
        ILayerZeroEndpointV2 endpoint = ILayerZeroEndpointV2(c.endpoint);
        vm.startBroadcast(c.administrator);
        endpoint.setSendLibrary(c.router, 40168, c.sendLibrary);
        endpoint.setReceiveLibrary(c.router, 40168, c.receiveLibrary, 0);
        endpoint.setConfig(c.router, c.sendLibrary, send);
        endpoint.setConfig(c.router, c.receiveLibrary, inbound);
        vm.stopBroadcast();
        assertReadback(c);
    }

    function assertReadback(Config memory c) public view {
        assertRouter(c);
        ILayerZeroEndpointV2 e = ILayerZeroEndpointV2(c.endpoint);
        (address receiver, bool defaults) = e.getReceiveLibrary(c.router, 40168);
        if (
            e.getSendLibrary(c.router, 40168) != c.sendLibrary || e.isDefaultSendLibrary(c.router, 40168)
                || receiver != c.receiveLibrary || defaults
                || keccak256(abi.encode(IUlnReadback(c.sendLibrary).getAppUlnConfig(c.router, 40168)))
                    != keccak256(abi.encode(uln(c.dvn, c.sendConfirmations)))
                || keccak256(abi.encode(IUlnReadback(c.receiveLibrary).getAppUlnConfig(c.router, 40168)))
                    != keccak256(abi.encode(uln(c.dvn, c.receiveConfirmations)))
        ) revert InvalidMultichainConfig();
        ExecutorConfig memory executor =
            abi.decode(e.getConfig(c.router, c.sendLibrary, 40168, 1), (ExecutorConfig));
        if (executor.executor != c.executor || executor.maxMessageSize != 10000) {
            revert InvalidMultichainConfig();
        }
    }

    function options(uint128 compute, uint128 value) public pure returns (bytes memory) {
        if (value == 0) return abi.encodePacked(uint16(3), uint8(1), uint16(17), uint8(1), compute);
        return abi.encodePacked(uint16(3), uint8(1), uint16(33), uint8(1), compute, value);
    }

    function audit() external view {
        Config memory c = load();
        assertReadback(c);
        console2.log("V2 router:", c.router);
        console2.log("Application domain:", c.domain);
        console2.log("Owner:", NabungMultiLzRouter(c.router).owner());
        console2.log("Delegate:", IEndpointDelegate(c.endpoint).delegates(c.router));
        console2.log("Sealed:", NabungMultiLzRouter(c.router).routeSealed());
    }

    function quote() external view returns (MessagingFee memory fee) {
        Config memory c = load();
        assertRouter(c);
        NabungMultiWire.Packet memory p = NabungMultiWire.Packet(
            8,
            c.domain,
            1,
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            NabungMultiWire.addressId(c.router),
            bytes32(uint256(3)),
            NabungMultiWire.addressId(c.administrator),
            0,
            0,
            10e6,
            0,
            uint64(block.number),
            uint64(block.timestamp)
        );
        fee = ILayerZeroEndpointV2(c.endpoint)
            .quote(
                MessagingParams(
                    40168,
                    c.store,
                    NabungMultiWire.encode(p),
                    options(
                        uint128(bounded("MULTI_SOLANA_RECEIVE_COMPUTE", type(uint128).max)),
                        uint128(bounded("MULTI_SOLANA_RECEIVE_LAMPORTS", type(uint128).max))
                    ),
                    false
                ),
                c.router
            );
        console2.log("Actual worker native fee, illustrative goal identities (wei):", fee.nativeFee);
    }
}
