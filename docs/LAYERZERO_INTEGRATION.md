# LayerZero integration: implementation and evidence

Rechecked 1 October 2026. One v2 goal completed registration, 4+2+2+2-USDC deposits, all-peer reserve-based achievement and partial/full claims across Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. **All 21 LayerZero messages reached DELIVERED**, including each EVM peer's post-claim zero-balance report. [Public lifecycle evidence](../contracts/deployments/multichain/live-goal.json), [component manifests](../contracts/deployments/multichain/) and [operator runbook](MULTICHAIN_TESTNET_RUNBOOK.md) identify transactions and terminal state. Funds stayed on their original chains. This is an operator-driven testnet cash proof, not an audit, unattended service or earning demonstration.

## Active v2 components

- `NabungMultiLzRouter`: official OApp boundary per EVM chain, with strict chain/domain/EID checks, immutable Solana peer and authenticated goal registration. Sends actual goal-state progress and durable lifecycle reports.
- `NabungMultiVaultFactory`: creates separate actual vault instances and commits domain/EID, asset, router, vault, owner, target and Solana identities in each SHA256 leaf.
- `NabungMultiGoalVault`: reuses the reviewed parent accounting through an immutable participant-domain accessor; local reserve/claim rules remain goal-specific.
- `NabungMultiWire`: NBFG version 2, fixed 222-byte big-endian packets, neutral `evmOwner` field and exact source/destination-domain validation.
- `contracts/solana/programs/nabungfi-multi`: cash-only coordinator with an immutable sorted participant set, independent peer registration/progress/lifecycle state and checked all-peer reserve aggregation.
- `contracts/solana/programs/nabungfi-multi-lz`: Endpoint register/quote/send/clear CPIs, per-domain peers, route sealing, receive-account discovery and goal-bound core CPIs.
- [wire-v2.json](../shared/protocol/wire-v2.json): Solidity/Rust packet and three leaf-hash fixtures. [Protocol design](MULTICHAIN_V2_PLAN.md).

Domain/EID namespaces are Solana **1/40168**, Base **2/40245**, Arbitrum **3/40231** and Ethereum **4/40161**. Equal address bytes on different EVM chains are valid distinct participants. Neither portfolio totals nor duplicate reserve attribution may unlock a goal.

