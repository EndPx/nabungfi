// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {console2} from "forge-std/Script.sol";
import {NabungFiDeploymentConfig} from "./NabungFiDeploymentConfig.sol";
import {NabungLzRouter} from "../src/NabungLzRouter.sol";

/// @notice Deploy unsealed components using a Foundry keystore supplied by CLI.
contract DeployNabungFi is NabungFiDeploymentConfig {
    error UnexpectedNonce();

    function run() external returns (NabungLzRouter router) {
        Config memory config = loadConfig();
        if (vm.getNonce(config.administrator) != config.expectedNonce) revert UnexpectedNonce();
        vm.startBroadcast(config.administrator);
        router = new NabungLzRouter(
            config.endpoint,
            config.administrator,
            config.solanaEid,
            config.solanaOApp,
            config.asset,
            config.pool,
            config.receipt,
            config.solana
        );
        vm.stopBroadcast();
        console2.log("Router (unsealed, zero goals):", address(router));
        console2.log("Factory:", address(router.factory()));
    }
}
