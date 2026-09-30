// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {NabungGoalVault} from "../../src/NabungGoalVault.sol";

/// @dev INSECURE TEST HARNESS. Anyone may deliver fabricated messages through this mock.
///      It is intentionally never an implementation of a production authenticated route.
contract MockMessageTransport {
    function isGoalRegistered(address) external pure returns (bool) {
        return true; // Test harness only; real registration requires authenticated messages.
    }

    function deliver(
        NabungGoalVault vault,
        uint32 sourceChain,
        bytes32 sender,
        NabungGoalVault.Command memory command
    ) external {
        vault.receiveCommand(sourceChain, sender, command);
    }
}
