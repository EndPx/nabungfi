// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IAaveReceipt} from "../src/AaveSupplyAdapter.sol";
import {NabungVaultFactory} from "../src/NabungVaultFactory.sol";

interface IEndpointIdentity {
    function eid() external view returns (uint32);
}

/// @dev Deployment tooling only; no change to savings contracts or their deployed bytecode.
abstract contract NabungFiDeploymentConfig is Script {
    struct Config {
        uint256 chainId;
        uint32 eid;
        address administrator;
        uint64 expectedNonce;
        address endpoint;
        address asset;
        address pool;
        address receipt;
        bool cashOnly;
        uint32 solanaEid;
        bytes32 solanaOApp;
        NabungVaultFactory.SolanaDeployment solana;
    }

    error UnsupportedChain();
    error InvalidNetwork();
    error InvalidAsset();
    error InvalidSolanaProfile();

    function prefix(uint256 chainId) public pure returns (string memory) {
        if (chainId == 84532) return "BASE_SEPOLIA";
        if (chainId == 421614) return "ARBITRUM_SEPOLIA";
        if (chainId == 11155111) return "ETHEREUM_SEPOLIA";
        revert UnsupportedChain();
    }

    function loadConfig() internal view virtual returns (Config memory config) {
        config.chainId = vm.envUint("TESTNET_CHAIN_ID");
        string memory network = prefix(config.chainId);
        config.eid = envU32(string.concat(network, "_EID"));
        config.administrator = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 nonce = vm.envUint(string.concat(network, "_EXPECTED_DEPLOYER_NONCE"));
        if (nonce > type(uint64).max) revert InvalidNetwork();
        config.expectedNonce = uint64(nonce);
        config.endpoint = vm.envAddress(string.concat(network, "_ENDPOINT"));
        config.asset = vm.envAddress(string.concat(network, "_USDC"));
        config.pool = vm.envAddress(string.concat(network, "_AAVE_POOL"));
        config.receipt = vm.envAddress(string.concat(network, "_ATOKEN"));
        config.cashOnly = vm.envBool(string.concat(network, "_CASH_ONLY"));
        config.solanaEid = envU32("SOLANA_DEVNET_EID");
        config.solanaOApp = vm.envBytes32("SOLANA_DEVNET_STORE");
        config.solana = NabungVaultFactory.SolanaDeployment({
            program: vm.envBytes32("SOLANA_DEVNET_CORE_PROGRAM"),
            usdcMint: vm.envBytes32("SOLANA_DEVNET_USDC"),
            kaminoMarket: vm.envBytes32("SOLANA_DEVNET_KAMINO_MARKET"),
            kaminoReserve: vm.envBytes32("SOLANA_DEVNET_KAMINO_RESERVE"),
            collateralMint: vm.envBytes32("SOLANA_DEVNET_COLLATERAL_MINT"),
            liquiditySupply: vm.envBytes32("SOLANA_DEVNET_LIQUIDITY_SUPPLY"),
            transportProgram: vm.envBytes32("SOLANA_DEVNET_TRANSPORT_PROGRAM")
        });
        validate(config);
    }

    function envU32(string memory key) private view returns (uint32) {
        uint256 value = vm.envUint(key);
        if (value > type(uint32).max) revert InvalidNetwork();
        return uint32(value);
    }

    function validate(Config memory config) public view {
        prefix(config.chainId);
        uint32 expectedEid = config.chainId == 84532 ? 40245 : config.chainId == 421614 ? 40231 : 40161;
        if (
            config.chainId != block.chainid || config.administrator == address(0)
                || config.endpoint.code.length == 0 || config.eid != expectedEid
                || IEndpointIdentity(config.endpoint).eid() != expectedEid
        ) revert InvalidNetwork();
        if (
            config.asset != circleUsdc(config.chainId) || config.asset.code.length == 0
                || IERC20Metadata(config.asset).decimals() != 6
        ) revert InvalidAsset();
        if (config.cashOnly) {
            if (config.pool != address(0) || config.receipt != address(0)) revert InvalidAsset();
        } else {
            if (
                config.pool.code.length == 0 || config.receipt.code.length == 0
                    || IAaveReceipt(config.receipt).UNDERLYING_ASSET_ADDRESS() != config.asset
                    || IAaveReceipt(config.receipt).POOL() != config.pool
            ) revert InvalidAsset();
        }
        // The reviewed Devnet deployment is cash-only. These are public identities,
        // not usable Kamino market/reserve addresses; its core disables earning CPIs.
        bytes32 sentinel = 0x1b33c4559a2affe7d69e3aa38e66394675c1b3ea388c057e202cfb7946bf0ee5;
        if (
            config.solanaEid != 40168
                || config.solanaOApp != 0x454257dcb2f8449ec59059f823c55d3cc76f8aa49e6d9777e9545bbbfb30d382
                || config.solana.program != 0x2ae188a7b7cc530e87ee0df25e73fb9056462df6ebd65334555a9ef98f8829e3
                || config.solana.transportProgram
                    != 0xd9beb19dc5388856fe3b69f65d61dcb5965b3ed5c21a54e54ab54dda717813c5
                || config.solana.usdcMint
                    != 0x3b442cb3912157f13a933d0134282d032b5ffecd01a2dbf1b7790608df002ea7
                || config.solana.kaminoMarket != sentinel || config.solana.kaminoReserve != sentinel
                || config.solana.collateralMint != sentinel || config.solana.liquiditySupply != sentinel
        ) revert InvalidSolanaProfile();
    }

    function circleUsdc(uint256 chainId) public pure returns (address) {
        if (chainId == 84532) return 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        if (chainId == 421614) return 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
        if (chainId == 11155111) return 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        revert UnsupportedChain();
    }
}
