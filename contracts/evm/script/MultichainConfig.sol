// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Script} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IAaveReceipt} from "../src/AaveSupplyAdapter.sol";
import {NabungMultiVaultFactory} from "../src/NabungMultiVaultFactory.sol";

interface IMultichainEndpoint {
    function eid() external view returns (uint32);
}

abstract contract MultichainConfig is Script {
    struct Config {
        uint32 domain;
        uint32 eid;
        address administrator;
        address endpoint;
        address asset;
        address pool;
        address receipt;
        address router;
        uint64 expectedNonce;
        address sendLibrary;
        address receiveLibrary;
        address executor;
        address dvn;
        uint64 sendConfirmations;
        uint64 receiveConfirmations;
        bytes32 store;
        NabungMultiVaultFactory.SolanaDeployment solana;
    }
    error InvalidMultichainConfig();

    function matchesSecurity(Config memory c) public pure returns (bool) {
        if (c.endpoint != 0x6EDCE65403992e310A62460808c4b910D972f10f || c.receiveConfirmations != 10) {
            return false;
        }
        if (c.domain == 2 && c.eid == 40245) {
            return c.sendConfirmations == 2 && c.sendLibrary == 0xC1868e054425D378095A003EcbA3823a5D0135C9
                && c.receiveLibrary == 0x12523de19dc41c91F7d2093E0CFbB76b17012C8d
                && c.executor == 0x8A3D588D9f6AC041476b094f97FF94ec30169d3D
                && c.dvn == 0xe1a12515F9AB2764b887bF60B923Ca494EBbB2d6;
        }
        if (c.domain == 3 && c.eid == 40231) {
            return c.sendConfirmations == 1
                && c.sendLibrary == address(0x004f7cd4da19abb31b0ec98b9066b9e857b1bf9c0e)
                && c.receiveLibrary == address(0x0075db67cdab2824970131d5aa9cecfc9f69c69636)
                && c.executor == address(0x005df3a1cebbd9c8ba7f8df51fd632a9aef8308897)
                && c.dvn == address(0x0053f488e93b4f1b60e8e83aa374dbe1780a1ee8a8);
        }
        if (c.domain == 4 && c.eid == 40161) {
            return c.sendConfirmations == 2
                && c.sendLibrary == address(0x00cc1ae8cf5d3904cef3360a9532b477529b177cce)
                && c.receiveLibrary == address(0x00daf00f5ee2158dd58e0d3857851c432e34a3a851)
                && c.executor == address(0x00718b92b5cb0a5552039b593faf724d182a881eda)
                && c.dvn == address(0x008eebf8b423b73bfca51a1db4b7354aa0bfca9193);
        }
        return false;
    }

    function prefix(uint256 id) public pure returns (string memory) {
        if (id == 84532) return "BASE_SEPOLIA";
        if (id == 421614) return "ARBITRUM_SEPOLIA";
        if (id == 11155111) return "ETHEREUM_SEPOLIA";
        revert InvalidMultichainConfig();
    }

    function bounded(string memory name, uint256 max) public view returns (uint256 value) {
        value = vm.envUint(name);
        if (value > max) revert InvalidMultichainConfig();
    }

    function load() public view returns (Config memory c) {
        string memory p = prefix(block.chainid);
        string memory v = string.concat("MULTI_", p);
        c.domain = block.chainid == 84532 ? 2 : block.chainid == 421614 ? 3 : 4;
        c.eid = block.chainid == 84532 ? 40245 : block.chainid == 421614 ? 40231 : 40161;
        c.administrator = vm.envAddress("DEPLOYER_ADDRESS");
        c.endpoint = vm.envAddress(string.concat(p, "_ENDPOINT"));
        c.asset = vm.envAddress(string.concat(p, "_USDC"));
        c.pool = vm.envAddress(string.concat(p, "_AAVE_POOL"));
        c.receipt = vm.envAddress(string.concat(p, "_ATOKEN"));
        c.router = vm.envOr(string.concat(v, "_ROUTER"), address(0));
        c.expectedNonce = uint64(bounded(string.concat(v, "_EXPECTED_DEPLOYER_NONCE"), type(uint64).max));
        c.sendLibrary = vm.envAddress(string.concat(p, "_LZ_SEND_LIBRARY"));
        c.receiveLibrary = vm.envAddress(string.concat(p, "_LZ_RECEIVE_LIBRARY"));
        c.executor = vm.envAddress(string.concat(p, "_LZ_EXECUTOR"));
        c.dvn = vm.envAddress(string.concat(p, "_LZ_REQUIRED_DVN"));
        c.sendConfirmations = uint64(bounded(string.concat(p, "_LZ_SEND_CONFIRMATIONS"), type(uint64).max));
        c.receiveConfirmations =
            uint64(bounded(string.concat(p, "_LZ_RECEIVE_CONFIRMATIONS"), type(uint64).max));
        c.store = vm.envBytes32("MULTI_SOLANA_DEVNET_STORE");
        c.solana = NabungMultiVaultFactory.SolanaDeployment(
            vm.envBytes32("MULTI_SOLANA_DEVNET_CORE_PROGRAM"),
            vm.envBytes32("SOLANA_DEVNET_USDC"),
            vm.envBytes32("MULTI_SOLANA_DEVNET_TRANSPORT_PROGRAM")
        );
        address canonicalAsset = block.chainid == 84532
            ? 0x036CbD53842c5426634e7929541eC2318f3dCF7e
            : block.chainid == 421614
                ? 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
                : 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        if (
            !matchesSecurity(c) || c.administrator == address(0) || c.endpoint.code.length == 0
                || IMultichainEndpoint(c.endpoint).eid() != c.eid || c.asset != canonicalAsset
                || IERC20Metadata(c.asset).decimals() != 6 || c.sendLibrary.code.length == 0
                || c.receiveLibrary.code.length == 0 || c.executor.code.length == 0 || c.dvn.code.length == 0
                || c.sendConfirmations == 0 || c.receiveConfirmations == 0
                || c.sendConfirmations == type(uint64).max || c.receiveConfirmations == type(uint64).max
                || c.store != 0x0d97799798af49b3251411c02453ff7cd0437de31c10fa7b62384a633a6be6e9
                || c.solana.program != 0xd79d40044d13e22c11e3a0b3f74fc8aee1828edcf10cdd4d60cb30a10f2a5ca5
                || c.solana.transportProgram
                    != 0xdf3c272fb477b082327a2f5e9c7f8a2c6cc3d6ea22fda0e676ba62324f5f646c
                || c.solana.usdcMint != 0x3b442cb3912157f13a933d0134282d032b5ffecd01a2dbf1b7790608df002ea7
        ) revert InvalidMultichainConfig();
        if (c.pool == address(0) || c.receipt == address(0)) {
            if (c.pool != address(0) || c.receipt != address(0)) revert InvalidMultichainConfig();
        } else if (
            c.pool.code.length == 0 || c.receipt.code.length == 0 || IAaveReceipt(c.receipt).POOL() != c.pool
                || IAaveReceipt(c.receipt).UNDERLYING_ASSET_ADDRESS() != c.asset
        ) {
            revert InvalidMultichainConfig();
        }
    }
}
