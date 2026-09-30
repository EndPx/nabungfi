# LayerZero integration: implementation and evidence

Rechecked 30 September 2026. The code integrates LayerZero V2 OApp sending/receiving for the Solana–Base goal pair. It is locally verified, not a deployed or audited financial product. Native funds and strategy receipts remain on their original chains.

## Components

- `contracts/evm/src/NabungLzRouter.sol`: inherits the official OApp; authenticates the endpoint/peer and dispatches registered goal packets. It exposes quote/send functions for registration acknowledgments, stored READY/ABORT_ACK reports and freshly computed Base progress.
- `contracts/evm/src/NabungVaultFactory.sol`: creates genuine vault instances, computes their CREATE address inside the transaction, and constructs the same configuration hash as Solana. Pending unregistered clones cannot reserve or rebind another owner's coordinator.
- `contracts/evm/src/NabungGoalVault.sol`: requires authenticated pair registration before ordinary funding/preparation and stores immutable lifecycle reports by sequence, so an unsent READY remains relayable after ABORT.
- `contracts/solana/programs/nabungfi-lz`: official Endpoint register/quote/send/clear CPIs, immutable peer configuration, route sealing, receive-account discovery v2, and goal-bound CPI calls to the coordinator.
- `contracts/solana/programs/nabungfi`: linked-goal funding guard, registration/progress receivers, deterministic outbound commands and a remote progress snapshot. A high progress snapshot never writes readiness or achievement.
- `contracts/solana/tests/programs/test-messagelib`: a test-only SBF message library at a dedicated local program ID. It charges a fixed fee and records packets for the send-side runtime checks. It is not a production SendULN, DVN or Executor.
- `shared/protocol/wire-v1.json`: common Solidity/Rust packet and configuration-hash fixture. [Wire specification](../shared/protocol/README.md).

## Pinned dependencies

| Dependency | Pin |
| --- | --- |
| EVM OApp | `@layerzerolabs/oapp-evm` 0.4.1 |
| EVM protocol/message libraries | 3.0.168 |
| OpenZeppelin | 5.7.0 |
| Solana OApp | `oapp-latest` at LayerZero-v2 commit `9c741e7f9790639537b1710a203bcdfd73b0b9ac` |
| Anchor | 0.32.1 |
| Runtime tests | LiteSVM 1.5.0, Solana Kit 8.0.0 |

The Solana dependency is the upstream `solana/anchor-latest` implementation, not the older Anchor 0.29 library. The endpoint-interface crate supplies CPI bindings; its placeholder Rust handlers are not deployed or used as the Endpoint implementation in the runtime tests.

## Pair creation and messaging

1. Configure the real route, explicit verification libraries/DVNs/confirmations, and execution budgets. Initialize the Solana Store using the transport program's upgrade authority; register it with the Endpoint. Bootstrap is not permissionless first-caller ownership.
2. Seal both routes. Base changes the endpoint delegate to the router and renounces OApp ownership. Solana changes its endpoint delegate to the Store PDA; no instruction exposes later peer/configuration changes. Solana upgrade authority is still a separate deployment control that must be reviewed.
3. The Base owner calls `createGoal`, supplying the intended Solana owner/PDA, goal ID, target and idle floor. The factory returns the actual vault and canonical configuration commitment.
4. The Solana owner initializes the corresponding Goal using that vault and Base owner. Its independently computed configuration hash must match.
5. A caller quotes and sends Solana registration with application sequence zero. The Base receiver validates owner/goal/configuration/target and records the pair. A caller sends the Base registration acknowledgment; Solana sets `linked` only after authenticated delivery. Ordinary deposits stay disabled before registration on each side.
6. The Solana owner starts preparation. Its transport quotes/sends the state-derived PREPARE command. After Base redemption, `markReady` persists the actual USDC report. A caller quotes/sends that stored report.
7. The Solana receiver validates the peer and complete packet identity, then calls the real Endpoint `clear` before invoking coordinator readiness logic. The coordinator commits only when both goal-local reserves meet the target and its local readiness checks pass.
8. A caller quotes/sends COMMIT. Base checks its exact reserve/round and enables owner claims. Claims retain permanent achievement and do not bridge tokens.

Callers fund messaging fees. Solana send/quote instructions require the correct Endpoint/library accounts; EVM sends use the quoted native fee and caller-supplied execution options. Configuring/quoting adequate options and maintaining a keeper are still operational work. Events alone do not deliver a packet.

## Retry and isolation properties

