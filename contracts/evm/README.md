# NabungFi Base goal vault prototype

This package implements a non-upgradeable, single-owner, single-goal USDC vault with an actual Aave V3 supply/withdraw integration. Funds and aTokens remain owned by the vault. The prototype has no early payout, target edit, timeout escape, admin sweep, borrowing or arbitrary-call method.

**Rechecked on 30 September 2026:** 45 local tests and two Base mainnet fork tests pass, including 256 conservation fuzz runs, six same-owner multi-goal cases and nine LayerZero OApp/codec/factory cases. The forks use actual USDC/Aave bytecode at block **51,893,120**, artificial balances and local time advance. The EVM endpoint is a labeled test harness. No public deployment or real-fund transaction is claimed. [Transport implementation and proof boundaries](../../docs/LAYERZERO_INTEGRATION.md).

`test/MultiGoalIsolation.t.sol` checks separate car/laptop/house vaults for one owner: receipt accounting, interest/loss attribution, completion and claims, rejected cross-goal commands, independent rounds/counters, and a cash-funded goal completing while another goal is illiquid. These scenarios use local mock tokens, a mock pool and a mock transport; they do not verify production message authenticity or goal-pair registration. See the [contract-first plan](../../docs/CONTRACT_PLAN.md).

## Reproduce

Requirements: Foundry on Linux/macOS, or WSL Ubuntu on Windows. Verification used Foundry **1.8.3** and Solidity **0.8.30**.

