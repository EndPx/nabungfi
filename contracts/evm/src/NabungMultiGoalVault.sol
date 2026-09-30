// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {NabungGoalVault} from "./NabungGoalVault.sol";

/// @notice Reuses reviewed goal accounting with an immutable v2 participant domain.
contract NabungMultiGoalVault is NabungGoalVault {
    uint32 public immutable participantDomain;

    constructor(GoalConfig memory config, address asset_, address pool_, address receipt_, uint32 domain_)
        NabungGoalVault(config, asset_, pool_, receipt_)
    {
        if (domain_ < 2 || domain_ > 4) revert InvalidConfiguration();
        participantDomain = domain_;
    }

    function destinationDomain() public view override returns (uint32) {
        return participantDomain;
    }
}
