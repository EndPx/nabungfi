# App integration readiness

The four-chain contract and keeper evidence is independent of application login and persistence. See the [concurrent-goal runbook](CONCURRENT_GOALS_RUNBOOK.md) for the completed cash lifecycle and its limits.

## Historical credential-preparation checkpoint

On 1 October 2026, the existing NabungFi Privy development app and Neon project were accessed through the owner's authenticated browser. A new equivalent Privy app secret was generated because previously created secrets cannot be revealed again. The existing secret was retained; no signing key, wallet authorization policy or production setting was rotated. Secret values are kept in ignored local files and are not part of this repository.

| Local destination | Variables | Purpose |
| --- | --- | --- |
| `apps/server/.env` | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `DATABASE_URL` | Server authentication and database integration |
| `apps/web/.env` | `VITE_PRIVY_APP_ID` | Public frontend app identifier only |

The Neon connection targets the existing `neondb` database on the existing default branch named `production`, using its pooled endpoint and `sslmode=require`. That branch name does not establish a production release of NabungFi. At this initial credential-preparation checkpoint, no database branch, role, schema, migration or application data had been created or changed. The subsequent backend implementation below supersedes that initial database status.

The saved configuration was checked for the expected app ID, secret presence, valid database URL, TLS requirement, frontend/server separation and Git exclusion. Those initial file checks did not establish application authentication or a live PostgreSQL connection; subsequent provider and persistence evidence is recorded below.

## Current backend evidence and remaining acceptance

The authenticated server loads and validates its private settings, verifies Privy access tokens with the official SDK, and reads authoritative linked wallets. Actual Privy server-credential authentication and a real Neon connection passed. Migrations 1-9 are applied and idempotent; 41 real-Neon checks passed and removed only unique test-owner rows, with zero financial transactions. The server passes 40 tests; the shared package passes 17 tests. Authenticated goals have immutable independent onchain bindings and durable wallet-step journals.

The direct Node API and permissionless worker run locally. The API checks a fresh broadcast-enabled worker heartbeat and admits at most six active goals, with separate retained history. Docker is not required. Read-only actual contract snapshots and historical receipt checks remain separate evidence from a fresh wallet-signed user flow.

A genuine owner Privy browser session returned HTTP 200 from `/api/session` and `/api/goals` after reload, with authoritative linked EVM and Solana wallets and distinct database UUID/Privy subject. No token was copied and no financial transaction was executed in that check. An owner-signed API lifecycle and exact financial reconciliation remain separate acceptance gates. The integration UI is retained locally as a test client; its publication and visual work are paused while backend acceptance is completed. Hosted supervision, TLS and reboot recovery need host-level validation after VPS access is supplied. See [backend release gates](BACKEND_RELEASE_GATES.md).

`PRIVY_APP_SECRET`, the database URL/password and signer material must stay server-side. Application source is now included in this public repository under the owner's 1 October 2026 authorization; real `.env` files, private state and credentials remain excluded. Preparing credentials does not change the previously demonstrated cash-only strategy scope or enable earning.
