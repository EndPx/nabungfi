// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ConfigureLayerZero, UlnConfig} from "../script/ConfigureLayerZero.s.sol";

contract LayerZeroConfigurationTest is Test {
    ConfigureLayerZero private tooling;

    function setUp() public {
        tooling = new ConfigureLayerZero();
    }

    function testExplicitRequiredDvnAndLiteralEmptyOptionalSet() public view {
        UlnConfig memory config = tooling.uln(address(0x123), 10);
        assertEq(config.confirmations, 10);
        assertEq(config.requiredDVNCount, 1);
        assertEq(config.requiredDVNs[0], address(0x123));
        assertEq(config.optionalDVNCount, 255);
        assertEq(config.optionalDVNThreshold, 0);
        assertEq(config.optionalDVNs.length, 0);
    }

    function testOfficialTypeThreeReceiveOptionsGolden() public view {
        assertEq(
            tooling.options(200000, 2500000),
            hex"00030100210100000000000000000000000000030d40000000000000000000000000002625a0"
        );
        assertEq(tooling.options(200000, 0), hex"00030100110100000000000000000000000000030d40");
    }

    function testEnvWidthOverflowRejected() public {
        vm.setEnv("NABUNGFI_TEST_TOO_WIDE", "18446744073709551616");
        vm.expectRevert(ConfigureLayerZero.InvalidConfiguration.selector);
        tooling.envBound("NABUNGFI_TEST_TOO_WIDE", type(uint64).max);
    }

    function testWrongChainConfigurationRejected() public {
        vm.chainId(1);
        ConfigureLayerZero.Config memory config;
        vm.expectRevert(ConfigureLayerZero.InvalidConfiguration.selector);
        tooling.validate(config);
    }
}
