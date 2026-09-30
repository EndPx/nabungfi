# NabungFi EVM contracts

This package implements non-upgradeable, single-owner, single-goal USDC vaults. Aave-enabled vaults own their funds and aTokens; explicit cash-only vaults disable earning and hold USDC directly. The prototype has no early payout, target edit, timeout escape, admin sweep, borrowing or arbitrary-call method.

The **71-test** local suite covers accounting, transport, multi-goal isolation, deployment guards, v2 codec/leaf/domain identity and exact security-stack pins. Conservation fuzzing runs 256 cases. Three v2 testnet forks exercise deployment/config scripts and real workers with local balances/authentication. Separately, one public v2 goal completed **4+2+2+2-USDC deposits, 21 real LayerZero deliveries, all-peer achievement and partial/full claims** across Solana, Base, Arbitrum and Ethereum testnets. Every vault ended at zero and each chain's owner regained 20 USDC. [Four-chain lifecycle receipts](../deployments/multichain/live-goal.json), [v2 deployment receipts](../deployments/multichain/) and [transport proof boundaries](../../docs/LAYERZERO_INTEGRATION.md).

The original Base mainnet fork at **51,893,120** uses actual USDC/Aave bytecode, artificial balances and local time; its endpoint is a labeled harness. The historical v1 Solana–Base cash pair remains preserved with [seven-message receipts](../deployments/layerzero-solana-base-live.json) and [source commit b64280b](https://github.com/EndPx/nabungfi/tree/b64280b28ea771fa8c53beae8e8f061d7651e46a). V2 adds a parent virtual domain accessor, changing source/compilation metadata. Do not compare current v1-named compilation outputs to those historical binaries as if they must match.

`test/MultiGoalIsolation.t.sol` checks separate car/laptop/house vaults for one owner: receipt accounting, interest/loss attribution, completion and claims, rejected cross-goal commands, independent rounds/counters, and a cash-funded goal completing while another goal is illiquid. These scenarios use local mock tokens, a mock pool and a mock transport; they do not verify production message authenticity or goal-pair registration. See the [contract-first plan](../../docs/CONTRACT_PLAN.md).

## Reproduce

Requirements: Foundry on Linux/macOS, or WSL Ubuntu on Windows. Verification used Foundry **1.8.3** and Solidity **0.8.30**.

Run `pnpm install --frozen-lockfile` from the repository root for the pinned LayerZero and OpenZeppelin packages. Install the test-only [forge-std v1.16.2 ZIP](https://codeload.github.com/foundry-rs/forge-std/zip/refs/tags/v1.16.2), verify its SHA-256 below, and extract it so this path matches `remappings.txt`:

```text
contracts/evm/lib/forge-std-archive/forge-std-1.16.2/src/
```

With dependencies in place, run from `contracts/evm` in a Linux/macOS or WSL shell:

```sh
forge test --no-match-path 'test/fork/*' -vv
RUN_MULTICHAIN_FORKS=true forge test --match-path 'test/fork/MultichainDeploymentFork.t.sol' --threads 1 -vv
RUN_BASE_FORK=true BASE_RPC_URL=https://base-rpc.publicnode.com forge test --match-path 'test/fork/AaveBaseFork.t.sol' -vv
forge fmt --check
```

On Windows, enter WSL and navigate to the checkout under `/mnt/` before running these commands. Units need no RPC. Fork families have separate opt-in flags; disabled tests are skipped rather than live proof. The three v2 forks use current testnet dependencies and local injected balances/authentication; older pinned Aave/configuration cases remain separate. A pinned fork fails if its RPC cannot serve the selected block. Public RPC availability is not guaranteed.

`lib/`, `out/` and `cache/` are ignored; no dependency gitlink or secret is required.

| Dependency | Version / upstream commit | Archive SHA-256 |
|---|---|---|
| [forge-std](https://github.com/foundry-rs/forge-std/tree/v1.16.2) | `v1.16.2` / `bf647bd6046f2f7da30d0c2bf435e5c76a780c1b` | `8F347B4601F20462B21A863B9960352FFF293F55746A55E132CA6B64603EAE5C` |
| OpenZeppelin contracts | npm `5.7.0` | Integrity pinned in root `pnpm-lock.yaml` |
| LayerZero OApp / protocol libraries | npm `0.4.1` / `3.0.168` | Integrity pinned in root `pnpm-lock.yaml` |

Upstream dependency distributions retain their licenses. OpenZeppelin provides ERC20 interfaces, SafeERC20 and ReentrancyGuard; the official LayerZero OApp supplies endpoint/peer checks and send/quote integration. forge-std is test-only.

## Layout and environment

### LayerZero wiring and goal operations

Active v2 tooling is `DeployMultichain.s.sol`, `ConfigureMultichain.s.sol`, `MultichainConfig.sol` and `OperateMultichain.s.sol`. Configuration derives the exact chain/domain/EID tuple from the RPC chain and pins canonical Circle USDC, reviewed Solana identities, library/DVN/Executor addresses and confirmations. `MULTI_<NETWORK>_ROUTER`, `MULTI_<NETWORK>_GOAL_VAULT` and `MULTI_<NETWORK>_EXPECTED_DEPLOYER_NONCE` are network-specific; common `MULTI_GOAL_*` and Solana goal fields bind one goal across peers. [V2 operator runbook](../../docs/MULTICHAIN_TESTNET_RUNBOOK.md).

V2 EVM send/receive confirmations are Base **2/10**, Arbitrum **1/10**, Ethereum **2/10**. Each uses one required LayerZero Labs DVN and no optional DVNs. EVM routes must be configured/audited/sealed before factory goal creation; Solana initialization follows the actual vault receipts, and Solana sealing follows actual goal-dependent quotes/discovery. `OperateMultichain` exposes seal/create, registration, deposit/progress, ready/report and claim stages with immutable identity/nonce/state checks and bounded message fees. Financial retries additionally require semantic operation identity and original receipt reconciliation; a fresh wallet nonce alone is insufficient proof that a deposit or claim failed.

The following tooling describes the historical v1 pair and remains for regression/reproduction:

`script/ConfigureLayerZero.s.sol` reads public network variables from `.env`, checks the actual router/Endpoint identities, then sets explicit SendULN302, ReceiveULN302, Executor and required DVN configuration. Its `audit()` entrypoint checks custom configuration readbacks and prints route ownership/delegate state. The reviewed testnet stack requires the LayerZero Labs DVN, uses Base-origin confirmations **2** and Solana-origin confirmations **10**, and explicitly disables optional DVNs with the ULN NIL count. This single-operator testnet stack is not a production security quorum.

`quote()` calls the actual Endpoint and worker contracts with the actual OApp sender/receiver and a 222-byte message. Its illustrative goal identities make it a fee/pathway check, not a delivery or registration test. Solana receive options are type 3, with compute units and lamports; `.env` controls both.

```sh
# Simulate first; add --account deployer-wallet --password '' --broadcast --slow only after review.
forge script script/ConfigureLayerZero.s.sol:ConfigureLayerZero --rpc-url "$BASE_SEPOLIA_RPC_URL"
forge script script/ConfigureLayerZero.s.sol:ConfigureLayerZero --sig 'audit()' --rpc-url "$BASE_SEPOLIA_RPC_URL"
forge script script/ConfigureLayerZero.s.sol:ConfigureLayerZero --sig 'quote()' --rpc-url "$BASE_SEPOLIA_RPC_URL"
RUN_LZ_CONFIGURATION_FORK=true forge test --match-path 'test/fork/LayerZeroConfigurationFork.t.sol' -vv
```

The wiring fork pins Base Sepolia block **47,500,917**, applies all four configuration transactions locally, seals the forked router, creates a real vault, quotes real workers, and checks REGISTER/PREPARE/COMMIT handlers with injected authenticated callers. Injected callers and artificial USDC balances are test facilities; this does not prove public DVN verification or delivery.

`script/OperateNabungFi.s.sol` provides individually invoked `seal()`, `create()`, `registration()`, `deposit()`, `progress()`, `ready()`, `report()` and `claim()` steps. Each validates the reviewed route, owner, goal identity/configuration, operation nonce and applicable contract state. Message stages quote the actual goal and enforce `MAX_MESSAGE_FEE_WEI`. After every broadcast, reconcile its receipt and onchain state before updating `EXPECTED_OPERATION_NONCE`; never blindly rerun after a timeout. EVM `seal()` irreversibly renounces ownership and changes its delegate after configuration/worker-quote review; actual goal-dependent Solana discovery occurs after unfunded EVM creation and before Solana sealing. Do not deposit before authenticated pair registration completes on both chains.

```text
src/              Savings contracts, adapter, router, factory, wire codec
test/             Unit and configuration rejection tests
test/mocks/       Test-only USDC, Aave and messaging harnesses
test/fork/        Pinned historical and current testnet RPC-fork integration tests
script/           Foundry deployment, explicit configuration and lifecycle tooling
remappings.txt    Dependency import mappings
foundry.toml      Build, RPC aliases and Etherscan V2 configuration
.env.example      Public configuration and blank API-key placeholder
.env              Local configuration and API key; ignored by Git
```

This follows the directory conventions of [ATFi smart-contract](https://github.com/ATFi-Event/smart-contract/tree/51c0391c02dec20ddeed83a011dc9c97b54dfc3d), reviewed at that pinned revision. NabungFi retains its original financial contracts, compiler version and dependency paths; no ATFi financial logic or private-key deployment convention is copied.

Copy `.env.example` to `.env` only if the local file does not already exist. Foundry loads it from this package directory. Set `ETHERSCAN_API_KEY` locally; the example contains no secret. Network prefixes are `BASE_SEPOLIA`, `ARBITRUM_SEPOLIA`, and `ETHEREUM_SEPOLIA`. Each has its own RPC, EID, canonical token, strategy mode, addresses and fork settings. V2 uses separate `MULTI_*` router/goal/nonce fields and fresh Solana identities; RPC chain ID selects its domain. `TESTNET_CHAIN_ID` and the older Solana profile fields belong to v1 tooling.

Active `*_USDC` configuration uses [Circle's official USDC testnet contracts](https://developers.circle.com/stablecoins/usdc-contract-addresses). Base Sepolia's `0x036C…CF7e` and Ethereum Sepolia's `0x1c7D…7238` differ from older Aave test-pool tokens. Zero pool/receipt explicitly disable earning in those profiles. Arbitrum's Circle USDC matches its enabled Aave adapter, but the public v2 goal kept its 2 USDC idle. The four-chain run proves cash coordination, not earning. Legacy noncanonical assets remain labeled under `*_LEGACY_*` and [legacy manifests](../deployments/legacy/).

## Foundry deployment tooling and provenance

For a new reviewed v2 dry run, check latest/pending nonce and native budget, update the network-specific `MULTI_*_EXPECTED_DEPLOYER_NONCE`, then use:

```sh
forge script script/DeployMultichain.s.sol:DeployMultichain --rpc-url base-sepolia -vv
forge script script/ConfigureMultichain.s.sol:ConfigureMultichain --sig 'audit()' --rpc-url base-sepolia
```

Use `arbitrum-sepolia` or `ethereum-sepolia` for other networks. Deployment leaves components unsealed and does not create/fund a goal. Configuration, seal, creation and money operations remain distinct reviewed stages. Never rerun a pending/unknown transaction; reconcile its original receipt and state. `sealRoute` is irreversible in the EVM router. Historical v1 deployment instructions below are source/version-specific and do not upgrade a deployed route in place.

The components already have public receipts. The recorded expected nonces have been consumed by those deployments, so an unchanged deployment configuration rejects a repeat. For a new reviewed dry-run plan, first check `cast nonce <deployer> --rpc-url <network>` and the pending nonce, then set that network's expected nonce in the local `.env`. The following is a **dry run**, with no network broadcast:

```sh
TESTNET_CHAIN_ID=84532 forge script script/DeployNabungFi.s.sol:DeployNabungFi \
  --rpc-url base-sepolia \
  --sender 0xc82f469Aa95a2f7792300c8d11230e9023A98600 -vv
```

Use chain ID `421614` with `arbitrum-sepolia`, or `11155111` with `ethereum-sepolia`. Configuration validates the actual chain, Endpoint EID and code, official Circle USDC identity and decimals, strategy mode, aToken underlying/pool when enabled, exact reviewed Devnet profile, and expected sender nonce. The script deploys a router and its internal factory, leaves the route unsealed, and never creates or funds a goal.

For an explicitly authorized **new** deployment after reviewing the dry-run plan and fee budget, sign through the existing Foundry keystore by adding `--account deployer-wallet --password '' --broadcast`. No `PRIVATE_KEY` environment variable is required. Check the latest and pending sender nonces before updating `<NETWORK>_EXPECTED_DEPLOYER_NONCE`; a stale nonce rejects the script. Foundry writes its transaction journal under `broadcast/`, which remains local and ignored. If a send is interrupted, reconcile its hash, receipt, sender nonce and deployed code before attempting any retry; do not rerun an unknown or pending deployment. Existing local transaction journals and public receipt manifests are retained after the tooling cleanup.

V2 Solana Devnet is cash-only. Its participant leaf commits Solana core/transport/mint and EVM domain/EID/asset/router/vault/owner; no fake Kamino reserve is used as earning evidence. V1 retains its inert strategy commitment profile. `DeployNabungFi`/`DeployMultichain` deploy components only; separate Configure/Operate scripts explicitly handle libraries, workers and sealing.

After a deployment, verify source using the original compiler settings and exact constructor arguments from its manifest. Foundry's Etherscan V2 aliases read the API key from the local environment; never put its value in a command or public document.

## Local lifecycle and accounting

1. After authenticated goal-pair registration, the immutable owner deposits 6-decimal USDC into `Locked` or `Preparing` state. A deposit never automatically allocates funds to yield.
2. While `Locked`, only the owner may explicitly `invest(amount)` or recall strategy funds. Investment preserves the configured absolute `minimumIdle` floor. A policy-driven automated allocator has not been implemented or calibrated.
3. The authenticated coordinator's `Prepare` command starts the next round. Anyone can help call `redeem` into this same vault; they cannot choose another recipient. An illiquid/paused pool reverts redemption without erasing the existing preparation state.
4. `markReady` requires zero remaining aTokens and snapshots the actual idle USDC as `preparedAssets`. Investment, user claims and attributed deposits are disabled in this phase. Direct ERC20 donations cannot be prevented; they cannot reduce or silently rewrite the reported reserve.
5. A matching authenticated `Commit` must name this exact round and reserve, and certify a global reserve sum at least equal to the immutable target and this local reserve. Only then does the vault become `Achieved`.
6. The owner may claim any part of the available local USDC. Achievement remains set after partial or complete claims. Post-achievement donations can also be claimed by this owner; they are not permanently trapped.

`totalAssets = idle USDC + owned aToken balance`. aToken balance already includes accrued interest; `depositedAssets` is a separate principal counter and must not be added again. Current net performance can be negative. `claimableAssets` is zero before achievement. The goal has no time limit or discretionary withdrawal override. Target comparison uses exact raw units, with no epsilon.

An authenticated abort permanently marks the current round `Aborted`, clears the prepared snapshot, returns to `Locked` and emits `AbortAcknowledged`. It does not pay the user. A new round must have a larger round number. Delayed old commits cannot unlock an aborted round; commits cannot later be aborted or relocked. The coordinator must wait for every registered abort acknowledgment before opening a new round.

## Messaging boundary

`receiveCommand(sourceChain, sender, Command)` accepts calls only from the immutable messenger **contract**, for the immutable coordinator identity and application source domain. It checks the goal, configuration hash, destination domain and destination vault, exact next command sequence, completion round, phase and local reserve.

V2 application domains are **1 Solana, 2 Base, 3 Arbitrum, 4 Ethereum**, with EIDs **40168/40245/40231/40161** on these testnets. V1 retains domains 1/2. Domains are neither chain IDs nor EIDs. `destinationDomain()`/router `domain()` provide the actual v2 identity; the inherited legacy `BASE_DOMAIN` constant must not be treated as an Arbitrum/Ethereum identity. The coordinator is a 32-byte Solana goal account; destination vaults are left-padded EVM addresses.

Command kinds match the Solana prototype: **0 invalid, 1 PREPARE, 2 COMMIT, 3 ABORT**. Sequence and round are uint64. Target is limited to uint64 raw USDC; local amounts use uint256 and the implemented wire encoder rejects values above uint64 before sending. PREPARE/ABORT amounts must be zero. COMMIT supplies the exact local prepared amount plus the coordinator-certified aggregate.

Command sequences advance across rounds, not per round. The vault rejects duplicate and out-of-order commands without consuming its application sequence. The OApp router consumes authenticated stale command retries as no-ops; future commands still revert and must be retried after their predecessors. Lifecycle outbound `reportSequence` advances only for `ReadyReported` and `AbortAcknowledged`. Permissionless progress events use a **separate** `progressSequence`, preventing progress spam from skipping the next expected lifecycle report. Report fields contain goal/config, source domain/vault, amount where applicable, sequence, round where applicable, and an observation block.

`NabungMultiLzRouter` implements the active domain-specific OApp boundary; `NabungMultiVaultFactory` and NBFG v2 bind each actual goal leaf. The router seals before creation and accepts registration only from its authenticated Solana peer. READY/ABORT_ACK use durable outboxes. All three public routes delivered the v2 cash lifecycle with explicit ULN302/DVN/Executor configuration. Each EVM vault still trusts authenticated coordinator certification of remote reserves. Solana deposits wait for all registration acknowledgments; each EVM vault enforces its local pair registration and normal orchestration waits for the global barrier. V1 remains a separate historical pair. Mock transport exists **only in tests**.

## Aave fork proof and rounding

The addresses were verified against the official [Aave Base address book](https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol):

- Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- aToken: `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB`

The constructor verifies 6 decimals, deployed code, the aToken's underlying asset and its pool. It does not hardcode Base addresses so that explicit test deployments can use their own contracts. A real deployment therefore still requires checking all supplied addresses against the deployment manifest.

At pinned block **51,893,120**, a local artificial deposit of **100,000,000 raw USDC** returned **99,999,998 raw USDC** on immediate supply/redemption: a two-micro-USDC rounding difference. An initial test assuming only one raw unit of rounding failed and was corrected to record the actual exact behavior at this block. The regression keeps a 100-USDC target locked after that roundtrip, then authenticates an abort, adds the missing **2 raw units**, prepares a new round, and permits completion at exactly **100,000,000**. No rounding tolerance is added to unlock logic.

The second test advances only the fork's local timestamp by one day and observes actual aToken accrual logic. Redemption returns **100,010,879 raw USDC**, followed by a mock-transport commit and full local claim. This is a deterministic fork observation, **not earned live yield or a forecast**, and does not verify real crosschain delivery.

## Scope and remaining work

- Operate the verified testnet pathway with a persistent keeper and reconciliation policy. Local SDK/SBF checks remain separate from its actual public receipts.
- Review initialization authority, malicious peer behavior, token freezes, protocol upgrades, chain halts and keeper/transport liveness before real funds.
- Select the actual idle reserve/exposure policy and monitoring thresholds. No operator can rewrite this vault's target or withdraw on the owner's behalf.
- Test current deployed-market controls and receipt rounding at deployment time. No-term Aave supply remains subject to protocol liquidity and pause conditions; see [Pool integration](https://aave.com/docs/aave-v3/smart-contracts/pool) and [withdrawal conditions](https://aave.com/help/supplying/withdraw-tokens).
- Expand the operator-driven public proof into unattended keeper/indexer operation, multiple concurrent public goals, real abort/loss recovery and wallet/UI integration. The four-chain cash goal and local multi-goal tests do not complete those acceptance requirements.
- Obtain independent security review. The local tests are meaningful evidence of the tested cases, not an audit or assurance against all loss scenarios.
