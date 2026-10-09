---
description: "Chain-local USDC custody on Ethereum Sepolia."
---

# Ethereum Sepolia

| Setting | Value |
| --- | --- |
| Network | Ethereum Sepolia |
| Chain ID | 11155111 |
| NabungFi domain | 4 |
| LayerZero endpoint ID | 40161 |
| Savings asset | Circle testnet USDC, 6 decimals |
| Native gas | ETH |

## Active Contracts and Addresses

| Component | Address |
| --- | --- |
| Goal router | [0xd524e3d9e7f0b419a862b4ad854422d573b5d651](https://sepolia.etherscan.io/address/0xd524e3d9e7f0b419a862b4ad854422d573b5d651) |
| Goal vault factory | [0x20a585751c48d4341c27cc0d91bd4ed6b621626f](https://sepolia.etherscan.io/address/0x20a585751c48d4341c27cc0d91bd4ed6b621626f) |
| Circle testnet USDC | [0x1c7d4b196cb0c7b01d743fbc6116a902379c7238](https://sepolia.etherscan.io/address/0x1c7d4b196cb0c7b01d743fbc6116a902379c7238) |
| Recorded component deployer | [0xc82f469Aa95a2f7792300c8d11230e9023A98600](https://sepolia.etherscan.io/address/0xc82f469Aa95a2f7792300c8d11230e9023A98600) |

The factory provisions a dedicated vault for each goal. The vault binds owner, asset, target, goal ID and coordinator configuration. The router carries the authenticated transport path; its address is not the owner’s goal-specific deposit address.

Find the actual goal vault through its explorer link in Where your pieces are. Wallets shows the owner’s USDC and ETH separately on this network. A balance on another EVM network is not available here just because the address is identical.

The application currently uses cash-only goal vaults on this network. No strategy yield is represented as active.

The deployment manifest records creation transactions, route/configuration facts and public component identities. Source: [Ethereum Sepolia v2 manifest](https://github.com/EndPx/nabungfi/blob/main/contracts/deployments/multichain/ethereum-sepolia.json).
