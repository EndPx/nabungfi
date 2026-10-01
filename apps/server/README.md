# NabungFi authenticated testnet API

The application API verifies Privy access tokens and reads authoritative linked wallets from Privy's server API. Neon stores owner-scoped goal metadata, immutable protocol bindings, and durable wallet-action journals. Balances, achievement, reserve state, and claimability come from fresh testnet contract reads. A provider failure returns unavailable state rather than invented balances.

The server prepares unsigned transactions for **Solana Devnet, Base Sepolia, Arbitrum Sepolia, and Ethereum Sepolia**. A goal selects Solana and one to three EVM participants. The owner signs financial operations in their wallet; this service never holds user signing keys or broadcasts financial transactions. Permissionless coordination is handled separately by the [keeper](../../contracts/keeper/README.md).

## Configuration and startup

Copy the blank [.env.example](.env.example) locally into `.env`. Keep `PRIVY_APP_SECRET` and the credential-bearing `DATABASE_URL` server-side. The loader requires a Neon PostgreSQL URL with `sslmode=require`. An HTTPS origin allowlist is mandatory when `NODE_ENV=production`; wildcard origins are rejected.

```sh
pnpm --filter @nabungfi/server check:providers
pnpm --filter @nabungfi/server migrate
pnpm --filter @nabungfi/server dev
```

The read-only provider check authenticates the Privy users API and performs a Neon `SELECT`. Versioned migrations only create/update the `nabungfi` schema, preserve prior checksums across LF/CRLF checkouts, and run under an advisory transaction lock. Startup verifies database access and migrations. The default API listens on `127.0.0.1:3001`; local frontend origins on ports 5173 and 4173 are explicitly allowed. Hosting `PORT` takes precedence over `NABUNGFI_API_PORT`. Bind an explicit `NABUNGFI_API_HOST=0.0.0.0` only behind an HTTPS ingress. A configured private `NABUNGFI_KEEPER_REGISTRY_FILE` starts the append-only registry publisher and stops it before closing the database; `NABUNGFI_KEEPER_STATUS_FILE` points to the permissionless worker's heartbeat.

Each owner can create up to 100 goal records. Existing idempotent requests still replay at that boundary, and the collection returns every stored goal rather than silently hiding older records. Goal metadata can be reserved without operator capacity.

The beta coordinator admits **six active goals**, with a separate **500-identity lifetime history**. Initial provisioning first completes read-only simulation/native-fee checks, then requires a fresh broadcast-enabled permissionless heartbeat and reserves a durable slot before saving/publishing the unsigned plan. Admission and plan publication share a SQL advisory-lock boundary; an unused reservation can be released only if there is no persisted plan, signing/unknown hash, initialization or verified vault. Failed gas/planning checks consume no slot. A capacity or availability error reaches the owner before a wallet SDK call or native spending.

Completed identities remain in the history. Only completion IDs from the private worker's verified fully claimed/delivered state retire active reservations; database claimed counters or UI metadata cannot retire a goal. Retirement is irreversible, and existing retired admissions replay without becoming active again. The union of active admissions and accepted, uncompleted worker identities cannot race beyond six.

## HTTP interface

Every private endpoint requires `Authorization: Bearer <Privy access token>`. Public `/api/config` contains the public app ID, supported testnets, and injected coordinator availability/capacity status. `/api/session` returns an opaque application UUID, the server-verified Privy subject, and authoritative linked wallets; the UUID and Privy subject serve different purposes and must not be compared as if they were the same identity.

| Request | Purpose / response |
| --- | --- |
| `GET /api/goals` | All owner metadata, `{goals,financialReads:"detail-only"}`; no RPC balance reads |
| `POST /api/goals` | Reserve metadata; UUID `Idempotency-Key`; `{goal}` |
| `GET /api/goals/:id` | Owner-scoped metadata and actual chain state; `{goal}` |
| `GET /api/goals/:id/history` | Original action journal; `{history}` |
| `POST /api/goals/:id/steps` | Reserve a UUID `requestId` and unsigned action plan; `{step}` |
| `GET /api/goals/:id/steps/:stepId` | Recover original action after reload/timeout; `{step}` |
| `POST .../steps/:stepId/refresh` | `{fingerprint}`; only unsigned `planned` action with no hash |
| `POST .../steps/:stepId/wallet-start` | `{fingerprint}`; mark exact unexpired plan `signing` before wallet SDK |
| `POST .../steps/:stepId/wallet-rejected` | `{fingerprint,providerCode:4001}`; explicit owner attestation of provider rejection, with no transaction hash |
| `POST .../steps/:stepId/reconcile` | `{transactionHash}`; check sticky original receipt; `{step}` |

Create-goal input is `{name,model,targetAmount,solanaOwner,evmOwner,chains}`. `targetAmount` is a decimal **string** with at most six places. Models are `car`, `laptop`, `house`, or `custom`. Action amounts use positive raw USDC strings (`"1000000"` = 1 USDC). Immutable bindings contain target, goal ID, owner pair, selected domain/EID/token/router/factory identities and Solana accounts. EVM vault/configuration identities are bound only after a verified actual creation receipt.

