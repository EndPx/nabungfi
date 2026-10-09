---
description: "What enforces the commitment and what the current release still depends on."
---

# Authorization and Trust Boundaries

The savings commitment depends on contract enforcement, immutable goal configuration and authenticated cross-chain messages. The interface explains and requests those actions, but it is not the authority that changes balances or declares a withdrawal valid.

| Actor or component | Authority | Boundary |
| --- | --- | --- |
| Goal owner | Confirm setup, deposits, preparation, cancellation and claims | Must match the immutable local owner |
| Authenticated API | Store owner-scoped metadata and verify unsigned plans/receipts | Does not sign owner financial operations |
| Core program and vaults | Enforce custody, lifecycle, reserves and owner claims | Subject to deployed code and configuration |
| Keeper | Bounded state-derived coordination and native fee payment | Cannot claim user savings or initiate permissionless-owner preparation |
| LayerZero peers/DVN/endpoint | Authenticate and deliver configured messages | Security and delivery dependencies remain material |
| Privy and sponsorship provider | Authenticate accounts, operate wallet signing and sponsored routes | Provider availability and exact receipt semantics must be checked |

## Current review and deployment scope

The public release is testnet cash custody. EVM source/fork checks, Solana native/SVM tests, real database checks and recorded browser-signed execution provide different forms of evidence. None is an independent security audit or a mainnet risk guarantee.

The deployed Solana programs retain recorded upgrade authority. The manifests also record transport peer/DVN configuration. EVM vault implementations are intended as immutable instances, while retained route and administration boundaries must be reviewed separately. Sealing a route is not the same as removing every external dependency.

## Commitment and liveness

The current lock offers no early owner withdrawal if the target is never reached. Cancellation changes a completion round; it does not refund deposits. Completion also depends on selected-participant messaging and bounded keeper operation. A funded UI percentage does not bypass a delayed or unavailable participant.

Mainnet launch requires an independent security review, deployment/upgrade policy, live strategy-specific evidence if earning is offered, sustained monitoring and adequate operating resources. These gates are [planned work](../mission/roadmap.md), not claims hidden behind the current demo.