V1 `NabungLzRouter`, `NabungVaultFactory`, `NabungWire`, `nabungfi` and `nabungfi-lz` remain for historical reproduction and regressions. Their public pair proof is pinned to [source commit b64280b](https://github.com/EndPx/nabungfi/tree/b64280b28ea771fa8c53beae8e8f061d7651e46a). Adding the parent vault's virtual domain accessor changes source and compilation metadata. Current v1-named source is not byte-for-byte evidence for the older deployed artifacts.

## Dependencies

| Dependency | Pin |
| --- | --- |
| EVM OApp | `@layerzerolabs/oapp-evm` 0.4.1 |
| EVM protocol/message libraries | 3.0.168 |
| OpenZeppelin | 5.7.0 |
| Solana OApp | `oapp-latest` at LayerZero-v2 commit `9c741e7f9790639537b1710a203bcdfd73b0b9ac` |
| Anchor | 0.32.1 |
| Runtime tests | LiteSVM 1.5.0, Solana Kit 8.0.0 |
| Solana operator tooling | LayerZero Solana SDK 3.0.168, UMI 0.9.2, web3.js 1.95.8 |

The Solana dependency is upstream `solana/anchor-latest`, not the old Anchor 0.29 library. Interface crate placeholder handlers are not the deployed Endpoint implementation.

## Goal provisioning and delivery

1. Deploy fresh v2 components and configure explicit send/receive libraries, required DVN, confirmations and Executor on all three bidirectional routes. Bootstrap the Solana Store with the program's upgrade authority; it is not permissionless first-caller ownership.
2. Independently audit configuration, worker quotes and execution budgets, then seal the EVM routes before `createGoal` is callable. This sets each delegate to its router and renounces ownership. Keep Solana unsealed at this stage.
3. Create an unfunded EVM vault on every participant chain using the same goal ID, Solana owner/PDA and target. Record actual `VaultCreated` receipts and pair-specific hashes.
4. Initialize one Solana Goal with the sorted immutable participant set only after all actual vault receipts exist. Each independently computed leaf must match. Run the three actual goal-dependent RPC quotes and receive-account discovery simulations, then seal Solana and set its delegate to the Store PDA. No configuration forwarding remains; retained Solana upgrade authority is a separate control. V2 supports one to three EVM domains; this proof uses all three.
5. Send REGISTER separately to each peer, then deliver each REGISTERED acknowledgment. Solana deposits require every peer linked. Each EVM vault independently enforces its own authenticated pair registration; normal orchestration waits for all acknowledgments before any funding.
6. Start one preparation round and send its state-derived PREPARE to each participant. Redeem any strategy position on its own chain; `markReady` requires zero remaining receipts and snapshots actual USDC. Send each durable READY report.
7. Authenticate peer EID/OApp and complete goal/leaf/owner/vault identity before Endpoint `clear` and the atomic core CPI. Achievement requires local readiness, its cross-slot boundary, **every** participant READY for that round, and checked reserve sum at least equal to target. Missing or illiquid peers block completion. A zero-reserve participant still must register and become READY.
8. Deliver COMMIT to every peer with its exact local reserve and the global achieved sum. Each destination enables only its owner's claims. Partial/full claims never erase achievement. Post-claim progress may decrease without relocking funds.

Callers pay messaging fees. Solana quote/send requires the correct Endpoint/library/worker accounts; EVM sends use quoted native fees and execution options. DVNs verify and Executors deliver packets; the application operator or future keeper decides when to request/send them. Emitting events alone is insufficient delivery.

The reviewed testnet security stack has one required LayerZero Labs DVN, no optional DVNs and explicit ULN302/Executor configuration. EVM send/receive confirmations are Base **2/10**, Arbitrum **1/10**, Ethereum **2/10**; Solana counterparts match the corresponding direction. This single-operator test stack is not a production quorum. Actual configuration and options are recorded in component/lifecycle manifests.

## Sequence, retry and accounting boundaries

- Per-peer progress is an absolute snapshot; newer values replace rather than add, can decrease, and keep source observation time separate from receipt time. It never writes prepared reserves or achievement.
- LayerZero pathway nonces differ from goal/peer application sequences. Stale authenticated messages do not change advanced state; future lifecycle sequences remain retryable after predecessors arrive.
- EVM lifecycle reports survive phase changes in durable outboxes. A caller sends the stored report and cannot choose a replacement balance.
- Abort requires all participant acknowledgments before another round. Delayed READY must not restore an aborted round; committed achievement cannot be aborted or relocked.
- Endpoint clear and core CPI are atomic in the tested Solana runtime: a failed transition rolls back packet consumption.
- Financial operation retries reconcile the original signature/hash and semantic intent, including goal, network, amount and claim offset. A new wallet nonce is not proof that the intended operation never succeeded.
- EVM vaults trust their authenticated Solana coordinator's remote-reserve certification. The testnet's retained upgrade authority and worker liveness remain explicit trust/operations boundaries.

## Verification and evidence classes

| Check | Latest result and scope |
| --- | --- |
| EVM units | **71 passed**, including v1 regressions, v2 codec/leaf/domain tests and exact security pins; conservation fuzzing runs 256 cases |
| V2 EVM forks | **Three passed**, using real testnet dependencies and deployment/config scripts; balances and authenticated arrivals are local injections |
| Native Rust | **59 checks passed** in the latest selected verification profile |
| V2 SBF/LiteSVM | **Six scenarios passed** with fresh binaries and the actual Endpoint fixture; packet verification accounts are precommitted locally |
| Public v2 cash journey | **21 messages DELIVERED**, actual 4+2+2+2-USDC custody, all-peer achievement and partial/full claims |

Earlier v1 gates included 64 EVM units, 17 retained pinned fork cases plus a configuration fork, native 35+4 default or 38+4 Devnet checks, and six default/seven Devnet SVM scenarios. They remain dated prior results rather than extra new v2 public executions. The [historical v1 manifest](../contracts/deployments/layerzero-solana-base-live.json) records its separate seven-message 4+6-USDC cash proof.

The v2 SVM cases cover registration/sealing, all-peer readiness and claims, wrong domain/peer/goal/account rejection, absolute progress, abort rollback, independent peer send nonces/fee failures, and multiple owner goals. Local send/quote uses a test-only message library. Neither that library nor injected verification accounts represent public DVN/Executor delivery.

The Endpoint fixture is public program `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6`, SHA256 `caa868d80b000c488e60e99828e366e773dde877ccc92b67f81df03b608639d4`. A future Endpoint upgrade requires a reviewed fixture update, not bypassing its hash guard. Interface bindings alone, tests or source verification are not network-execution proof.

## Reproduction

Install root JavaScript dependencies with `pnpm install --frozen-lockfile`. Run Foundry commands in [the EVM package](../contracts/evm/README.md). Native checks run from `contracts/solana`:

```sh
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo check --workspace --features idl-build --locked
```

For Linux/macOS or WSL SBF/runtime checks, use Node 24, Agave 4.3.0 and platform-tools 1.57. Build the core/transport separately so the transport's `cpi` feature does not suppress the core entrypoint:

```sh
# From contracts/solana
cargo-build-sbf --tools-version v1.57 --manifest-path programs/nabungfi-multi/Cargo.toml --sbf-out-dir target/deploy-multichain -- --locked
cargo-build-sbf --tools-version v1.57 --manifest-path programs/nabungfi-multi-lz/Cargo.toml --sbf-out-dir target/deploy-multichain -- --locked
cargo-build-sbf --tools-version v1.57 --manifest-path tests/programs/test-messagelib/Cargo.toml --sbf-out-dir target/deploy -- --locked

# From repository root; public program read only, no deployment.
mkdir -p .local/svm-fixtures
solana program dump --url https://api.mainnet-beta.solana.com 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 .local/svm-fixtures/layerzero-endpoint.so
node --test contracts/solana/tests/multichain.svm.test.mjs
```

`NABUNGFI_TEST_PACKAGE_JSON` supports an alternate Linux dependency install when checkout dependencies are Windows-native. Generated binaries, keys, toolchains and snapshots stay ignored. Recorded profiles, public-operation commands and original-signature recovery are in the [v2 runbook](MULTICHAIN_TESTNET_RUNBOOK.md) and [Solana package](../contracts/solana/README.md); public operations are separate from the local commands above.

## Remaining product and release work

All four cash balances were claimed, with permanent achievement retained; post-claim EVM snapshots returned to zero. Base/Ethereum/Solana use cash-only profiles. Arbitrum has a compatible Aave adapter but its demonstrated 2 USDC stayed idle. **No earning was demonstrated.**

The shared model, API and UI still simulate one goal and are not connected to these deployed flows. Multiple concurrent public goals, wallet integration, an unattended keeper/indexer, refreshed Kamino valuation/CPI, a demonstrated v2 earning path, investment policy and production security review remain work. Robinhood and Chainlink CRE are not included. No mainnet operations or assurance against all loss scenarios are claimed.
