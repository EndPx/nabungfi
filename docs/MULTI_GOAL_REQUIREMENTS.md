# Multiple savings goals per user

Status: user-confirmed product requirement, 28 September 2026. Runtime migration is pending. This document is the canonical requirement for multiple goals and supersedes any interpretation that a user must finish one goal before opening another.

## Product behavior

One user can own several funded, active goals simultaneously, such as a car, a laptop and a house. Creating or viewing another goal must preserve all existing goals. A single model in the initial art prototype does not limit how many savings goals a user may have.

Each goal has its own identity, target, attributed deposits and net earnings, chain-local positions, completion rounds, claim status, transaction history and 100-piece visual progress. Goal names and model selection belong to offchain metadata; financial authorization remains bound to the goal's onchain owner/configuration.

## Isolation rules

1. Sum balances across registered chains within the same goal. Never use the user's portfolio total to unlock an individual goal.
2. Every deposit, redemption, preparation, report, completion and claim identifies its goal explicitly. Ownership and peer validation must include that identity.
3. A strategy receipt or USDC allocation belongs to one goal; it cannot fund progress or readiness for two goals. Another goal's funds cannot cover a shortfall.
4. Completing or claiming a laptop goal must not change the car/house balances, rounds, lock status or progress.
5. Creating an additional goal is allowed while others are funded or preparing. It must not replace an existing goal or relax its target lock.
6. Switching the selected goal is a UI action. An in-flight request keeps the original goal ID, payload and idempotency identity through retries and reconciliation.
7. Sequence numbers, readiness, abort state, keeper jobs and crosschain delivery must remain scoped to the relevant goal and round. Concurrent goals must not share a financial lifecycle counter.
8. A portfolio total is a display aggregate. Per-goal target locks, permanent achievement and local-chain claim rules continue to apply independently.

## Current implementation and required changes

| Component | Current evidence | Required work |
| --- | --- | --- |
| Solana | Goal PDA seeds contain owner and goal ID; seven new native tests cover goal-specific state and reject cross-goal custody/receiver substitution. | Prove multiple funded goals through actual SVM transactions and token/strategy CPI. |
| Base | Separate vault instances and a factory isolate goals; one actual cash goal has completed public pair registration, deposits, completion and claims. | Verify several simultaneously funded public goals and strategy operation; generalize to additional EVM peers. |
| Shared model | `Model.goal` contains one goal. Creating a goal requires the old one to be empty/closed and replaces it. | Introduce an owner-scoped goal collection and goal-targeted transitions. Preserve existing amounts, IDs, request records and history through a versioned migration. |
| API and persistence | State responses expose one `goal`; no authenticated user portfolio is implemented. | Add goal discovery/detail and creation of additional goals, owner authorization, goal-scoped history and retry reconciliation. |
| UI | One current goal and one roadster model. | Show a goals overview, add goal while others are active, select a goal and maintain separate detail/build/claim flows. Add appropriate models as assets become available. |
| Keeper/indexer | Operator-driven public Solana–Base delivery is proven for one cash goal; no persistent unattended worker is proven. | Schedule/reconcile work per goal, fund fees, and handle stalled operations independently. |

The planned collection (`goalsById` or an equivalent persistence schema) is offchain organization. `selectedGoalId` is presentation state and must never silently retarget a submitted financial operation. These names describe the next design, not existing API fields.

## Required acceptance evidence

- Create car, laptop and house goals for the same owner without closing or overwriting another goal.
- Deposit on Solana and Base into different goals; reconcile each goal's principal, earnings, balances and receipts independently.
- A portfolio total above a particular target cannot unlock that goal when its own reserves are below target.
- Complete and claim the laptop goal while car/house goals retain their exact balances and lifecycle states.
- Switch goals during a pending deposit, then retry/reload; credit only the original goal exactly once.
- Reject cross-goal account substitution and replayed/misrouted reports even when both goals have the same owner.
- Migrate the existing single-goal demo state without losing balances, request identities or activity history.

These are end-to-end acceptance requirements, not a completed application checklist. The [contract-first plan](CONTRACT_PLAN.md) distinguishes local multi-goal isolation from the separate public single-goal cash proof. The latter establishes authenticated delivery and cash claims for that goal, but not several concurrent public goals, strategy execution, application support or state migration.
