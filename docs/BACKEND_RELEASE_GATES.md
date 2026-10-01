# Backend release gates

The backend release is separate from visual frontend completion. The existing UI can serve as an integration test client; production frontend publication and VPS provisioning follow backend acceptance.

## Required evidence

| Gate | Required result |
| --- | --- |
| Configuration | Required server settings fail closed; no credentials in source, build context, responses or logs |
| Identity | Official Privy token verification and authoritative linked-wallet lookup; distinguish Privy subject from database owner ID |
| Persistence | Real Neon connection, versioned idempotent migrations, owner isolation and explicit collection limits |
| Intent recovery | Immutable goal/action/amount identity, persistent wallet-start marker, sticky original hash, no automatic replacement for unknown outcomes |
| Receipt verification | Canonical network/owner/goal/calldata or Solana message plus actual token conservation; global receipt dedup only after ownership verification |
| Operator | Permissionless fee payer, no user financial authority, private durable journals, exclusive signer lock, fair scheduling and operational admission |
| Runtime | Healthy direct Node process, readiness/availability checks, clean shutdown and supervised operator instructions |
| Owner acceptance | A genuine Privy session, verified wallets, real owner-signed testnet operations and exact backend reconciliation |

Passing local tests or historical receipt checks does not establish the last gate. Record each evidence class separately and retain unresolved blockers. No mainnet launch, production security audit, real earning or hosted uptime follows from testnet validation. The owner explicitly requested direct local/VPS processes; Docker is not used.

## Direct Node process

Install and verify from the repository root using Node.js 24 and pnpm 10.21.0:

```sh
pnpm install --frozen-lockfile
pnpm --filter @nabungfi/server typecheck
pnpm --filter @nabungfi/server test
node --import tsx apps/server/src/index.ts
```

Run the service under an unprivileged account. Supply server credentials through a protected environment file or the selected host's secret mechanism. Do not publish environment files, private state or signer material. Use a process supervisor for continuous operation and a persistent private state directory for the operator.

Set `NODE_ENV=production`, the desired `PORT`, and exact HTTPS frontend origins in `NABUNGFI_WEB_ORIGIN`. Bind `NABUNGFI_API_HOST=127.0.0.1` behind the host's TLS reverse proxy. Provide `PRIVY_APP_ID`, `PRIVY_APP_SECRET` and the TLS-required Neon `DATABASE_URL`. The private registry/status bridge must be readable by the API/operator, with paths containing `.local`. The operator's signing keys and original signed wires belong in separate protected persisted state; the API never loads user wallet keys.

`/api/health` reports API process/database startup readiness. `/api/config` separately reports coordinator availability and its operational capacity. An unavailable coordinator blocks paid provisioning before the wallet prompt; saving metadata remains independent.

API hosting needs TLS termination, the exact origin allowlist, bounded request resources and monitoring. Keeper hosting needs continuous availability, a persistent journal volume, bounded funded signers and supervised restarts. See [permissionless coordination](PERMISSIONLESS_KEEPER.md). The user will provide VPS details after these backend gates are satisfied.
