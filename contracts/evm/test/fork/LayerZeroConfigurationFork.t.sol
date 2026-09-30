// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    ILayerZeroEndpointV2,
    Origin,
    MessagingFee
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {ConfigureLayerZero} from "../../script/ConfigureLayerZero.s.sol";
import {NabungLzRouter} from "../../src/NabungLzRouter.sol";
import {NabungGoalVault} from "../../src/NabungGoalVault.sol";
import {NabungVaultFactory} from "../../src/NabungVaultFactory.sol";
import {NabungWire} from "../../src/NabungWire.sol";

/// @dev Local fork only: Endpoint caller injection models authenticated arrival, never proves DVN delivery.
contract LayerZeroConfigurationForkTest is Test {
    function testExplicitConfigSealGoalRealFeeAndReceiveGas() public {
        if (!vm.envOr("RUN_LZ_CONFIGURATION_FORK", false)) {
            vm.skip(true);
            return;
        }
        // Snapshot before public wiring, so this test continues exercising all four config mutations.
        vm.createSelectFork(vm.envString("BASE_SEPOLIA_RPC_URL"), 47500917);
        ConfigureLayerZero tooling = new ConfigureLayerZero();
        ConfigureLayerZero.Config memory config = tooling.load();
        tooling.run();
        tooling.assertReadback(config);
        NabungLzRouter router = NabungLzRouter(config.router);
        assertFalse(router.routeSealed());
        vm.prank(config.administrator);
        router.sealRoute();
        assertTrue(router.routeSealed());
        assertEq(router.owner(), address(0));
        NabungVaultFactory.GoalRequest memory request = NabungVaultFactory.GoalRequest(
            keccak256("local-configuration-fork"), bytes32(uint256(11)), bytes32(uint256(12)), 10_000_000, 0
        );
        vm.prank(config.administrator);
        NabungGoalVault vault = NabungGoalVault(router.createGoal(request));
        NabungWire.Packet memory packet;
        packet.kind = NabungWire.REGISTER;
        packet.sourceDomain = 1;
        packet.destinationDomain = 2;
        packet.goalId = request.goalId;
        packet.configHash = vault.configHash();
        packet.source = request.solanaGoal;
        packet.destination = NabungWire.addressId(address(vault));
        packet.baseOwner = NabungWire.addressId(config.administrator);
        packet.amount = request.target;
        packet.observation = 1;
        packet.observedAt = uint64(block.timestamp);
        Origin memory origin = Origin(40168, router.solanaOApp(), 1);
        bytes memory message = NabungWire.encode(packet);
        uint256 startGas = gasleft();
        vm.prank(config.endpoint);
        router.lzReceive(origin, bytes32(uint256(1)), message, address(0), "");
        uint256 registrationGas = startGas - gasleft();
        console2.log("Local fork REGISTER receive gas (including encoding/test caller):", registrationGas);
        assertLt(registrationGas, 300000);
        bytes memory options = tooling.options(200000, 2500000);
        MessagingFee memory fee = router.quoteRegistration(address(vault), options);
        assertGt(fee.nativeFee, 0);
        assertEq(fee.lzTokenFee, 0);
        console2.log("Actual vault REGISTERED real worker fee (wei):", fee.nativeFee);
        IERC20 usdc = IERC20(router.factory().asset());
        deal(address(usdc), config.administrator, 6_000_000);
        vm.startPrank(config.administrator);
        usdc.approve(address(vault), 6_000_000);
        vault.deposit(6_000_000);
        vm.stopPrank();
        packet.kind = NabungWire.PREPARE;
        packet.round = 1;
        packet.sequence = 1;
        packet.amount = 0;
        origin.nonce = 2;
        message = NabungWire.encode(packet);
        startGas = gasleft();
        vm.prank(config.endpoint);
        router.lzReceive(origin, bytes32(uint256(2)), message, address(0), "");
        uint256 prepareGas = startGas - gasleft();
        console2.log("Local fork PREPARE receive gas (including encoding/test caller):", prepareGas);
        assertLt(prepareGas, 500000);
        vault.markReady();
        fee = router.quoteReport(address(vault), 1, options);
        assertGt(fee.nativeFee, 0);
        console2.log("Actual vault READY real worker fee (wei):", fee.nativeFee);
        assertEq(vault.preparedAssets(), 6_000_000);
        packet.kind = NabungWire.COMMIT;
        packet.sequence = 2;
        packet.amount = 6_000_000;
        packet.aggregate = 10_000_000;
        origin.nonce = 3;
        message = NabungWire.encode(packet);
        startGas = gasleft();
        vm.prank(config.endpoint);
        router.lzReceive(origin, bytes32(uint256(3)), message, address(0), "");
        uint256 commitGas = startGas - gasleft();
        console2.log("Local fork COMMIT receive gas (test caller, warm state):", commitGas);
        assertLt(commitGas, 300000);
        assertEq(uint256(vault.phase()), uint256(NabungGoalVault.Phase.Achieved));
    }
}
