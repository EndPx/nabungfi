# App integration readiness

The four-chain contract and keeper evidence is independent of application login and persistence. See the [concurrent-goal runbook](CONCURRENT_GOALS_RUNBOOK.md) for the completed cash lifecycle and its limits.

## Prepared local configuration

On 1 October 2026, the existing NabungFi Privy development app and Neon project were accessed through the owner's authenticated browser. A new equivalent Privy app secret was generated because previously created secrets cannot be revealed again. The existing secret was retained; no signing key, wallet authorization policy or production setting was rotated. Secret values are kept in ignored local files and are not part of this repository.

| Local destination | Variables | Purpose |
| --- | --- | --- |
| `apps/server/.env` | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `DATABASE_URL` | Future server authentication and database integration |
| `apps/web/.env` | `VITE_PRIVY_APP_ID` | Public frontend app identifier only |

The Neon connection targets the existing `neondb` database on the existing default branch named `production`, using its pooled endpoint and `sslmode=require`. That branch name does not establish a production release of NabungFi. No database branch, role, schema, migration or application data was created or changed.

The saved configuration was checked for the expected app ID, secret presence, valid database URL, TLS requirement, frontend/server separation and Git exclusion. These checks do **not** establish successful application authentication or a live PostgreSQL connection.

## Next implementation boundaries

1. Add explicit server environment loading/validation and integrate Privy authentication. The current local server does not consume these prepared settings yet. Bind each authenticated user to verified wallet ownership before authorizing a goal action.
2. Implement the owner-scoped multi-goal persistence model and migrations described in [multiple-goal requirements](MULTI_GOAL_REQUIREMENTS.md). Store metadata, history and delivery observations; onchain goal authorization, balances and achievement remain authoritative.
3. Connect the UI to the deployed testnet contracts and goal-specific deposit/claim flows. Verify actual wallet transactions, cross-chain reconciliation, reload and retry behavior before reporting application completion.
4. Put the reviewed keeper under hosted supervision with durable private journals and monitored native-fee budgets. Its existing local WSL daemon cannot operate while the host sleeps or goes offline.

`PRIVY_APP_SECRET`, the database URL/password and signer material must stay server-side. Application source is now included in this public repository under the owner's 1 October 2026 authorization; real `.env` files, private state and credentials remain excluded. Preparing credentials does not change the previously demonstrated cash-only strategy scope or enable earning.
