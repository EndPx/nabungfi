# NabungFi

**Build what you're saving for.**

NabungFi is a multichain, goal-locked savings prototype. The product must support several simultaneous savings goals per user, such as a car, laptop and house. Contracts isolate each goal's target, reserves and claims. The local application still models one goal; its multiple-goal UI/API work remains unfinished. Each goal is intended to have its own 100-piece construction. [Multiple-goal requirements](docs/MULTI_GOAL_REQUIREMENTS.md).

This repository contains the interactive web prototype, local API, shared model and contract implementations. Research, private configuration and local state remain excluded from Git.

## Structure

```text
apps/web/            React/Vite prototype, procedural 3D construction and audio feedback
apps/server/         Local-demo HTTP API and persistent simulated ledger
shared/              @nabungfi/shared: exact-unit model, API types and tests
contracts/evm/       Domain-specific EVM goal vaults, Aave adapter and Foundry tooling/tests
contracts/solana/    Anchor single-peer and multi-peer coordinator/transport programs
contracts/deployments/ Public component, configuration and lifecycle receipts
contracts/keeper/    Durable per-goal testnet coordination and recovery tests
docs/                Technical interface and repository-scope documentation
package.json         Workspace commands
pnpm-workspace.yaml  Application, shared and contract workspaces
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

These commands verify the shared model, local server, frontend and keeper. Contract-specific Foundry/Cargo checks use their package instructions.

The [shared package](shared/README.md) exports exact six-decimal USDC conversion, lifecycle rules, state transitions and response types. The local server and frontend consume `@nabungfi/shared`; they do not maintain separate API type definitions. [API contract](docs/API_CONTRACT.md).

## Contracts

- [EVM vaults / Aave](contracts/evm/README.md): non-upgradeable goal vaults for Base, Arbitrum and Ethereum Sepolia, supply/redeem adapter, domain-bound factories and Foundry tooling/tests.
- [Solana coordinator](contracts/solana/README.md): Anchor custody and authenticated multi-peer coordination. The deployed v2 Devnet program is cash-only; retained Kamino bindings are separate strategy work.

Contract commands and tool requirements are documented in those packages. Root pnpm commands do not run Foundry or Cargo.

## Savings rules

- Principal and net earnings remain locked until verified achievement; there is no deadline escape or early payout.
- Current balances alone do not unlock funds. Completion requires the realized reserves for a matching coordination round.
- Achievement remains committed after a partial claim; the remaining chain cannot relock merely because the first claim reduced the aggregate balance.
- Presentation progress and assembly animations never authorize transfers.

## Evidence and current limits

The latest public proof runs **three concurrent savings goals for the same owner** across all four testnets: car **8 USDC**, laptop **4 USDC**, house **12 USDC**. A local WSL keeper journaled **118 coordination intents** and delivered **100 actual LayerZero messages**. Root signed the separate deposits and **12 claim transactions**. Laptop completed and was claimed while car/house stayed locked with exactly unchanged financial state; after explicit top-ups, those goals also completed. All 12 vaults ended at zero cash/NAV and every chain's owner account returned to 20 USDC, with permanent achieved totals 8/4/12. [Concurrent-goal receipts, keeper budgets and isolation evidence](contracts/deployments/multichain/concurrent-goals-live.json), [reproduction/chronology](docs/CONCURRENT_GOALS_RUNBOOK.md).

The live restart preserved 24 original intent hashes; the later journal also contains new work. It does not prove that an undelivered packet persisted across the restart. The isolation comparison uses the actual earlier 21:41 UTC baseline, not the failed immediate pre-claim capture; the late capture is labeled during-claims and observer-progress changes are disclosed separately.

The v2 public testnet goal completed **registration → 4+2+2+2-USDC deposits → same-round reserves → achievement → partial and full claims** across Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. The recorded achieved total is 10 USDC. Every vault ended at zero, and each chain's owner token account recovered its initial 20-USDC faucet balance. Real LayerZero DVNs/Executors delivered **21 messages**, including post-claim zero-balance reports from all three EVM peers; funds stayed on their original chains. [Four-chain transaction/state evidence](contracts/deployments/multichain/live-goal.json), [operator runbook](docs/MULTICHAIN_TESTNET_RUNBOOK.md), [v2 protocol design](docs/MULTICHAIN_V2_PLAN.md).

The latest verification pass includes **71 EVM unit tests**, **three v2 testnet fork scenarios**, **59 native Rust checks** and **six v2 SBF/LiteSVM scenarios**. The shared model retains 14 regression tests. These local/fork/runtime checks are distinct from the public transaction receipts. Earlier v1 verification included 64 EVM units, 17 retained pinned fork cases, a configuration fork, 35+4 default native checks or 38+4 Devnet checks, and six default/seven Devnet SVM scenarios; these are dated prior gates rather than additional new v2 public executions. See [LayerZero implementation and reproduction](docs/LAYERZERO_INTEGRATION.md) and the [contract-first plan](docs/CONTRACT_PLAN.md).

The [v2 component manifests](contracts/deployments/multichain/) bind fresh Solana programs and EVM routers/factories to canonical Circle USDC. The coordinator has a fixed registered participant set and independent per-peer identities, sequences and readiness; completion requires every participant. Base, Ethereum and Solana use cash-only profiles. Arbitrum has a compatible Aave adapter available, but its demonstrated 2 USDC stayed idle: **this four-chain run proves cash custody and coordination, not earning**.

Arbitrum's original v2 router, factory and completed vault, plus the three concurrent-goal vaults, have exact creation/runtime source matches on Sourcify. Pinned recompilation and live RPC comparisons are recorded. Original Etherscan/Arbiscan queue statuses remain separate. [Original source proof](contracts/deployments/multichain/arbitrum-source-verification.json), [concurrent vault proof](contracts/deployments/multichain/arbitrum-concurrent-vault-verification.json), [provider status](docs/ARBITRUM_SOURCE_VERIFICATION.md).

The TypeScript application still simulates one goal; multiple-goal API/UI migration and wallet integration remain unfinished. The keeper's autonomous coordination is now proven locally on public testnets, with explicit Root funding/claim pauses; it is a local WSL process, not a hosted always-on service, and cannot run while the host is asleep/offline. At the recorded terminal state it remains idle without signing fresh actions for zero balances. Actual Kamino execution, demonstrated earning, investment policy and production hosting/security remain work. Local SVM fixtures do not prove DVN delivery. One required testnet DVN and retained Solana upgrade authority remain trust boundaries. Robinhood/CRE are absent; no mainnet operation, live earning or audit assurance is claimed.

The earlier Solana–Base v1 cash proof remains preserved with its [seven-message lifecycle manifest](contracts/deployments/layerzero-solana-base-live.json) and [historical source commit](https://github.com/EndPx/nabungfi/tree/b64280b28ea771fa8c53beae8e8f061d7651e46a). The v2 domain accessor changes source/compilation metadata; current v1-named source must not be described as byte-for-byte identical to those historical deployed binaries.

## Optional local prototype

Run `pnpm dev` from the repository root. The frontend runs at `http://127.0.0.1:5173` and the local API at `http://127.0.0.1:3001`. After `pnpm build`, use `pnpm preview` for the built UI at `http://127.0.0.1:4173`. See the [web prototype](apps/web/README.md) and [local API](apps/server/README.md).

The application uses sample funds and one simulated goal. It does not connect a wallet, submit onchain transactions or use the prepared Privy/Neon credentials yet. Its UI is separate from the genuine four-chain contract/keeper evidence.
