---
description: "Chain-local USDC custody on Base Sepolia."
---

# Base Sepolia

| Setting | Value |
| --- | --- |
| Network | Base Sepolia |
| Chain ID | 84532 |
| NabungFi domain | 2 |
| LayerZero endpoint ID | 40245 |
| Savings asset | Circle testnet USDC, 6 decimals |
| Native gas | ETH |

## Active Contracts and Addresses

| Component | Address |
| --- | --- |
| Goal router | [0xc3bf62a605f52a2ae238766a47b2f21623dfd1a1](https://sepolia.basescan.org/address/0xc3bf62a605f52a2ae238766a47b2f21623dfd1a1) |
| Goal vault factory | [0x3c981d151ec6060fd3f2307801d764fecb22c688](https://sepolia.basescan.org/address/0x3c981d151ec6060fd3f2307801d764fecb22c688) |
| Circle testnet USDC | [0x036cbd53842c5426634e7929541ec2318f3dcf7e](https://sepolia.basescan.org/address/0x036cbd53842c5426634e7929541ec2318f3dcf7e) |
| Recorded component deployer | [0xc82f469Aa95a2f7792300c8d11230e9023A98600](https://sepolia.basescan.org/address/0xc82f469Aa95a2f7792300c8d11230e9023A98600) |

The factory provisions a dedicated vault for each goal. The vault binds owner, asset, target, goal ID and coordinator configuration. The router carries the authenticated transport path; its address is not the owner’s goal-specific deposit address.

Find the actual goal vault through its explorer link in Where your pieces are. Wallets shows the owner’s USDC and ETH separately on this network. A balance on another EVM network is not available here just because the address is identical.

The application currently uses cash-only goal vaults on this network. No strategy yield is represented as active.

The deployment manifest records creation transactions, route/configuration facts and public component identities. Source: [Base Sepolia v2 manifest](https://github.com/EndPx/nabungfi/blob/main/contracts/deployments/multichain/base-sepolia.json).
