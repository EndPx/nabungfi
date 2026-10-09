---
description: "Shared program logic, per-goal accounts and canonical Devnet USDC."
---

# Solana Devnet

| Setting | Value |
| --- | --- |
| Network | Solana Devnet |
| LayerZero endpoint ID | 40168 |
| Savings asset | Circle Devnet USDC, 6 decimals |
| Native gas | SOL |

## Active Contracts and Addresses

| Component | Address |
| --- | --- |
| Goal core program | [FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn](https://explorer.solana.com/address/FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn?cluster=devnet) |
| LayerZero transport program | [G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d](https://explorer.solana.com/address/G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d?cluster=devnet) |
| OApp store | [v4GPUZ7BbKvpzyrtTBXYsASXcDKiC4TZppZaRSeudrp](https://explorer.solana.com/address/v4GPUZ7BbKvpzyrtTBXYsASXcDKiC4TZppZaRSeudrp?cluster=devnet) |
| Circle Devnet USDC mint | [4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU](https://explorer.solana.com/address/4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU?cluster=devnet) |
| Recorded program upgrade authority | [AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8](https://explorer.solana.com/address/AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8?cluster=devnet) |

Every goal derives its own state PDA and cash token account from the immutable owner/goal identity. Use that goal’s vault explorer link in the app to inspect its actual cash account. Do not treat the shared program ID as a personal savings account.

The program deployment/storage reserve is shared infrastructure; initialization allocates per-goal accounts. Both require separate understanding from transaction fees. The source initializer uses an owner payer; eligible sponsorship can provide narrowly verified account-creation funding without replacing the goal’s owner. The active interface has no rent-close/reclamation instruction.

The manifest records finalized program deployment and downloaded ELF comparisons for this testnet release. Retained upgrade authority remains a trust boundary. Source: [Solana v2 deployment manifest](https://github.com/EndPx/nabungfi/blob/main/contracts/deployments/multichain/solana-devnet.json).
