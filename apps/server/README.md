# NabungFi local-demo API

This localhost HTTP service uses the shared exact-unit model, serialized request handling and atomic file replacement for a simulated single-goal ledger. It does not access wallets, Neon, Privy, LayerZero or real funds.

Start both applications with `pnpm dev` from the repository root, or run the API alone:

```sh
pnpm --filter @nabungfi/server dev
```

The default address is `http://127.0.0.1:3001`. `GET /api/health` identifies `local-demo`; `GET /api/state` returns the simulated ledger. POST endpoints and request/goal identity requirements are documented in the [API contract](../../docs/API_CONTRACT.md).

The default state file is `.local/demo-state.json` at the repository root. Preserve this ignored file when restarting. Corrupt state fails closed. Configure `NABUNGFI_DEMO_PORT` or `NABUNGFI_DEMO_STATE` in the process environment if needed. The current start command does not load `.env`; prepared Privy/Neon settings are separate future integration work.

```sh
pnpm --filter @nabungfi/server test
pnpm --filter @nabungfi/server typecheck
```

Tests exercise concurrent request replay, lifecycle restrictions, persistence, stale goal identity, origin rejection and corrupt-state handling. Secrets, state and dependency folders remain ignored. The `.env.example` contains configuration names and blank future credentials only.
