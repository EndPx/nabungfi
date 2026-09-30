# NabungFi Solana core

This directory contains an Anchor program with real SPL-token custody instructions and a two-vault completion coordinator. It also contains a Kamino direct-supply/redeem CPI path built with the official pinned `klend-interface`. It is a **local development milestone**, not a deployed or production-ready savings product.

The core and LayerZero transport compile to SBF. Native tests and six LiteSVM transaction scenarios exercise the actual Endpoint bytecode snapshot, plus a test-only message library for outbound fee/packet behavior. Packet verification accounts and balances are seeded locally; no public deployment, DVN quorum, Kamino supply/redeem execution, actual yield or network crosschain delivery is claimed. See [LayerZero integration and reproduction](../../docs/LAYERZERO_INTEGRATION.md).

## Run the checks

From this directory with Rust installed:

```powershell
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo fmt --all -- --check
cargo check --workspace --features idl-build --locked
```

Native Windows Rust/cargo 1.91.0 were used. For a short build-output path on Windows, optionally set `$env:CARGO_TARGET_DIR = Join-Path $env:TEMP 'nabungfi-solana-target'` first. This is not needed by the source code. The locked dependency graph pins Anchor 0.32.1 and Kamino commit `a08760976f51a3a58c4a0c6ea27b4a0e565bca79`.

SBF builds use Agave 4.3.0 and platform-tools 1.57 in WSL. Native `cargo test` remains distinct from the separately executed SBF/LiteSVM suite. The documented runtime commands require Linux/macOS or WSL because the pinned LiteSVM Node package has no Windows binary.

## Implemented behavior

| Instruction | Authority and effect |
|---|---|
| `initialize` | Owner creates a goal with an immutable positive raw-USDC target, fixed Solana strategy, Base owner/vault, and configuration hash. Creates goal-owned USDC and cToken accounts. |
| `deposit` | Owner transfers exact six-decimal USDC into the goal PDA's custody; principal increments once after the handler's phase checks. Only allowed while locked. |
| `supply_kamino` | Owner explicitly authorizes the amount and minimum cToken output. Calls the fixed reserve, with proceeds kept in the goal's own cToken account. |
| `redeem_kamino` | Owner can recall while locked; any signer can help during preparation. Actual USDC returns to the goal account. Minimum output and exact burned-share deltas are checked. |
| `begin_prepare` | Owner starts a numbered completion round. The owner may prepare early; an offchain estimate is never accepted as proof of achievement. Emits an outbound PREPARE command. |
| `mark_local_ready` | Anyone can freeze the actual idle-USDC amount, but all local cTokens must already be redeemed. No amount argument is accepted. |
| `receive_ready` | Requires a registered transport-program PDA signer, correct goal/config/peer/round, and exact next lifecycle sequence. Stores the Base reserved amount. |
| `achieve` | Anyone can finalize only after both vaults are ready and their reserved raw-USDC sum reaches the target. Rechecks local cash and zero share balance. Emits COMMIT. |
| `claim` | Owner receives local USDC only after achievement. Partial/full claims do not relock the goal or alter the achieved total. |
| `begin_abort` / `receive_abort_ack` | Owner can abort a preparing round, but it cannot reopen until an authenticated Base reset acknowledgement arrives. No user payout occurs. |

There is no early user withdrawal, deadline escape, target reduction, transferable receipt, borrowing function, arbitrary call, strategy switch, or mutable peer setter. Upgrade authority is **not** removed by these source-level constraints; deployment governance must be resolved before a strict immutable-lock claim.

The global goal remains `Achieved` after its last local claim. A local closed presentation can be derived from its remaining balance. Unsolicited USDC donations can contribute to actual reserves and become claimable after achievement; they are not misreported as the owner's historical principal. Deposits through the API are disabled during preparation; a below-target round must be aborted/acknowledged before adding normal deposits and starting a new round.

`mark_local_ready` and `achieve` must occur across a slot boundary. This prevents a same-transaction flash-loan top-up/prepare/achieve/claim bypass on the coordinator chain. A slot boundary is not a production finality policy, and it does not prohibit ordinary borrowed funds from being saved.

## Kamino integration and the reserve-address finding

