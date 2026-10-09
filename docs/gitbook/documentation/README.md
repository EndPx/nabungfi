---
description: "Build what you\u2019re saving for."
---

# Overview

NabungFi helps people save USDC toward a specific goal across Solana and EVM networks. A user chooses what they are saving for, sets a target, and adds funds to dedicated goal vaults. Each deposit earns pieces of a 100-part model, making a long-term commitment visible as something taking shape.

The application supports Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. Funds remain in the vaults on the networks where they were deposited. LayerZero carries registration, balance and completion messages so one goal can be evaluated across its selected chains without moving all its assets onto one chain.

## A goal has its own commitment

A car, a laptop and a home can be saved for at the same time. Each has its own immutable target, wallet owners, vaults and completion history. The Dashboard’s portfolio balance helps the user understand their current savings, but it cannot unlock a goal whose own assets are below its target.

When a goal reaches its target, its owner requests completion. The contracts verify the selected vaults and their reserves before claims become available. A zero-balance selected chain still participates in this verification. The complete model stays in the Dashboard after collection, while the current savings total counts only funds that remain in vaults.

## Familiar access, inspectable actions

Users sign in with Google, email or a wallet through Privy. The app prepares missing embedded Ethereum and Solana wallet families before opening the workspace. Wallets shows USDC and native gas balances per network, and every vault and transaction reference can be opened in the appropriate explorer.

The API prepares unsigned transactions and verifies their original receipts. The user confirms financial actions in their wallet. Eligible embedded owners can request testnet gas sponsorship; sponsorship does not replace their approval.

## What is live today

The public application is a **cash-only testnet release**. Real browser-signed goal creation, deposits, message-driven completion and claims have been recorded across all four supported testnets. A separate Base + Solana run verified the sponsored embedded-wallet lifecycle. Yield strategies and a mainnet release remain planned; no savings return, audit or adoption figure is implied.

Open the [live app](https://nabungfi.endpx.cloud/app), follow [Getting Started](using/getting-started.md), or inspect the [technical overview](technical/overview.md).
