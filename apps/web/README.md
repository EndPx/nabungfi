# NabungFi web prototype

The React/Vite app presents a procedural roadster with exactly 100 components, assembly animation, building audio and a separate completion cue. It consumes the shared API types and local-demo ledger; visual assembly does not authorize financial transfers.

## Run from the repository root

Use Node.js 24 and pnpm 10.21.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. The root command also starts the [local API](../server/README.md) at port 3001. For the built UI:

```sh
pnpm build
pnpm preview
```

Open `http://127.0.0.1:4173`. Vite proxies `/api` to the local server in both modes.

## Checks and configuration

```sh
pnpm --filter @nabungfi/web test
pnpm --filter @nabungfi/web typecheck
pnpm --filter @nabungfi/web build
```

Tests cover request recovery, identity preservation, ambiguous responses and presentation thresholds. The optional `.env.example` documents public client settings; real `.env` files are ignored. Privy login, wallet transactions and multiple-goal application support are still pending. Server secrets and database credentials must never be client variables.

The interface displays sample funds and simulated strategy values for one Solana/Base goal. The genuine four-chain contract/keeper proof is described in the [concurrent runbook](../../docs/CONCURRENT_GOALS_RUNBOOK.md). [Asset provenance](ASSET_PROVENANCE.md) describes the procedural model, edited audio and local-only original recording.