The program uses [Kamino's official low-level builders](https://github.com/Kamino-Finance/klend/tree/a08760976f51a3a58c4a0c6ea27b4a0e565bca79/libs/klend-interface/src/instructions), rather than hand-written discriminators/account ordering. Its direct cToken supply path creates no obligation or borrow position.

The accepted reserve is:

| Account | Pinned address |
|---|---|
| Kamino program | `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` |
| Lending market | `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF` |
| USDC reserve | `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59` |
| USDC mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Recorded cToken mint | `B8V6WVjPxW1UGwVDfxH2d2r8SyT4cqn7dQRK6XneVa7D` |
| Recorded liquidity supply | `Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6` |

The current SDK convenience helpers derive a different cToken mint and liquidity supply for this reserve. The existing dated raw reserve snapshot caught this mismatch in a regression test. The program instead pins the recorded accounts and checks them against the decoded Kamino-owned reserve before CPI. The market authority uses the official `lma` PDA derivation, with the liquidity token account's authority checked as well.

The included offline fixture `programs/nabungfi/testdata/reserve-2026-09-28.bin` is a public 8,624-byte account payload observed **2026-09-28 06:01:26 UTC** via Kamino's API. It is layout/address evidence, not live availability. The test verifies the market, mint, token program, decimals, recorded accounts, direct-cToken permission, and historical available amount. It is self-contained; private research files are not required to run the test.

Before a real strategy call, the transaction builder must prepend the official reserve refresh instruction with the correct oracle accounts. Kamino itself checks its reserve/market conditions, caps, maturity and cash; failures revert the CPI and do not release user funds. The supply wrapper rejects inactive/emergency/permissioned/term configurations and blocked cToken usage. The redeem wrapper does not add a new discretionary lock to exits. If Kamino changes its controls or cannot pay, the goal stays locked/preparing.

Remaining strategy execution work: run the real Kamino binary with its complete account set, prove supply/redeem from the Nabung PDA, measure compute, verify interface/binary compatibility, and exercise liquidity/cap/freeze/error cases. The existing SBF tests cover custody, transport and claims, not Kamino strategy execution. This source pins mainnet reserve identities; it is not a Kamino devnet deployment merely because test USDC exists there.

There is no automatic allocation percentage, keeper-investment authorization, or native onchain cToken-NAV progress report in this milestone. The owner explicitly authorizes supplies. Onchain completion uses only realized reserved USDC, not a UI estimate or projected APY. A reviewed allocation policy and current-position estimator remain separate work.

## Crosschain trust boundary

`TRANSPORT_PROGRAM` now names the local development identity of `programs/nabungfi-lz`. The receiver authenticates the peer and packet, calls the official Endpoint `clear`, then signs `[b"nabung-receiver", goalPda]` for the core CPI. `receive_registered` binds the goal pair before funding; `receive_progress` records absolute Base snapshots without unlocking funds. Replace/review deployment IDs and configure a real pathway before network use. A normal keeper key cannot impersonate the transport PDA.

Core events remain records. The transport's explicit quote/send instructions derive the actual registration or PREPARE/COMMIT/ABORT packet from the Goal; they require caller-funded fees and the correct Endpoint/library accounts. The network pathway and its operator flow have not been deployed or exercised.

The current Base contract and this coordinator agree on these semantic values:

- Application domains: **1 Solana / 2 Base**. These are not chain IDs, LayerZero EIDs, or cluster selectors. A production route must bind cluster/environment as well as these application identities.
- Command kind: **0 Invalid / 1 PREPARE / 2 COMMIT / 3 ABORT**.
- Solana outbound commands use a single exact-next sequence across all rounds. Round increments on each PREPARE only. COMMIT and ABORT consume the same round exclusively.
- Base inbound reports use their own exact-next **lifecycle** counter: READY and ABORT_ACK only. Base progress has a separate counter and cannot create a gap in READY delivery.
- A READY already in flight when Solana starts aborting is consumed without reviving its reserve; the following ABORT_ACK can then be processed. A new PREPARE is blocked until this acknowledgement.
- COMMIT carries the Base vault's exact prepared amount and the aggregate realized reserve. Claims never produce a new target check.

Trace covered in tests: `PREPARE command #1 / round 1 -> READY report #1 in flight -> ABORT command #2 -> consume old READY -> ABORT_ACK report #2 -> PREPARE command #3 / round 2 -> READY report #3 -> COMMIT command #4`.

Solana native instructions use Anchor/Borsh and Base native calls use ABI; crosschain messages use the new fixed 222-byte [wire v1](../../shared/protocol/README.md). A common fixture checks both codecs and the SHA-256 configuration commitment, including the deliberately little-endian target/domain in that commitment. The Base factory predicts its CREATE address inside the creation transaction and computes the same hash. The registration exchange checks goal/configuration/target/owner identity before enabling normal funding.

## Verification evidence

- Native Anchor program, token contexts, Kamino builders and state machine compile.
- 35 native core tests and four native transport tests pass, including the 8,820-case target split loop, multi-goal isolation and common wire/configuration fixtures.
- Both production-intended programs build to SBF; six LiteSVM scenarios execute registration/delegate sealing, actual Endpoint clear, bad-packet/replay rejection, SPL deposits/claims, progress isolation, rollback/retry for out-of-order lifecycle messages, and outbound quote/send against a dedicated test library. These preload packet verification state; they do not establish a live DVN verification path or production SendULN behavior.
- `src/tests/multi_goal.rs` verifies goal-specific reserve totals, preserved state across another goal's completion/claims, independent abort sequences, distinct custody addresses and Anchor rejection of another goal's cash account, receipt account or receiver PDA. These are native state/account-validation tests, not SVM/CPI transactions. See the [contract-first plan](../../docs/CONTRACT_PLAN.md).
- Tests cover one-unit-short targets, missing zero-balance peers, share dust, reserve reduction, loss-aware realized amounts, sequence/round/config/goal replay, abort/commit exclusion, in-flight READY handling, integer overflow and permanent achievement after partial/full claims.
- Two negative tests run Anchor's actual native dispatcher/account checks: a non-signing transport PDA, an arbitrary signed receiver, an early legitimate owner claim and a forged owner are rejected. These host AccountInfo tests are not SVM transaction tests.
- The official reserve layout and actual recorded account identities are checked against the dated public snapshot.
- Clippy passes with warnings denied; formatting and the `idl-build` feature compile.

Before production: actual pathway/finality and deployment identities, Kamino valuation and supply/redeem runtime proof, keeper funding/retry operations, upgrade-authority policy, external review, economic limits and real-network acceptance remain required. The current coordinator has one Base peer per goal; several EVM peers require a broader registry and per-peer readiness. Nothing here guarantees liquidity or earnings.
