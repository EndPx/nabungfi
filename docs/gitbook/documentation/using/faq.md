---
description: "Answers to the actual savings, model, wallet and recovery states."
---

# Frequently Asked Questions

## Is this a mainnet savings account?

The current release is a cash-only testnet application on Solana Devnet and three EVM Sepolia networks. Real yield and a reviewed mainnet launch are separate planned work.

## Can I create several goals?

Yes. Each goal has independent owners, target, balances and lifecycle. A portfolio total or another goal’s assets cannot satisfy its target.

## Why is the goal 100% funded but the model has 99 pieces?

Funding the target is not the same as verified achievement. The final piece waits for completion to be verified. Before then, Prepare completion or a clear synchronization/verification status explains the next step.

## Why does Base matter if all my USDC is on Solana?

Every chain selected at creation is a participant. A zero-balance participant still acknowledges the completion round. Waiting for chains prevents a local unlocked state from bypassing the all-vault guard.

## Does Cancel completion return my money?

It stops the current completion round and returns the protocol to saving after acknowledgments. USDC remains in the goal vaults. It is not a withdrawal or refund.

## Can I withdraw before reaching the target?

The current goal lock does not offer an early owner withdrawal. Funds remain locked until the goal’s target and verified completion conditions are satisfied. Consider that commitment before depositing.

## Does rotating, assembling or replaying the model change money?

No. Those actions are visual. Deposits and claims are separately reviewed wallet operations whose original receipts are verified.

## Where does a claim send USDC?

Each local vault sends to its recorded owner on that network. The app does not automatically bridge the returned USDC or buy the object shown by the model.

## Are all transactions free?

Eligible embedded owners can request configured testnet sponsorship. External direct wallets pay their own network fees. Sponsorship remains subject to provider eligibility and service availability; it is not guaranteed free mainnet gas.

## Why does an explorer say Unknown Program or Unknown Instruction?

An explorer can lack a decoder or registered metadata for a custom program. That label alone does not establish failure. Inspect the transaction result, exact program/account identities and verified token effects; the app’s receipt checker also validates those boundaries.

## What if a wallet request was interrupted?

Preserve the original request and hash. Use recovery to check its outcome. An expired unsigned plan can be refreshed; an attempted or uncertain transaction cannot simply be treated as never sent.

## How do I update the installed PWA?

Use Update when the new-version notice is available, then reload or reopen. An unresolved wallet request blocks update activation until recovery is completed. The shell does not queue financial operations while offline.

## Does a completed goal refund its Solana rent?

The active goal interface does not include a rent-reclamation close instruction. USDC claims and account storage reserves are separate.
