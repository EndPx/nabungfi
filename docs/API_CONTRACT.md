# Local prototype API

This document describes the implemented single-goal API. The product requires several concurrent goals per user; the collection, ownership and creation changes in [multiple-goal requirements](MULTI_GOAL_REQUIREMENTS.md) are pending. The current create-goal restriction below is a prototype limitation, not the intended product rule.

The API binds to localhost:3001. The web dev server proxies /api there. All amounts in responses are decimal USDC strings (six decimal places); financial state uses exact integer units internally. All responses are explicitly mode "local-demo". No API key or real wallet signing is used in this local demonstration.

`GET /api/state` returns `{ mode, goal, transactions, evidence }`.

`goal`: `{ id, name, target, status, principal, earnings, balance, progress, fundedPieces, achieved, chains }`. Status is `saving`, `preparing`, `ready`, `achieved`, or `closed`. `progress` is a number 0–100 for presentation. `fundedPieces` is 0–100, capped at 99 before committed achievement. After achievement it remains 100 while `balance` reflects remaining unclaimed funds.

`chains`: array of `{ chain: "solana" | "base", label, strategy, principal, earnings, balance, liquid, reserved, status, claimed }`. `transactions`: newest-first array `{ id, type, chain, amount, timestamp, status, description }`. `evidence`: `{ solana: string, base: string, messaging: string }` describing actual implementation evidence, never a false network receipt.

JSON POST actions return the updated state, or `{ error, code }` with an HTTP error status:

Every POST also requires `goalId` matching the goal the user saw. A stale-tab action returns `GOAL_CHANGED`; it must never silently fund a replacement goal. Demo reset issues a new goal identity. Persist unresolved request IDs, the goal identity and exact action before sending; a timeout is an unknown result, not evidence of failure. Retrying an already-applied action with its original goal ID is idempotent even after a reset.

- `/api/deposit`: `{ chain, amount, requestId }`. Positive USDC decimal, no more than six decimals. Allowed during saving/preparing, not once READY reserves are frozen. Abort/resume first if a Ready round needs a top-up. Request ID makes retries idempotent even across explicit demo resets.
- `/api/prepare`: `{ requestId }`. Starts a completion round only when current net assets meet the target.
- `/api/finalize`: `{ requestId }`. Requires both chains to have their entire goal amount reserved and summed net reserves to meet the target. Irreversible achievement.
- `/api/claim`: `{ chain, requestId }`. Only after achievement. Returns the whole local reserved amount; the other chain remains claimable.
- `/api/create-goal`: `{ name, target, requestId }`. Allowed only in an empty workspace or after the previous goal is fully claimed. A funded goal's target cannot be edited.
- `/api/demo/reset`: `{ requestId }`. Explicit demo-only reset to the sample goal; may be placed in a clearly labeled demo-settings panel.
- `/api/demo/yield`: `{ chain, amount, requestId }`. Explicit demo-only positive or negative net strategy change. Never presented as real protocol earnings.
- `/api/demo/liquidity`: `{ chain, amount, requestId }`. Explicit demo-only change to available strategy liquidity for failure exercises.
- `/api/refresh`: `{ requestId }`. Attempts pending local preparation/redemption again after liquidity improves.
- `/api/abort`: `{ requestId }`. Coordinator abort before achievement, invalidating that completion round and restoring saving; funds remain locked.

Assembly is a frontend interaction with a local replay cursor, not a POST that transfers funds. Per-piece thresholds are calculated after summing both chains. Preview/replay must never modify goal balances.

The initial sample is a 10,000 USDC "My first car" goal. Frontend uses GET state as the source of demo balances, rather than implementing a second financial ledger. Provide a persistent "Local demo · no real funds" indicator; no fake wallet connection or fake explorer link.