Actions are `create-vault`, `initialize`, `approve`, `deposit`, `prepare`, `abort`, and `claim`. EVM approval is a separate exact-amount operation. On Solana the owner signs preparation/abort; the keeper does not substitute for this consent.

Collection and metadata-creation responses intentionally return `chainState:null` and `chainStatus:"unavailable"`. These values do not mean zero savings and cannot establish a portfolio financial total. Request a goal detail for fresh financial state. Detail/plan/usability/receipt verification share four process-wide chain-read slots; a fifth request gets a quick `503 CHAIN_READ_BUSY` without an unbounded queue. HTTP requests have a 30-second budget, headers 15 seconds, and Neon queries 15 seconds. SIGTERM closes idle connections, cuts off lingering active sockets before cleanup, and bounds shutdown to 30 seconds.

Before a wallet SDK call, the client must check wallet/network/native funds and successfully call `wallet-start`. The server checks the actual Solana block height and blockhash validity before storing the marker; wall-clock plan expiry alone is insufficient. RPC failure or an expired unsigned blockhash leaves the action planned and refreshable. If the marker HTTP request has an ambiguous outcome, recover its status without automatically sending through the SDK. A `signing` action with unknown outcome cannot refresh or return to `planned`, even after plan expiry. Retrieve and reconcile its original hash.

If the wallet provider directly returns numeric `4001` after a verified successful `wallet-start`, the signed-in owner can explicitly attest that rejection. The server accepts it only for the same plan in `signing` with no hash, records `owner-attested-wallet-rejection` with `onchainProof:false`, and closes the original action as terminal `rejected`. This is an owner attestation, not cryptographic evidence that no transaction exists. The client must not infer it from an HTTP error, network failure, timeout, nested error string or another provider code. Any original hash or submitted/pending/attention outcome remains locked to reconciliation. The old request ID stays rejected; retrying requires the user to choose a separate action, with no automatic wallet resend.

Metadata/action requests are idempotent within owner/goal. A changed intent under the same request ID conflicts. Tentative hashes are sticky and owner-scoped; only verified confirmed/failed receipts occupy the global network/hash uniqueness constraint. A public hash recorded by another user cannot prevent its rightful owner from proving the receipt. A first hash disproven as belonging to another owner/goal/action is rejected before binding; unknown original hashes cannot be reset. A verified receipt cannot confirm two actions or be downgraded to release that identity. One signing/submitted/pending/attention action per authenticated owner and network is allowed across their goals; a different UUID cannot bypass the original wallet outcome. Other networks remain independent. Balances are read from contracts and never computed by summing history. Other owners receive not-found responses for inaccessible goal IDs.

## Verification

```sh
pnpm --filter @nabungfi/server typecheck
pnpm --filter @nabungfi/server test
pnpm --filter @nabungfi/server test:db
```

`test:db` explicitly uses real configured Neon. It creates unique test identities and metadata, tests SQL immutability, concurrent idempotency, hash recovery, owner isolation, signing/refresh races and HTTP denial, then deletes only those owners' rows. HTTP auth and chain adapters in this test are controlled fixtures: it proves persistence/request safety, not browser login or financial network execution. The independent provider check authenticated the actual Privy API and read Neon. Cryptographic tests use the official Privy verifier with real ES256 signatures, incorrect issuer/audience/key, expiry and altered tokens.

Actual testnet contract/LayerZero evidence remains in [deployment manifests](../../contracts/deployments/README.md). The concurrent [three-goal proof](../../contracts/deployments/multichain/concurrent-goals-live.json) is separate from browser integration. Cash proofs do not establish real yield, mainnet deployment, hosted keeper availability or a complete browser-signed user lifecycle. The local testnet coordinator also has finite native-fee, registry-capacity and cycle budgets; availability depends on that operator, gas funding and message delivery.

The [fresh external-owner backend acceptance](../../docs/BACKEND_OWNER_LIFECYCLE.md) confirmed eight actual owner transactions through HTTP/Neon and seven delivered LayerZero messages for a 2-USDC Solana/Base cash goal. Both owner wallets differ from the operator; full claims restored the USDC baselines and left zero assets. This harness used synthetic loopback authentication and CLI owner signing. Genuine Privy browser authentication passed separately against the normal API; browser wallet signing is a separate frontend gate.

## Separate local demo

```sh
pnpm --filter @nabungfi/server dev:demo
```

The legacy simulator runs on port 3002 and uses `.local/demo-state.json`. It has no wallets, Privy, Neon, LayerZero or real funds. Its `/api/state` lifecycle is documented in the historical [demo API contract](../../docs/API_CONTRACT.md). Demo state remains separate from authenticated user metadata and chain balances.
