# Repository scope

The public repository contains the application prototype, shared package, onchain source and tests, keeper, technical documentation, and configuration/lockfiles needed to reproduce them. Application publication was authorized on 1 October 2026; research and private material remain local.

| Included | Purpose |
| --- | --- |
| `apps/web/` | React/Vite interface, procedural 3D model, integrated sound assets and recovery tests |
| `apps/server/` | Local-demo HTTP API, simulated-ledger persistence and API tests |
| `shared/` | Common TypeScript model, response types and tests |
| `contracts/evm/` | USDC vault, optional Aave adapter, Foundry script/tests/mocks, public environment template and dependency pins |
| `contracts/solana/` | Anchor program, tests, public account fixture and Cargo lockfile |
| `contracts/deployments/` | Public testnet receipts, component addresses, source verification and superseded records; no keys or signed transaction blobs |
| `contracts/keeper/` | Bounded testnet coordination, durable reconciliation and recovery tests |
| `docs/API_CONTRACT.md` | Reference API contract for shared-model consumers |
| `docs/MULTI_GOAL_REQUIREMENTS.md` | Required behavior and isolation for simultaneous savings goals |
| `docs/CONTRACT_PLAN.md` | Contract-first milestones and local isolation evidence |
| `docs/CROSSCHAIN_BALANCE_SYNC.md` | Proposed per-goal progress reporting and transport boundary |
| `docs/LAYERZERO_INTEGRATION.md` | Implemented transport, verification evidence and reproduction |
| `docs/REPOSITORY_SCOPE.md` | This publication boundary |
| Root README, manifests and lockfile | Setup and reproducibility |

The root `.gitignore` keeps `research/`, `DESIGN.md`, `IMPLEMENTATION_STATUS.md`, and the local browser-verification report out of ordinary Git adds. Dependencies, build output, local state, logs, credentials in `.env` files and editor caches are also ignored. Example environment files contain placeholders only. The original third-party audio MP3 stays local; the app includes its edited playback asset and source/provenance instructions.

Tests, dependency pins and the public Solana fixture are required development evidence, not disposable output. Keep them with the source. The JavaScript lockfile includes the published application workspaces so a fresh checkout can install and run the prototype.

## Inspect before staging

```sh
pnpm repo:files
git status --short
git diff --cached --name-only
```

`repo:files` lists tracked files plus untracked files eligible for an ordinary `git add`. Review this list before a future commit. Ignore rules do not protect files deliberately force-added or already tracked: do not force-add research, secrets, private state or generated output.

Commit and push verified steps under the owner's current authorization; review staged paths and private-value exclusions before each publication.

## Published local application

`pnpm dev` starts the local simulator and frontend. After `pnpm build`, `pnpm preview` serves the built UI. Root build/test/typecheck commands include the applications, shared model and keeper. This source is a runnable local simulation, while public contract/LayerZero receipts remain separate evidence. Publishing the app does not complete its wallet, Privy, Neon or multiple-goal integration.
