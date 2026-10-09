---
description: "Collect local savings after all selected vaults confirm achievement."
---

# Claims and Accounting

When the coordinator has achieved the goal and every selected position has committed achievement, available savings can be claimed. The owner confirms each chain-local claim. The API checks the exact original transaction and the resulting USDC effects before recording confirmation.

## Funds return on their own network

A Solana claim returns Solana USDC to the Solana owner wallet. A Base claim returns Base USDC to the EVM owner on Base. The same EVM address may be used on other EVM networks, but each has a separate balance. Completion does not automatically bridge USDC or purchase the object represented by the model.

## Current assets and historical achievement

Current savings decreases as claims remove assets from vaults. Collected amounts and achieved totals remain in the goal history. A complete build therefore stays visible after current vault assets reach zero.

| Quantity | Meaning |
| --- | --- |
| Current assets | USDC still in this goal’s vaults |
| Claimed amount | USDC already returned through confirmed claims |
| Achieved total | The permanent total established at verified achievement |
| Wallet balance | Spendable USDC outside goal vaults |

For a cash-only example, 8 USDC on Solana and 3 USDC on Base meet a 10-USDC target with 11 USDC total. After verified completion and both claims, current goal assets are zero and total claimed is 11 USDC. The app retains the completed 100-piece model and the historical amount.

Claim eligibility remains contract- and state-derived. A yellow Claim signals an available action; a waiting state never relaxes the all-vault guard. Solana storage reserves are separate from USDC claims and are not currently reclaimed by a goal-close instruction.
