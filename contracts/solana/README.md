# NabungFi Solana core

## Current multichain deployment (v2)

Both v2 programs have onchain Anchor IDLs, canonical PMP Codama IDLs and program metadata. On 2026-10-07, all 21 publication transactions finalized, the IDL resolver returned both interfaces, and Solana Explorer decoded the existing owner claim as `NabungfiMulti: Claim`. Program bytecode, deployment slots and authorities remained unchanged. See the [metadata publication record and regeneration commands](../../docs/SOLANA_PROGRAM_METADATA.md).

Separate `nabungfi-multi` and `nabungfi-multi-lz` programs now coordinate one to three immutable EVM participants per goal. One actual four-chain goal completed 4+2+2+2-USDC cash deposits, all-peer reserve readiness, achievement and partial/full claims. All 21 public LayerZero messages were delivered, including three post-claim NAV updates to zero. Solana retained phase Achieved, achieved total10USDC and cumulative claims4USDC; local cash is zero and the owner's initial20USDC restored. [Public v2 receipts](../deployments/multichain/live-goal.json), [program deployments](../deployments/multichain/solana-devnet.json), [v2 runbook](../../docs/MULTICHAIN_TESTNET_RUNBOOK.md).

Use `multichain.env.example` and `script/operate-multichain-goal.mjs` for v2, with the actual verified EVM vault receipts. `programs/nabungfi-multi/README.md` describes the cash-only ABI. New local checks add 15 core and four transport native tests plus six fresh SBF/LiteSVM cases. Default workspace checks total59 tests including the retained v1 suites and test-library identity check. These local scenarios are distinct from the actual public receipts. The local app/shared multiple-goal flow, unattended keeper and real earning remain unfinished.

## Retained v1 pair

The following v1 documentation and identities are historical. Its deployment/lifecycle source is pinned at commit `b64280b28ea771fa8c53beae8e8f061d7651e46a`; the live v1 programs were not upgraded by v2.

This directory contains an Anchor program with real SPL-token custody instructions and a two-vault completion coordinator. Its default profile contains a Kamino direct-supply/redeem CPI path built with the pinned official `klend-interface`. The separate cash-only Devnet core and transport are now deployed; [public receipts](../deployments/solana-devnet.json) record their identities, downloaded ELF hashes and upgrade authority. This is a development deployment, not a production-ready savings product.

The core and LayerZero transport compile to SBF. Local runtime tests pass six default and seven Devnet scenarios using an Endpoint snapshot and a test-only outbound library. Separately, the public Devnet route is now sealed with explicit ULN/DVN/Executor configuration. A real 10 USDC goal completed registration, progress, preparation, readiness, commitment and claims across Solana Devnet and Base Sepolia. Seven public messages were delivered, including a post-claim absolute balance update. Solana's 4 USDC deposit was claimed in 1 + 3 USDC parts; Base's 6 USDC deposit was claimed in 1 + 5 USDC parts. Both vault balances returned to zero while achievement remained permanent. [Public lifecycle receipts](../deployments/layerzero-solana-base-live.json) distinguish these transactions from the local tests.

This v1 route uses Circle testnet USDC and the cash-only profile. It demonstrates real public messaging and cash custody; it does not demonstrate earned yield, Kamino execution or production security. It has one EVM peer; multi-peer public evidence belongs to the separate v2 deployments above. See [LayerZero integration](../../docs/LAYERZERO_INTEGRATION.md) and the [v1 testnet runbook](../../docs/LAYERZERO_TESTNET_RUNBOOK.md).

## Operator tooling

The operator scripts use the official `@layerzerolabs/lz-solana-sdk-v2` version `3.0.168`, its UMI branch, and pinned direct dependencies in `package.json`. Install the workspace with the frozen lockfile. Copy `.env.example` to `.env`, supply a local signer path, and populate the goal fields from an actual confirmed Base vault creation. The runtime reads `.env`; private keys, actual environment files and receipt journals stay outside Git.

Run from the repository root:

```bash
pnpm install --frozen-lockfile
node contracts/solana/script/layerzero-config.mjs --env contracts/solana/.env
node contracts/solana/script/operate-goal.mjs state --env contracts/solana/.env
node contracts/solana/script/operate-goal.mjs deposit --amount 4000000 --env contracts/solana/.env
pnpm --filter @nabungfi/solana-runtime test:tooling
```

`layerzero-config.mjs` only plans and simulates the unsealed route. Its `--phase` values select initialization, library configuration, or an individual security configuration. `wire-layerzero.mjs --broadcast` submits the reviewed reversible configuration in packet-sized phases, records the signature before sending and verifies the resulting state. It never seals the route; sealing follows the actual goal quote and receive-discovery checks in the runbook. A sealed route cannot be configured again through these scripts.

`operate-goal.mjs` defaults to simulation. Amounts are raw six-decimal USDC units. Its actions are `initialize`, `register`, `deposit`, `prepare`, `local-ready`, `achieve`, `send-command`, `claim` and `state`. State checks and the contracts enforce the order: registration must be received before deposits; readiness must come from real reserved balances; achievement must precede claims. The initialized Solana goal must match the actual Base factory vault configuration hash. This CLI targets the currently deployed Solana Devnet/Base Sepolia pair.

