# NabungFi

**Build what you're saving for.**

NabungFi is a multichain, goal-locked savings prototype. The product must support several simultaneous savings goals per user, such as a car, laptop and house. Contracts isolate each goal's target, reserves and claims. The local application still models one goal; its multiple-goal UI/API work remains unfinished. Each goal is intended to have its own 100-piece construction. [Multiple-goal requirements](docs/MULTI_GOAL_REQUIREMENTS.md).

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

On 30 September 2026, the actual Solana Devnet–Base Sepolia cash-mode goal completed **deposit → authenticated messaging → reserve-based achievement → partial and full claims**. Seven LayerZero messages were delivered through the real DVN/Executor stack, including a post-claim progress update from 6 USDC to zero. The goal received 4 USDC on Solana and 6 USDC on Base; both balances were fully claimed while achievement remained permanent. [Public transaction/state evidence](contracts/deployments/layerzero-solana-base-live.json), [operator runbook](docs/LAYERZERO_TESTNET_RUNBOOK.md).

The shared model has 14 regression tests. EVM verification includes 64 local tests (the prior 60 plus four security-stack tooling cases), the retained 17 pinned fork cases, and one additional configuration/lifecycle fork. A Solana operator-journal regression checks signature reconciliation, changed financial intent, expiry and network guards. Default native checks cover 35 core and four transport tests; the cash-only Devnet profile covers 38 core and four transport tests. Fresh SBF/LiteSVM runs pass six default and seven Devnet scenarios. These local checks are separate from the public-network receipts above. See [LayerZero implementation and reproduction](docs/LAYERZERO_INTEGRATION.md), [fork evidence](contracts/evm/test/fork/README.md), and the [contract-first plan](docs/CONTRACT_PLAN.md).

Public EVM router/factory components are deployed on Base, Arbitrum and Ethereum Sepolia using canonical Circle USDC; their [receipt manifests](contracts/deployments/) distinguish active and superseded components. Base/Ethereum are cash-only because their selected Aave testnet pools do not list Circle USDC; Arbitrum uses its Circle-USDC Aave reserve. Solana has an explicit cash-only Devnet build with canonical USDC and disabled Kamino calls. The proven Solana–Base routes are sealed and their test goal is fully claimed. The current coordinator supports one Base peer per goal, so Arbitrum/Ethereum remain staging for a multi-peer extension.

The TypeScript application still simulates coordination. The public cash lifecycle was driven by an operator; wallet/UI integration, an unattended keeper, actual Kamino execution and an investment policy remain unfinished. Local runtime fixtures still use artificial balances and precommitted packet accounts; they must not be confused with the separate public receipts. The testnet route uses one required LayerZero Labs DVN and retained Solana upgrade authority. Source verification and peer review are not audits, and no live financial yield or production security is claimed.

## Optional local prototype

The ignored `apps/web` and `apps/server` can run with `pnpm dev` when present. The frontend runs at `http://127.0.0.1:5173` and the local API at `http://127.0.0.1:3001`. The local UI uses sample funds and no connected wallet. This application is not included in a public-only checkout.