Run `pnpm install --frozen-lockfile` from the repository root for the pinned LayerZero and OpenZeppelin packages. Install the test-only [forge-std v1.16.2 ZIP](https://codeload.github.com/foundry-rs/forge-std/zip/refs/tags/v1.16.2), verify its SHA-256 below, and extract it so this path matches `foundry.toml`:

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

## Local lifecycle and accounting

1. After authenticated goal-pair registration, the immutable owner deposits 6-decimal USDC into `Locked` or `Preparing` state. A deposit never automatically allocates funds to yield.
2. While `Locked`, only the owner may explicitly `invest(amount)` or recall strategy funds. Investment preserves the configured absolute `minimumIdle` floor. A policy-driven automated allocator has not been implemented or calibrated.
3. The authenticated coordinator's `Prepare` command starts the next round. Anyone can help call `redeem` into this same vault; they cannot choose another recipient. An illiquid/paused pool reverts redemption without erasing the existing preparation state.
4. `markReady` requires zero remaining aTokens and snapshots the actual idle USDC as `preparedAssets`. Investment, user claims and attributed deposits are disabled in this phase. Direct ERC20 donations cannot be prevented; they cannot reduce or silently rewrite the reported reserve.
5. A matching authenticated `Commit` must name this exact round and reserve, and certify a global reserve sum at least equal to the immutable target and this local reserve. Only then does the vault become `Achieved`.
6. The owner may claim any part of the available local USDC. Achievement remains set after partial or complete claims. Post-achievement donations can also be claimed by this owner; they are not permanently trapped.

`totalAssets = idle USDC + owned aToken balance`. aToken balance already includes accrued interest; `depositedAssets` is a separate principal counter and must not be added again. Current net performance can be negative. `claimableAssets` is zero before achievement. The goal has no time limit or discretionary withdrawal override. Target comparison uses exact raw units, with no epsilon.

An authenticated abort permanently marks the current round `Aborted`, clears the prepared snapshot, returns to `Locked` and emits `AbortAcknowledged`. It does not pay the user. A new round must have a larger round number. Delayed old commits cannot unlock an aborted round; commits cannot later be aborted or relocked. The coordinator must wait for every registered abort acknowledgment before opening a new round.

## Messaging boundary — not an installed bridge

`receiveCommand(sourceChain, sender, Command)` accepts calls only from the immutable messenger **contract**, for the immutable coordinator identity and application source domain. It checks the goal, configuration hash, destination domain and destination vault, exact next command sequence, completion round, phase and local reserve.

Application domain **1 = Solana**, **2 = Base**. These are not EVM chain IDs or LayerZero endpoint IDs. Mainnet Base is chain ID 8453; the test fork asserts it. A production deployment manifest must bind the correct mainnet/testnet identities. The source coordinator is the 32-byte Solana goal/coordinator account identity, and the Base destination vault is the EVM address left-padded to 32 bytes.

Command kinds match the Solana prototype: **0 invalid, 1 PREPARE, 2 COMMIT, 3 ABORT**. Sequence and round are uint64. Target is limited to uint64 raw USDC; local amounts use uint256 and the implemented wire encoder rejects values above uint64 before sending. PREPARE/ABORT amounts must be zero. COMMIT supplies the exact local prepared amount plus the coordinator-certified aggregate.

Command sequences advance across rounds, not per round. The vault rejects duplicate and out-of-order commands without consuming its application sequence. The OApp router consumes authenticated stale command retries as no-ops; future commands still revert and must be retried after their predecessors. Lifecycle outbound `reportSequence` advances only for `ReadyReported` and `AbortAcknowledged`. Permissionless progress events use a **separate** `progressSequence`, preventing progress spam from skipping the next expected lifecycle report. Report fields contain goal/config, source domain/vault, amount where applicable, sequence, round where applicable, and an observation block.

`NabungLzRouter` now implements the official OApp boundary, and `NabungVaultFactory` plus the shared wire/configuration fixtures establish the registration encoding. The router seals its peer/delegate configuration before creating goals and accepts registration only from the authenticated Solana peer. READY and ABORT_ACK are read from a durable vault outbox. Actual DVN/library/confirmation configuration, fee budgets, network delivery and deployment/upgrade identities remain unverified. The Base vault still depends on authenticated coordinator evidence for remote reserves. The legacy mock transport exists **only in tests**.

## Aave fork proof and rounding

The addresses were verified against the official [Aave Base address book](https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol):

- Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- aToken: `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB`

The constructor verifies 6 decimals, deployed code, the aToken's underlying asset and its pool. It does not hardcode Base addresses so that explicit test deployments can use their own contracts. A real deployment therefore still requires checking all supplied addresses against the deployment manifest.

At pinned block **51,893,120**, a local artificial deposit of **100,000,000 raw USDC** returned **99,999,998 raw USDC** on immediate supply/redemption: a two-micro-USDC rounding difference. An initial test assuming only one raw unit of rounding failed and was corrected to record the actual exact behavior at this block. The regression keeps a 100-USDC target locked after that roundtrip, then authenticates an abort, adds the missing **2 raw units**, prepares a new round, and permits completion at exactly **100,000,000**. No rounding tolerance is added to unlock logic.

The second test advances only the fork's local timestamp by one day and observes actual aToken accrual logic. Redemption returns **100,010,879 raw USDC**, followed by a mock-transport commit and full local claim. This is a deterministic fork observation, **not earned live yield or a forecast**, and does not verify real crosschain delivery.

## Scope and remaining work

- Configure and verify an actual two-way pathway using the implemented OApp/codec, measure fees and delivery, and review deployment authority. Local SDK/SBF tests are not network acceptance.
- Review initialization authority, malicious peer behavior, token freezes, protocol upgrades, chain halts and keeper/transport liveness before real funds.
- Select the actual idle reserve/exposure policy and monitoring thresholds. No operator can rewrite this vault's target or withdraw on the owner's behalf.
- Test current deployed-market controls and receipt rounding at deployment time. No-term Aave supply remains subject to protocol liquidity and pause conditions; see [Pool integration](https://aave.com/docs/aave-v3/smart-contracts/pool) and [withdrawal conditions](https://aave.com/help/supplying/withdraw-tokens).
- Handle deployment, indexing, outbound event attestation, retries, remote abort barriers and frontend wallet transactions. None is proven by the unit/fork suite.
- Obtain independent security review. The local tests are meaningful evidence of the tested cases, not an audit or assurance against all loss scenarios.