To submit a reviewed intent, add `--broadcast --operation-id <unique-intent-id>` and set `NABUNGFI_TRANSACTION_JOURNAL` to a private local path. Reuse an intent ID only to reconcile that same operation. The journal compares instruction fingerprints, checks the original signature, and refuses automatic replacement of unresolved or expired submissions. The live fee is quoted through the deployed transport/ULN, bounded by `NABUNGFI_MAX_MESSAGE_FEE_LAMPORTS`, and sent with a 500,000 compute-unit limit. The default CLI was checked against the completed goal: state reads succeeded, and a further simulated claim correctly failed with `InsufficientFunds` without broadcasting.

## Run the checks

### Cash-only Devnet profile

Build both programs with `--features devnet` into a distinct `target/deploy-devnet`
directory. The default build retains the local identities and pinned mainnet
Kamino configuration used by the golden fixtures; it must not be deployed as a
Devnet artifact. The Devnet build uses owned deployment identities:

| Field | Devnet value |
|---|---|
| Core program | `3tPb29y74ycYSHa6Pz1tsUTsnaD6Xh9HPEzFKtWnwXM4` |
| Transport program | `Fez821Y7EAC8rLNqG1WeVmVAcSZPKtd3QuQxFuAiCc5A` |
| Transport Store PDA | `5fMoiRiAghVMDtKYfJno7FFy8WF1hbwDV1iuKhHxtJ49` |
| USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Inert collateral mint | `2qBnsAsYjJ1cBaWQ28kChUo4dtMkYynetMY8FUTe4p3E` |

The collateral mint must have zero supply and both mint/freeze authorities
revoked; `initialize` validates those conditions. It is a separate classic SPL
mint, so sending USDC to the cash vault cannot create strategy shares. The
configuration's market, reserve, collateral and liquidity-supply fields all
commit to this inert mint address. Those four fields do **not** identify Kamino
accounts in this profile. `supply_kamino` and `redeem_kamino` explicitly fail with
`StrategyDisabled`; no simulated yield is added. Their Devnet account context is
only caller and goal, so unavailable reserve accounts cannot obscure that error.
These two instruction account layouts intentionally differ from the default
profile. `Anchor.toml` selects program addresses, not Cargo features or an ABI;
clients must use the matching profile's IDL/account list. The argument layouts
and the remaining cash/coordination instruction accounts are unchanged.
Cash custody, owner restrictions, registration, reserve-based completion,
cross-slot checks and claims preserve the same lifecycle rules.

The transport `devnet` feature forwards to the core. The core authenticates the
owned transport ID, and the EVM router's Solana peer must be the **Store PDA**, not
the transport program ID. Anchor's Devnet program map agrees with these IDs.
Build tooling may create new random keypair files automatically; deploy only
with the original owned keypairs whose public addresses match this table.
Keypairs and compiled binaries stay ignored by Git.

```powershell
cargo test --workspace --locked --features devnet
cargo clippy --workspace --all-targets --locked --features devnet -- -D warnings
cargo check --workspace --locked --features "devnet,idl-build"
```

For the LiteSVM suite, set `NABUNGFI_TEST_PROFILE=devnet` and point
`NABUNGFI_SBF_DIR` to the distinct Devnet artifact directory. It runs the six
existing scenarios plus a compiled-runtime strategy-disable test. The same
test-only message-library binary is required in that directory. This remains
local bytecode execution, not a public DVN or Executor delivery result.

On 2026-09-30, the current source passed all checks without ignored tests:

| Profile | Native core | Native transport | Fresh SBF/LiteSVM |
|---|---:|---:|---:|
| Default | 35 | 4 | 6 |
| Cash-only Devnet | 38 | 4 | 7 |

The test-only message library contributes one additional native ID check in each
workspace run. Clippy with warnings denied, IDL-feature compilation, and
formatting also passed. Core and transport were built separately for **both**
profiles before the corresponding runtime suite ran; the default runtime
results do not rely on an older cached ELF. None of these checks executes a
public DVN quorum or Kamino supply/redeem.

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

The default profile's `TRANSPORT_PROGRAM` names the local development identity; the `devnet` feature binds the actual deployed transport `Fez821Y7EAC8rLNqG1WeVmVAcSZPKtd3QuQxFuAiCc5A`. The receiver authenticates the peer and packet, calls the official Endpoint `clear`, then signs `[b"nabung-receiver", goalPda]` for the core CPI. `receive_registered` binds the goal pair before funding; `receive_progress` records absolute Base snapshots without unlocking funds. The reviewed Devnet deployment IDs and sealed route are recorded in the manifests. A normal keeper key cannot impersonate the transport PDA.

Core events remain records. The transport's explicit quote/send instructions derive the actual registration or PREPARE/COMMIT/ABORT packet from the Goal; they require caller-funded fees and the correct Endpoint/library accounts. The operator-driven Devnet–Base Sepolia cash pathway has been exercised through actual delivery and full claims; [public evidence](../deployments/layerzero-solana-base-live.json) is separate from the default-profile runtime fixtures. An unattended keeper has not been proven.

The historical v1 Base contract and coordinator agree on these semantic values:

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

Before production: a reviewed production security/finality configuration and deployment identity set, Kamino valuation and supply/redeem runtime proof, persistent keeper funding/retry operations, upgrade-authority policy, external review, economic limits and production-network acceptance remain required. The completed public testnet cash lifecycle does not establish those properties. The historical v1 coordinator has one Base peer per goal; the separate v2 coordinator above implements the immutable participant registry and per-peer readiness for up to three EVM peers. Nothing here guarantees liquidity or earnings.
