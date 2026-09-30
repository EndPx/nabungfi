// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {DeployMultichain} from "../../script/DeployMultichain.s.sol";
import {ConfigureMultichain} from "../../script/ConfigureMultichain.s.sol";
import {MultichainConfig} from "../../script/MultichainConfig.sol";
import {NabungMultiLzRouter} from "../../src/NabungMultiLzRouter.sol";
import {NabungMultiVaultFactory} from "../../src/NabungMultiVaultFactory.sol";
import {NabungGoalVault} from "../../src/NabungGoalVault.sol";
import {NabungMultiWire} from "../../src/NabungMultiWire.sol";

/// @dev Fork only: public dependencies, artificial balances, injected Endpoint caller. No public delivery claim.
abstract contract MultichainDeploymentFork is Test {
    function network() internal pure virtual returns (string memory, uint256);

    function testDeployEntrypointConfigureRealWorkersAndCashGoal() public {
        if (!vm.envOr("RUN_MULTICHAIN_FORKS", false)) {
            vm.skip(true);
            return;
        }
        (string memory p, uint256 id) = network();
        vm.createSelectFork(vm.envString(string.concat(p, "_RPC_URL")));
        address owner = vm.envAddress("DEPLOYER_ADDRESS");
        string memory nonceKey = string.concat("MULTI_", p, "_EXPECTED_DEPLOYER_NONCE");
        vm.setEnv(nonceKey, vm.toString(vm.getNonce(owner)));
        NabungMultiLzRouter router = (new DeployMultichain()).run();
        assertEq(block.chainid, id);
        assertFalse(router.routeSealed());
        assertEq(router.domain(), id == 84532 ? 2 : id == 421614 ? 3 : 4);
        vm.setEnv(string.concat("MULTI_", p, "_ROUTER"), vm.toString(address(router)));
        vm.setEnv(nonceKey, vm.toString(vm.getNonce(owner)));
        ConfigureMultichain config = new ConfigureMultichain();
        config.run();
        MultichainConfig.Config memory c = config.load();
        config.assertReadback(c);
        vm.prank(owner);
        router.sealRoute();
        NabungMultiVaultFactory.GoalRequest memory request = NabungMultiVaultFactory.GoalRequest(
            keccak256("fork-v2"), bytes32(uint256(1)), bytes32(uint256(2)), 10e6, 0
        );
        vm.prank(owner);
        NabungGoalVault vault = NabungGoalVault(router.createGoal(request));
        NabungMultiWire.Packet memory register = NabungMultiWire.Packet(
            7,
            1,
            c.domain,
            request.goalId,
            vault.configHash(),
            request.solanaGoal,
            vault.vaultId(),
            NabungMultiWire.addressId(owner),
            0,
            0,
            10e6,
            0,
            1,
            1
        );
        bytes memory message = NabungMultiWire.encode(register);
        Origin memory origin = Origin(40168, c.store, 1);
        vm.prank(c.endpoint);
        router.lzReceive(origin, bytes32(uint256(1)), message, address(0), "");
        assertTrue(router.isGoalRegistered(address(vault)));
        uint256 fee = router.quoteRegistration(address(vault), config.options(200000, 2500000)).nativeFee;
        console2.log("Actual v2 worker quote (wei):", fee);
        assertGt(fee, 0);
        assertLt(fee, 1e15);
        IERC20 usdc = IERC20(c.asset);
        deal(c.asset, owner, 2e6);
        vm.startPrank(owner);
        usdc.approve(address(vault), 2e6);
        vault.deposit(2e6);
        vm.stopPrank();
        register.kind = 1;
        register.round = 1;
        register.sequence = 1;
        register.amount = 0;
        message = NabungMultiWire.encode(register);
        vm.prank(c.endpoint);
        router.lzReceive(origin, bytes32(uint256(2)), message, address(0), "");
        vault.markReady();
        assertEq(vault.preparedAssets(), 2e6);
        assertGt(router.quoteReport(address(vault), 1, config.options(200000, 2500000)).nativeFee, 0);
    }
}

contract MultichainBaseForkTest is MultichainDeploymentFork {
    function network() internal pure override returns (string memory, uint256) {
        return ("BASE_SEPOLIA", 84532);
    }
}

contract MultichainArbitrumForkTest is MultichainDeploymentFork {
    function network() internal pure override returns (string memory, uint256) {
        return ("ARBITRUM_SEPOLIA", 421614);
    }
}

contract MultichainEthereumForkTest is MultichainDeploymentFork {
    function network() internal pure override returns (string memory, uint256) {
        return ("ETHEREUM_SEPOLIA", 11155111);
    }
}
