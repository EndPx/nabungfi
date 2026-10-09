---
description: "Current protocol-v2 testnet configuration and the scope of recorded execution."
---

# Chains

NabungFi currently connects Solana Devnet with Base, Arbitrum and Ethereum Sepolia. Each goal selects Solana and at least one of the three EVM peers. The target is evaluated within that goal’s immutable participant set.

| Network | Financial role | Native gas |
| --- | --- | --- |
| [Solana Devnet](solana-devnet.md) | Goal coordinator, local USDC custody and LayerZero transport | SOL |
| [Base Sepolia](base-sepolia.md) | Factory-created local USDC goal vaults | ETH |
| [Arbitrum Sepolia](arbitrum-sepolia.md) | Factory-created local USDC goal vaults | ETH |
| [Ethereum Sepolia](ethereum-sepolia.md) | Factory-created local USDC goal vaults | ETH |

## Recorded execution

The 7 October browser run completed three isolated car/laptop/house goals across all four networks: 51 confirmed original owner transactions, 12 claims and 103 independently checked delivered LayerZero packets. Vault assets ended at zero, and the funded USDC wallet baseline was restored on every chain. Source: [sanitized public browser evidence](https://github.com/EndPx/nabungfi/blob/main/contracts/deployments/backend/browser-e2e-2026-10-07.json).

The 9 October sponsored run separately verified an embedded-owner Base + Solana goal through eight original operations, including setup, deposits, preparation and claims. The stored original receipts and final RPC audit established unchanged owner native balances. Source: [sponsored acceptance](https://github.com/EndPx/nabungfi/blob/main/docs/SPONSORED_E2E_ACCEPTANCE.md).

Addresses identify deployed components; they do not establish realized strategy yield or independent audit status. Configuration on all four sponsorship networks is not counted as four completed sponsored lifecycles. Historical v1 manifests remain in the repository and should not be confused with the current v2 binding.
