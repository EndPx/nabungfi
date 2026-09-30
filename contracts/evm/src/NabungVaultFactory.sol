// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {NabungGoalVault} from "./NabungGoalVault.sol";
import {NabungWire} from "./NabungWire.sol";

/// @notice Creates only genuine NabungGoalVault instances for the registered OApp.
contract NabungVaultFactory {
    struct SolanaDeployment {
        bytes32 program;
        bytes32 usdcMint;
        bytes32 kaminoMarket;
        bytes32 kaminoReserve;
        bytes32 collateralMint;
        bytes32 liquiditySupply;
        bytes32 transportProgram;
    }

    struct GoalRequest {
        bytes32 goalId;
        bytes32 solanaOwner;
        bytes32 solanaGoal;
        uint64 target;
        uint256 minimumIdle;
    }

    address public immutable router;
    address public immutable asset;
    address public immutable pool;
    address public immutable receipt;
    SolanaDeployment public solana;
    uint64 public creationNonce = 1;

    error Unauthorized();
    error InvalidGoal();

    constructor(address asset_, address pool_, address receipt_, SolanaDeployment memory solana_) {
        if (asset_.code.length == 0 || pool_.code.length == 0 || receipt_.code.length == 0) {
            revert InvalidGoal();
        }
        router = msg.sender;
        asset = asset_;
        pool = pool_;
        receipt = receipt_;
        solana = solana_;
        if (
            solana_.program == 0 || solana_.usdcMint == 0 || solana_.kaminoMarket == 0
                || solana_.kaminoReserve == 0 || solana_.collateralMint == 0 || solana_.liquiditySupply == 0
                || solana_.transportProgram == 0
        ) revert InvalidGoal();
    }

    function create(address owner, GoalRequest calldata request) external returns (NabungGoalVault vault) {
        if (msg.sender != router) revert Unauthorized();
        if (request.goalId == 0 || request.solanaOwner == 0 || request.solanaGoal == 0 || request.target == 0)
        {
            revert InvalidGoal();
        }
        address predicted = predictNextVault();
        bytes32 configHash = configurationHash(owner, request, predicted);
        ++creationNonce;
        vault = new NabungGoalVault(
            NabungGoalVault.GoalConfig({
                owner: owner,
                goalId: request.goalId,
                configHash: configHash,
                target: request.target,
                messenger: router,
                sourceCoordinator: request.solanaGoal,
                minimumIdle: request.minimumIdle
            }),
            asset,
            pool,
            receipt
        );
        if (address(vault) != predicted) revert InvalidGoal();
    }

    /// @dev CREATE identity is computed inside the transaction; a concurrent creator cannot misbind it.
    function predictNextVault() public view returns (address) {
        uint64 nonce = creationNonce;
        if (nonce < 128) {
            return address(
                uint160(uint256(keccak256(abi.encodePacked(hex"d694", address(this), bytes1(uint8(nonce))))))
            );
        }
        uint256 size = 0;
        for (uint64 remaining = nonce; remaining != 0; remaining >>= 8) {
            ++size;
        }
        bytes memory encoded = new bytes(size);
        for (uint256 i; i < size; ++i) {
            encoded[size - 1 - i] = bytes1(uint8(nonce >> (8 * i)));
        }
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(uint8(0xd6 + size)),
                            hex"94",
                            address(this),
                            bytes1(uint8(0x80 + size)),
                            encoded
                        )
                    )
                )
            )
        );
    }

    function configurationHash(address owner, GoalRequest calldata request, address vault)
        public
        view
        returns (bytes32)
    {
        return sha256(
            bytes.concat(
                abi.encodePacked(
                    "NABUNGFI_SOLANA_CONFIG_V1", solana.program, request.solanaGoal, request.solanaOwner
                ),
                abi.encodePacked(
                    request.goalId,
                    _littleEndian(request.target),
                    NabungWire.addressId(owner),
                    NabungWire.addressId(vault),
                    hex"02000000"
                ),
                abi.encodePacked(solana.usdcMint, solana.kaminoMarket, solana.kaminoReserve),
                abi.encodePacked(solana.collateralMint, solana.liquiditySupply, solana.transportProgram)
            )
        );
    }

    function _littleEndian(uint64 value) private pure returns (bytes8) {
        uint64 reversed = 0;
        for (uint256 i; i < 8; ++i) {
            reversed = (reversed << 8) | (value & 255);
            value >>= 8;
        }
        return bytes8(reversed);
    }
}
