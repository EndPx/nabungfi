# Guided selected-chain vault setup — 8 October 2026

Create now saves the original goal metadata once and starts a guided setup for the immutable selected participant binding. The normal detail/build view appears after a fresh matching chain snapshot verifies every selected vault is initialized, registered and linked.

1. Prepare the first missing selected EVM vault using the existing unsigned-plan API and original request journal.
2. Display the existing transaction review, including the goal name, network, owner and fees. The owner confirms in Privy as before.
3. Reconcile the original transaction hash and load the verified updated binding before advancing to another selected EVM chain.
4. Initialize the Solana goal only after all selected EVM creation receipts/configurations are verified.
5. Wait for actual registration/acknowledgment delivery and per-chain linked state, then finish setup. While linking, refresh through the existing bounded read path at five-second intervals without overlapping reads.

Only `create-vault` and `initialize` can be selected by this workflow. It does not approve or deposit USDC, prepare achievement, claim funds, change a binding, or use an operator key to sign for the owner. Each selected network needs native gas; wallet approval and backend planning remain authoritative. The paid-provisioning capacity/availability guard remains unchanged.

The inline setup panel lists only Solana and the selected EVM participants. Existing incomplete goals offer Continue setup. A partial vault address/configuration/receipt or observed Solana initialization without its verified binding triggers verification rather than another creation. Unavailable, wrong-goal or wrong-target snapshots cannot advance the flow.

Pause, navigation away from the goal, rejection and failed/unknown signing outcomes stop the sequence. The original API and wallet journals remain intact. Resume skips confirmed vaults and requires original pending requests to be resolved first. Reload restores an owner-scoped paused marker; it never resends an uncertain transaction. Pausing while a plan request is in flight keeps that original recovery record but prevents its late response from reopening the wallet review.

## Verification

- **74 frontend unit tests passed**, including four setup checks covering selection/order, original receipt verification, fresh state/identity and owner-scoped paused restoration.
- **Six setup browser tests passed** with the production setup hook in an isolated StrictMode example fixture: sequential selected-chain setup at 320/390px, real-state registration gate, rejection/resume, paused reload, unresolved outcomes and a late plan after pause.
- The loading and vault-address regression run passed 14 of 15 checks initially. The unchanged 320px clipboard check timed out, then passed on its focused rerun. Original diagnostics are retained; no assertion was weakened.
- Production typechecking/build and the six-check production PWA release-shell suite passed.

Example fixtures create no actual wallets, vaults, signatures or payments. A fresh live owner-confirmed setup was not executed in this UI change. The existing onchain transaction builder, receipt reconciliation and earlier signed lifecycle evidence remain separate from the new sequencing tests. See [browser financial acceptance](BROWSER_E2E_ACCEPTANCE.md) and [wallet onboarding](WALLET_ONBOARDING.md).
