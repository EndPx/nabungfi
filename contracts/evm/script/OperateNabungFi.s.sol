// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    MessagingFee,
    MessagingReceipt
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {ConfigureLayerZero} from "./ConfigureLayerZero.s.sol";
import {NabungLzRouter} from "../src/NabungLzRouter.sol";
import {NabungGoalVault} from "../src/NabungGoalVault.sol";
import {NabungVaultFactory} from "../src/NabungVaultFactory.sol";

/// @notice Individually invoked, guarded testnet lifecycle steps. Each invocation simulates before broadcast.
/// @dev Broadcast only after checking the preceding receipt and updating EXPECTED_OPERATION_NONCE.
contract OperateNabungFi is Script {
    error InvalidOperation();

    function context() internal returns (NabungLzRouter router, address owner) {
        ConfigureLayerZero tooling = new ConfigureLayerZero();
        ConfigureLayerZero.Config memory config = tooling.load();
        tooling.assertReadback(config);
        owner = config.administrator;
        router = NabungLzRouter(config.router);
        if (vm.getNonce(owner) != vm.envUint("EXPECTED_OPERATION_NONCE")) revert InvalidOperation();
    }

    function request() internal view returns (NabungVaultFactory.GoalRequest memory r) {
        uint256 target = vm.envUint("GOAL_TARGET_RAW");
        if (target == 0 || target > type(uint64).max) revert InvalidOperation();
        r = NabungVaultFactory.GoalRequest(
            vm.envBytes32("GOAL_ID"),
            vm.envBytes32("SOLANA_GOAL_OWNER"),
            vm.envBytes32("SOLANA_GOAL_ACCOUNT"),
            uint64(target),
            vm.envUint("GOAL_MINIMUM_IDLE_RAW")
        );
    }

    function goal(NabungLzRouter router, address owner) internal view returns (NabungGoalVault vault) {
        address account = vm.envAddress("BASE_GOAL_VAULT");
        NabungVaultFactory.GoalRequest memory r = request();
        vault = NabungGoalVault(account);
        if (
            !router.isVault(account) || vault.owner() != owner || vault.goalId() != r.goalId
                || vault.sourceCoordinator() != r.solanaGoal || vault.target() != r.target
                || vault.minimumIdle() != r.minimumIdle
                || vault.configHash() != router.factory().configurationHash(owner, r, account)
        ) revert InvalidOperation();
    }

    function receiveOptions() public returns (bytes memory) {
        ConfigureLayerZero tooling = new ConfigureLayerZero();
        return tooling.options(
            uint128(tooling.envBound("SOLANA_DEVNET_LZ_RECEIVE_COMPUTE", type(uint128).max)),
            uint128(tooling.envBound("SOLANA_DEVNET_LZ_RECEIVE_LAMPORTS", type(uint128).max))
        );
    }

    function feeChecked(MessagingFee memory fee) internal view returns (uint256) {
        if (fee.lzTokenFee != 0 || fee.nativeFee == 0 || fee.nativeFee > vm.envUint("MAX_MESSAGE_FEE_WEI")) {
            revert InvalidOperation();
        }
        return fee.nativeFee;
    }

    /// @dev Irreversible: router owner becomes zero and Endpoint delegate becomes router.
    /// Root operator must also verify Solana explicit configuration and discovery before invoking.
    function seal() external {
        (NabungLzRouter router, address owner) = context();
        if (router.routeSealed() || router.owner() != owner) revert InvalidOperation();
        vm.startBroadcast(owner);
        router.sealRoute();
        vm.stopBroadcast();
        if (!router.routeSealed() || router.owner() != address(0)) revert InvalidOperation();
    }

    function create() external returns (address account) {
        (NabungLzRouter router, address owner) = context();
        if (
            !router.routeSealed()
                || router.factory().creationNonce() != vm.envUint("EXPECTED_FACTORY_CREATION_NONCE")
        ) {
            revert InvalidOperation();
        }
        address predicted = router.factory().predictNextVault();
        if (predicted != vm.envAddress("BASE_GOAL_VAULT")) revert InvalidOperation();
        NabungVaultFactory.GoalRequest memory r = request();
        vm.startBroadcast(owner);
        account = router.createGoal(r);
        vm.stopBroadcast();
        if (account != predicted) revert InvalidOperation();
        console2.log("Created actual goal vault:", account);
        console2.logBytes32(NabungGoalVault(account).configHash());
    }

    function deposit() external {
        (NabungLzRouter router, address owner) = context();
        NabungGoalVault vault = goal(router, owner);
        uint256 amount = vm.envUint("GOAL_DEPOSIT_RAW");
        IERC20 asset = IERC20(router.factory().asset());
        if (!router.isGoalRegistered(address(vault)) || amount == 0 || asset.balanceOf(owner) < amount) {
            revert InvalidOperation();
        }
        uint256 beforeBalance = asset.balanceOf(address(vault));
        vm.startBroadcast(owner);
        asset.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopBroadcast();
        if (asset.balanceOf(address(vault)) != beforeBalance + amount) revert InvalidOperation();
    }

    function registration() external returns (MessagingReceipt memory receipt) {
        (NabungLzRouter router, address owner) = context();
        NabungGoalVault vault = goal(router, owner);
        bytes memory options = receiveOptions();
        uint256 fee = feeChecked(router.quoteRegistration(address(vault), options));
        vm.startBroadcast(owner);
        receipt = router.sendRegistration{value: fee}(address(vault), options);
        vm.stopBroadcast();
        console2.logBytes32(receipt.guid);
    }

    function progress() external returns (MessagingReceipt memory receipt) {
        (NabungLzRouter router, address owner) = context();
        NabungGoalVault vault = goal(router, owner);
        bytes memory options = receiveOptions();
        uint256 fee = feeChecked(router.quoteProgress(address(vault), options));
        vm.startBroadcast(owner);
        receipt = router.sendProgress{value: fee}(address(vault), options);
        vm.stopBroadcast();
        console2.logBytes32(receipt.guid);
    }

    function ready() external {
        (NabungLzRouter router, address owner) = context();
        NabungGoalVault vault = goal(router, owner);
        if (vault.phase() != NabungGoalVault.Phase.Preparing) revert InvalidOperation();
        vm.startBroadcast(owner);
        vault.markReady();
        vm.stopBroadcast();
        console2.log("Reserved actual USDC raw:", vault.preparedAssets());
    }

    function report() external returns (MessagingReceipt memory receipt) {
        (NabungLzRouter router, address owner) = context();
        NabungGoalVault vault = goal(router, owner);
        uint256 value = vm.envUint("GOAL_REPORT_SEQUENCE");
        if (value > type(uint64).max) revert InvalidOperation();
        uint64 sequence = uint64(value);
        bytes memory options = receiveOptions();
        uint256 fee = feeChecked(router.quoteReport(address(vault), sequence, options));
        vm.startBroadcast(owner);
        receipt = router.sendReport{value: fee}(address(vault), sequence, options);
        vm.stopBroadcast();
        console2.logBytes32(receipt.guid);
    }

    function claim() external {
        (NabungLzRouter router, address owner) = context();
        NabungGoalVault vault = goal(router, owner);
        uint256 amount = vm.envUint("GOAL_CLAIM_RAW");
        if (
            vault.phase() != NabungGoalVault.Phase.Achieved || amount == 0 || amount > vault.claimableAssets()
        ) {
            revert InvalidOperation();
        }
        vm.startBroadcast(owner);
        vault.claim(amount);
        vm.stopBroadcast();
        console2.log("Claimed actual USDC raw:", amount);
    }
}