- Base lifecycle reports remain in the outbox after phase changes. Sending a report takes its stored value; the caller cannot choose a balance.
- Solana can reproduce PREPARE while the same round is aborting or achieved. A completed abort acknowledgment proves the previous commands were consumed before opening a new round.
- LayerZero pathway nonces are separate from per-goal lifecycle/progress sequences. Verified stale lifecycle retries are consumed without changing an already advanced goal. Future lifecycle messages still fail until their required predecessors arrive.
- Progress replaces the previous absolute snapshot, permits decreases, and ignores obsolete application sequences. Source observation time and receipt time are separate. A freshness projection and current Kamino NAV path remain unfinished.
- Peer and goal/configuration/source/destination/owner checks precede application updates. Solana `clear` and the subsequent core CPI are atomic in the tested runtime: a failed core transition rolls back packet consumption.

## Verification

| Check | Result |
| --- | --- |
| Base local suite | 45 passing tests, including 9 OApp/codec/factory tests, 6 multi-goal tests and the existing 256-case conservation fuzz test |
| Pinned Base Aave fork | 2 passing tests at block 51,893,120; artificial balances and local time advance |
| Solana native | 35 core tests + 4 transport tests passing; the test-only message library also passes its program-ID check |
| Solana SBF | Both core and transport compiled with Agave 4.3.0 / platform-tools 1.57 |
| LiteSVM | 6 passing SBF transaction scenarios using an actual LayerZero Endpoint bytecode snapshot; send/quote use a test-only fixed-fee library |
| Rust checks | Clippy with warnings denied, formatting and IDL-feature compilation pass |

The runtime cases exercise bootstrap authority and Endpoint registration/delegate sealing, bad payload hash/peer/goal rejection, replay, SPL-token deposit/claim, progress isolation, achievement with surplus, and out-of-order abort recovery with transaction rollback. The send-side scenario checks that the Core Goal supplies the registration, PREPARE and COMMIT bytes, that quote matches the fixed fee, the payer funds it, and underpayment rolls back the Endpoint nonce.

The LayerZero Endpoint fixture was read from the public Solana deployment `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6`; SHA-256 is `caa868d80b000c488e60e99828e366e773dde877ccc92b67f81df03b608639d4`. Tests preload artificial token balances and the Endpoint's already-verified packet accounts. They execute the Endpoint's actual hash check/clear and subsequent CPIs, but **do not run DVNs, prove source-chain finality or deliver messages over a public network**. The Base endpoint remains an explicitly labeled harness. The Solana send/quote tests use a test-only message library and therefore do not establish SendULN/DVN/executor fee behavior.

## Reproduce

Install JavaScript dependencies from the root using `pnpm install --frozen-lockfile`. EVM reproduction is in its package README. Rust checks run from `contracts/solana`:

```sh
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo check --workspace --features idl-build --locked
```

For SBF and LiteSVM, use Linux/macOS (or WSL), Node 24, Agave 4.3.0 and platform-tools 1.57. Build the two packages separately so the transport's `cpi` feature does not suppress the core's standalone entrypoint:

```sh
# From contracts/solana
cargo-build-sbf --tools-version v1.57 --manifest-path programs/nabungfi/Cargo.toml --sbf-out-dir target/deploy -- --locked
cargo-build-sbf --tools-version v1.57 --manifest-path programs/nabungfi-lz/Cargo.toml --sbf-out-dir target/deploy -- --locked
cargo-build-sbf --tools-version v1.57 --manifest-path tests/programs/test-messagelib/Cargo.toml --sbf-out-dir target/deploy -- --locked

# From repository root; this only reads a public program, it does not deploy anything.
mkdir -p .local/svm-fixtures
solana program dump --url https://api.mainnet-beta.solana.com 76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6 .local/svm-fixtures/layerzero-endpoint.so
pnpm --filter @nabungfi/solana-runtime test:sbf
```

The SVM test enforces the fixture hash. A future Endpoint upgrade requires an explicitly reviewed fixture update; do not bypass the mismatch or call a different binary equivalent evidence. `NABUNGFI_SBF_DIR` and `NABUNGFI_ENDPOINT_ELF` can point to alternate local artifact paths. `NABUNGFI_TEST_PACKAGE_JSON` supports using a separate Linux dependency install when the checkout's node_modules were installed on Windows. Generated binaries, toolchains, local keys and snapshots are ignored by Git.

## Remaining release work

Actual deployment identities and environment/token configuration, explicit security-stack verification before sealing, funded two-way testnet messages and fee/compute measurements, a keeper/retry operator flow, current Kamino valuation and supply/redeem CPI evidence, upgrade-authority policy, and independent review remain required. Current program IDs are local development identities. No public deployment or real-fund transaction was performed.

The implemented coordinator/transport has one registered EVM peer (Base). Ethereum, Arbitrum and Robinhood Chain are additional product/track candidates; supporting several EVM peers in the same goal requires a registered peer set, per-peer sequences/readiness and reserve aggregation. The current domain `2` must not be reused to combine several chains silently.
