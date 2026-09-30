// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {NabungGoalVault} from "./NabungGoalVault.sol";
import {NabungMultiGoalVault} from "./NabungMultiGoalVault.sol";
import {NabungWire} from "./NabungWire.sol";

/// @notice Creates v2 goal vaults whose leaf commits the EVM domain/EID, asset, router and actual vault.
contract NabungMultiVaultFactory {
    struct SolanaDeployment {
        bytes32 program;
        bytes32 usdcMint;
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
    uint32 public immutable domain;
    uint32 public immutable eid;
    SolanaDeployment public solana;
    uint64 public creationNonce = 1;

    error Unauthorized();
    error InvalidGoal();

    constructor(
        address asset_,
        address pool_,
        address receipt_,
        uint32 domain_,
        uint32 eid_,
        SolanaDeployment memory solana_
    ) {
        bool cashOnly = pool_ == address(0) && receipt_ == address(0);
        if (asset_.code.length == 0 || (!cashOnly && (pool_.code.length == 0 || receipt_.code.length == 0))) {
            revert InvalidGoal();
        }
        router = msg.sender;
        asset = asset_;
        pool = pool_;
        receipt = receipt_;
        domain = domain_;
        eid = eid_;
        solana = solana_;
        if (
            solana_.program == 0 || solana_.usdcMint == 0 || solana_.transportProgram == 0
                || !((domain_ == 2 && eid_ == 40245)
                    || (domain_ == 3 && eid_ == 40231)
                    || (domain_ == 4 && eid_ == 40161))
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
        vault = new NabungMultiGoalVault(
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
            receipt,
            domain
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
                    "NABUNGFI_MULTICHAIN_CONFIG_V2", solana.program, request.solanaGoal, request.solanaOwner
                ),
                abi.encodePacked(
                    request.goalId,
                    _littleEndian(request.target),
                    _littleEndian32(domain),
                    _littleEndian32(eid)
                ),
                abi.encodePacked(
                    solana.usdcMint,
                    NabungWire.addressId(asset),
                    NabungWire.addressId(router),
                    NabungWire.addressId(vault),
                    NabungWire.addressId(owner),
                    solana.transportProgram
                )
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

    function _littleEndian32(uint32 value) private pure returns (bytes4) {
        return
            bytes4((value >> 24) | ((value >> 8) & 0x0000ff00) | ((value << 8) & 0x00ff0000) | (value << 24));
    }
}
