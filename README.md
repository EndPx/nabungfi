# NabungFi

**Build what you're saving for.**

NabungFi is a goal-locked savings prototype for Solana and Base. The product must support several simultaneous savings goals per user, such as a car, laptop and house. Each goal has its own fixed target, attributed contributions and net earnings, and 100-piece construction. The current local application still models one goal; [multiple-goal support is a confirmed requirement awaiting implementation](docs/MULTI_GOAL_REQUIREMENTS.md).

This repository contains the shared model and contract implementations. The interactive web app, local API and research workspace are kept locally and excluded from Git.

## Structure

```text
shared/              @nabungfi/shared: exact-unit model, API types and tests
contracts/evm/       Base goal vault, Aave adapter and Foundry tests
contracts/solana/    Anchor goal/coordinator core and Kamino CPI bindings
docs/                Technical interface and repository-scope documentation
package.json         Workspace commands
pnpm-workspace.yaml  Shared package and optional local app discovery
pnpm-lock.yaml       Pinned JavaScript dependencies
```

See [repository scope](docs/REPOSITORY_SCOPE.md) for the full inclusion rules. Build artifacts, dependencies, secrets, local state and internal design notes are ignored.

## Shared package

Requirements: Node.js 24 and pnpm 10.21.0.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

In a public-only checkout these commands verify `shared/`. If the local `apps/` workspaces are present, the same commands also verify them.

The [shared package](shared/README.md) exports exact six-decimal USDC conversion, lifecycle rules, state transitions and response types. The local server and frontend consume `@nabungfi/shared`; they do not maintain separate API type definitions. [API contract](docs/API_CONTRACT.md).

## Contracts

- [Base / Aave](contracts/evm/README.md): non-upgradeable goal vault, supply/redeem adapter, unit tests and pinned Base fork tests.
- [Solana / Kamino](contracts/solana/README.md): Anchor custody/coordinator, pinned Kamino CPI code, native tests and a public account fixture.

Contract commands and tool requirements are documented in those packages. Root pnpm commands do not run Foundry or Cargo.

## Savings rules

- Principal and net earnings remain locked until verified achievement; there is no deadline escape or early payout.
- Current balances alone do not unlock funds. Completion requires the realized reserves for a matching coordination round.
- Achievement remains committed after a partial claim; the remaining chain cannot relock merely because the first claim reduced the aggregate balance.
- Presentation progress and assembly animations never authorize transfers.

## Evidence and current limits

The shared model has 14 regression tests. Contract verification includes 45 Base local tests, two pinned Aave fork tests, 35 native core tests, four native transport tests, and six LiteSVM scenarios executing both SBF programs against an actual LayerZero Endpoint bytecode snapshot. Solana send tests use a clearly marked local message library fixture. These are local development results, not an audit or public-network acceptance. See [LayerZero implementation and reproduction](docs/LAYERZERO_INTEGRATION.md) and the [contract-first plan](docs/CONTRACT_PLAN.md).

The TypeScript model still simulates coordination. LayerZero sender/receiver code, a shared codec, pair registration and remote progress reception are implemented. Runtime tests use artificial token balances and precommitted local packet accounts; they do not run a DVN quorum or deliver a public crosschain message. Real pathway wiring/deployment, Kamino valuation and supply/redeem execution, wallet integration, an operational keeper and automatic investment policy remain unfinished. Ethereum, Arbitrum and Robinhood Chain are additional candidates; the current coordinator supports the Solana–Base pair. Nothing here guarantees liquidity or earnings.

## Optional local prototype

The ignored `apps/web` and `apps/server` can run with `pnpm dev` when present. The frontend runs at `http://127.0.0.1:5173` and the local API at `http://127.0.0.1:3001`. The local UI uses sample funds and no connected wallet. This application is not included in a public-only checkout.
