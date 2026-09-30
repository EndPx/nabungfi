# NabungFi EVM contracts

This package implements non-upgradeable, single-owner, single-goal USDC vaults. Aave-enabled vaults own their funds and aTokens; explicit cash-only vaults disable earning and hold USDC directly. The prototype has no early payout, target edit, timeout escape, admin sweep, borrowing or arbitrary-call method.

The 64-test local suite covers accounting, transport, multi-goal isolation, deployment guards and operator tooling. Conservation fuzzing runs 256 cases. The original Base mainnet fork uses actual USDC/Aave bytecode at block **51,893,120**, artificial balances and local time advance. Its local endpoint remains a labeled test harness. Separately, the sealed public Solana Devnet–Base Sepolia cash pair completed seven real LayerZero deliveries, 4+6-USDC deposits and partial/full claims. Arbitrum/Ethereum components remain staging. [Public lifecycle receipts](../deployments/layerzero-solana-base-live.json), [deployment receipts](../deployments/) and [transport proof boundaries](../../docs/LAYERZERO_INTEGRATION.md).

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
RUN_BASE_FORK=true BASE_RPC_URL=https://base-rpc.publicnode.com forge test --match-path 'test/fork/*' -vv
forge fmt --check
```

On Windows, enter WSL and navigate to the checkout under `/mnt/` before running these commands. The first command excludes fork tests and needs no RPC; a plain `forge test` instead explicitly **skips** the two fork tests unless enabled. A run with `RUN_BASE_FORK=true` fails if the selected archive RPC cannot serve the pinned block; it must not be reported as mainnet-fork proof in that case. Public RPC availability is not guaranteed.

`lib/`, `out/` and `cache/` are ignored; no dependency gitlink or secret is required.

| Dependency | Version / upstream commit | Archive SHA-256 |
|---|---|---|
| [forge-std](https://github.com/foundry-rs/forge-std/tree/v1.16.2) | `v1.16.2` / `bf647bd6046f2f7da30d0c2bf435e5c76a780c1b` | `8F347B4601F20462B21A863B9960352FFF293F55746A55E132CA6B64603EAE5C` |
| OpenZeppelin contracts | npm `5.7.0` | Integrity pinned in root `pnpm-lock.yaml` |
| LayerZero OApp / protocol libraries | npm `0.4.1` / `3.0.168` | Integrity pinned in root `pnpm-lock.yaml` |

Upstream dependency distributions retain their licenses. OpenZeppelin provides ERC20 interfaces, SafeERC20 and ReentrancyGuard; the official LayerZero OApp supplies endpoint/peer checks and send/quote integration. forge-std is test-only.

## Layout and environment

### LayerZero wiring and goal operations

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

`script/OperateNabungFi.s.sol` provides individually invoked `seal()`, `create()`, `registration()`, `deposit()`, `progress()`, `ready()`, `report()` and `claim()` steps. Each validates the reviewed route, owner, goal identity/configuration, operation nonce and applicable contract state. Message stages quote the actual goal and enforce `MAX_MESSAGE_FEE_WEI`. After every broadcast, reconcile its receipt and onchain state before updating `EXPECTED_OPERATION_NONCE`; never blindly rerun after a timeout. `seal()` irreversibly renounces router ownership and makes the router its Endpoint delegate, so verify both chains and account discovery before invoking it. Do not deposit before authenticated pair registration completes on both chains.

```text
src/              Savings contracts, adapter, router, factory, wire codec
test/             Unit and configuration rejection tests
test/mocks/       Test-only USDC, Aave and messaging harnesses
test/fork/        Pinned RPC-fork integration tests
script/           Foundry deployment entrypoint and configuration helper
remappings.txt    Dependency import mappings
foundry.toml      Build, RPC aliases and Etherscan V2 configuration
.env.example      Public configuration and blank API-key placeholder
.env              Local configuration and API key; ignored by Git
```

This follows the directory conventions of [ATFi smart-contract](https://github.com/ATFi-Event/smart-contract/tree/51c0391c02dec20ddeed83a011dc9c97b54dfc3d), reviewed at that pinned revision. NabungFi retains its original financial contracts, compiler version and dependency paths; no ATFi financial logic or private-key deployment convention is copied.

Copy `.env.example` to `.env` only if the local file does not already exist. Foundry loads it from this package directory. Set `ETHERSCAN_API_KEY` locally; the example contains no secret. Network prefixes are `BASE_SEPOLIA`, `ARBITRUM_SEPOLIA`, and `ETHEREUM_SEPOLIA`. Each has its own RPC, EID, canonical token, strategy mode, deployed addresses and fork block. `TESTNET_CHAIN_ID` selects the deployment environment, while `SOLANA_DEVNET_*` binds the public core/transport/Store identities and explicit cash-only strategy commitments.

Active `*_USDC` configuration uses [Circle's official USDC testnet contracts](https://developers.circle.com/stablecoins/usdc-contract-addresses). Base Sepolia's `0x036C…CF7e` and Ethereum Sepolia's `0x1c7D…7238` differ from the older Aave test-pool tokens in the original deployments. Their active `*_CASH_ONLY=true` configuration sets both pool and receipt to zero, explicitly disabling earning. Arbitrum Sepolia's Circle USDC matches its Aave asset and uses `*_CASH_ONLY=false`. All three active component stacks use the same revised source. Older deployment and Aave fork references remain under `*_LEGACY_*` and [deployments/legacy](../deployments/legacy/); the older Base/Ethereum stacks must never be presented as canonical Circle-USDC deployments.

## Foundry deployment tooling

The components already have public receipts. The recorded expected nonces have been consumed by those deployments, so an unchanged deployment configuration rejects a repeat. For a new reviewed dry-run plan, first check `cast nonce <deployer> --rpc-url <network>` and the pending nonce, then set that network's expected nonce in the local `.env`. The following is a **dry run**, with no network broadcast:

```sh
TESTNET_CHAIN_ID=84532 forge script script/DeployNabungFi.s.sol:DeployNabungFi \
  --rpc-url base-sepolia \
  --sender 0xc82f469Aa95a2f7792300c8d11230e9023A98600 -vv
