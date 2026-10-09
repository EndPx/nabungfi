---
description: "Chain-local USDC custody on Arbitrum Sepolia."
---

# Arbitrum Sepolia

| Setting | Value |
| --- | --- |
| Network | Arbitrum Sepolia |
| Chain ID | 421614 |
| NabungFi domain | 3 |
| LayerZero endpoint ID | 40231 |
| Savings asset | Circle testnet USDC, 6 decimals |
| Native gas | ETH |

## Active Contracts and Addresses

| Component | Address |
| --- | --- |
| Goal router | [0xd524e3d9e7f0b419a862b4ad854422d573b5d651](https://sepolia.arbiscan.io/address/0xd524e3d9e7f0b419a862b4ad854422d573b5d651) |
| Goal vault factory | [0x20a585751c48d4341c27cc0d91bd4ed6b621626f](https://sepolia.arbiscan.io/address/0x20a585751c48d4341c27cc0d91bd4ed6b621626f) |
| Circle testnet USDC | [0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d](https://sepolia.arbiscan.io/address/0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d) |
| Recorded component deployer | [0xc82f469Aa95a2f7792300c8d11230e9023A98600](https://sepolia.arbiscan.io/address/0xc82f469Aa95a2f7792300c8d11230e9023A98600) |

The factory provisions a dedicated vault for each goal. The vault binds owner, asset, target, goal ID and coordinator configuration. The router carries the authenticated transport path; its address is not the owner’s goal-specific deposit address.

Find the actual goal vault through its explorer link in Where your pieces are. Wallets shows the owner’s USDC and ETH separately on this network. A balance on another EVM network is not available here just because the address is identical.

An Aave adapter is available in the contract source and has separate fork evidence. The current browser application and recorded four-chain cash lifecycle do not demonstrate realized earning.

The deployment manifest records creation transactions, route/configuration facts and public component identities. Source: [Arbitrum Sepolia v2 manifest](https://github.com/EndPx/nabungfi/blob/main/contracts/deployments/multichain/arbitrum-sepolia.json).
