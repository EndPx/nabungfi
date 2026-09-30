# Repository scope

The public repository contains the shared package, onchain source and tests, technical documentation, and the configuration/lockfiles needed to reproduce them.

| Included | Purpose |
| --- | --- |
| `shared/` | Common TypeScript model, response types and tests |
| `contracts/evm/` | USDC vault, optional Aave adapter, Foundry script/tests/mocks, public environment template and dependency pins |
| `contracts/solana/` | Anchor program, tests, public account fixture and Cargo lockfile |
| `contracts/deployments/` | Public testnet receipts, component addresses, source verification and superseded records; no keys or signed transaction blobs |
| `docs/API_CONTRACT.md` | Reference API contract for shared-model consumers |
| `docs/MULTI_GOAL_REQUIREMENTS.md` | Required behavior and isolation for simultaneous savings goals |
| `docs/CONTRACT_PLAN.md` | Contract-first milestones and local isolation evidence |
| `docs/CROSSCHAIN_BALANCE_SYNC.md` | Proposed per-goal progress reporting and transport boundary |
| `docs/LAYERZERO_INTEGRATION.md` | Implemented transport, verification evidence and reproduction |
| `docs/REPOSITORY_SCOPE.md` | This publication boundary |
| Root README, manifests and lockfile | Setup and reproducibility |

The root `.gitignore` keeps `apps/`, `research/`, `DESIGN.md`, `IMPLEMENTATION_STATUS.md`, and the local browser-verification report out of ordinary Git adds. These files remain in the local workspace. Dependencies, build output, local state, logs, credentials in `.env` files and editor caches are also ignored. Example environment files can be committed only with placeholders.

Tests, dependency pins and the public Solana fixture are required development evidence, not disposable output. Keep them with the source. The JavaScript lockfile also records optional local app workspaces; their presence there does not include their source code. The workspace can install and check `shared/` when those apps are absent.

## Inspect before staging

```sh
pnpm repo:files
git status --short
git diff --cached --name-only
```

`repo:files` lists tracked files plus untracked files eligible for an ordinary `git add`. Review this list before a future commit. Ignore rules do not protect files deliberately force-added or already tracked: neither `apps/` nor `research/` should be added with `git add -f`.

Preparing this layout does not authorize a commit or push. Publishing remains a separate user instruction.

## Optional local application

When the ignored `apps/web` and `apps/server` are present, `pnpm dev` starts the local simulator and `pnpm preview` serves its built UI. Root build/test/typecheck commands also include those workspaces when present. A public-only checkout contains no runnable frontend or API service; use the shared package and contract package commands instead.