```

Use chain ID `421614` with `arbitrum-sepolia`, or `11155111` with `ethereum-sepolia`. Configuration validates the actual chain, Endpoint EID and code, official Circle USDC identity and decimals, strategy mode, aToken underlying/pool when enabled, exact reviewed Devnet profile, and expected sender nonce. The script deploys a router and its internal factory, leaves the route unsealed, and never creates or funds a goal.

For an explicitly authorized **new** deployment after reviewing the dry-run plan and fee budget, sign through the existing Foundry keystore by adding `--account deployer-wallet --password '' --broadcast`. No `PRIVATE_KEY` environment variable is required. Check the latest and pending sender nonces before updating `<NETWORK>_EXPECTED_DEPLOYER_NONCE`; a stale nonce rejects the script. Foundry writes its transaction journal under `broadcast/`, which remains local and ignored. If a send is interrupted, reconcile its hash, receipt, sender nonce and deployed code before attempting any retry; do not rerun an unknown or pending deployment. Existing local transaction journals and public receipt manifests are retained after the tooling cleanup.

Solana Devnet is currently cash-only: the four strategy commitment fields identify an inert mint, not a working Kamino reserve. The EVM protocol still uses application domains Solana `1` and Base `2`; Arbitrum/Ethereum copies remain staging until multi-peer support exists. None of these scripts configures DVNs, message libraries, fee workers, or irreversible sealing.

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

Application domain **1 = Solana**, **2 = Base**. These are not EVM chain IDs or LayerZero endpoint IDs. Mainnet Base is chain ID 8453; the test fork asserts it. A production deployment manifest must bind the correct mainnet/testnet identities. The source coordinator is the 32-byte Solana goal/coordinator account identity, and the Base destination vault is the EVM address left-padded to 32 bytes.

Command kinds match the Solana prototype: **0 invalid, 1 PREPARE, 2 COMMIT, 3 ABORT**. Sequence and round are uint64. Target is limited to uint64 raw USDC; local amounts use uint256 and the implemented wire encoder rejects values above uint64 before sending. PREPARE/ABORT amounts must be zero. COMMIT supplies the exact local prepared amount plus the coordinator-certified aggregate.

Command sequences advance across rounds, not per round. The vault rejects duplicate and out-of-order commands without consuming its application sequence. The OApp router consumes authenticated stale command retries as no-ops; future commands still revert and must be retried after their predecessors. Lifecycle outbound `reportSequence` advances only for `ReadyReported` and `AbortAcknowledged`. Permissionless progress events use a **separate** `progressSequence`, preventing progress spam from skipping the next expected lifecycle report. Report fields contain goal/config, source domain/vault, amount where applicable, sequence, round where applicable, and an observation block.

`NabungLzRouter` implements the official OApp boundary, and `NabungVaultFactory` plus the shared wire/configuration fixtures establish the registration encoding. The router seals its peer/delegate configuration before creating goals and accepts registration only from the authenticated Solana peer. READY and ABORT_ACK are read from a durable vault outbox. Explicit ULN302/DVN/Executor configuration, measured fee options and public delivery are recorded for the cash-mode test pair in the lifecycle manifest. The Base vault still depends on authenticated coordinator evidence for remote reserves. The legacy mock transport exists **only in tests**.

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
- Handle deployment, indexing, outbound event attestation, retries, remote abort barriers and frontend wallet transactions. None is proven by the unit/fork suite.
- Obtain independent security review. The local tests are meaningful evidence of the tested cases, not an audit or assurance against all loss scenarios.
