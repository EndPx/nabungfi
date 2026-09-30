// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {console2} from "forge-std/Script.sol";
import {MultichainConfig} from "./MultichainConfig.sol";
import {NabungMultiLzRouter} from "../src/NabungMultiLzRouter.sol";

contract DeployMultichain is MultichainConfig {
    function run() external returns (NabungMultiLzRouter router) {
        Config memory c = load();
        if (vm.getNonce(c.administrator) != c.expectedNonce) revert InvalidMultichainConfig();
        vm.startBroadcast(c.administrator);
        router = new NabungMultiLzRouter(
            c.endpoint, c.administrator, 40168, c.store, c.domain, c.eid, c.asset, c.pool, c.receipt, c.solana
        );
        vm.stopBroadcast();
        console2.log("Unsealed v2 router:", address(router));
        console2.log("V2 factory:", address(router.factory()));
    }
}
