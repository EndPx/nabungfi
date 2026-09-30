# Contract-first development

The user directed development to focus on contracts first. Multiple simultaneous savings goals per owner are required. Work on the shared application model, API, goal-selection UI and new 3D assets follows the contract milestones below.

Update, 1 October 2026: one v2 goal completed actual registration, 4+2+2+2-USDC deposits, all-participant reserve-based achievement and partial/full claims across Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. [Four-chain evidence](../contracts/deployments/multichain/live-goal.json), [operator runbook](MULTICHAIN_TESTNET_RUNBOOK.md) and [v2 protocol plan](MULTICHAIN_V2_PLAN.md) record this milestone. Latest checks: 71 EVM units, three v2 network forks, 59 native Rust checks and six v2 SVM scenarios. Older isolation counts below remain historical evidence. Robinhood, unattended operation and financial earning remain unfinished.

## 1. Local goal isolation — verified within the stated boundaries

The existing per-goal storage design was retained. Six Base tests in `contracts/evm/test/MultiGoalIsolation.t.sol` and seven Solana tests in `contracts/solana/programs/nabungfi/src/tests/multi_goal.rs` exercise one owner with car, laptop and house goals.

- Base: separate USDC/receipt balances, deposits, interest and losses; complete/claim one goal while preserving others; reject misrouted commands; keep rounds and progress counters independent; permit a cash-funded goal to finish while another goal's invested funds cannot redeem.
- Solana: separate goal/cash/receipt/receiver PDA addresses; goal-specific reserve totals; independent completion, claim records and abort sequences; reject cross-goal cash accounts, receipt accounts and receiver PDAs through Anchor's native dispatcher/account checks.

Verification on 28 September 2026:

| Check | Result |
| --- | --- |
| `forge test --no-match-path 'test/fork/*' -vv` | 36 passed, including the existing 256-case conservation fuzz test |
| `forge fmt --check` | Passed |
| `cargo test --workspace --locked` | 29 passed, including the existing 8,820-case target-split loop |
| `cargo fmt --all -- --check` | Passed |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | Passed |

Base isolation tests use a mock pool/token/transport. Solana tests execute native Rust logic and Anchor account validation, not SVM transactions or token CPI. The prior two pinned Aave fork tests were not rerun in this isolation pass. No deployed bridge, new protocol yield or network execution is established.

## 2. Goal creation and peer registration — public four-chain cash goal verified

Each v2 EVM factory creates a separate vault and commits its actual identity, domain/EID, asset, router, owner, target and Solana identities in a SHA256 leaf. Solana initializes with a fixed participant set only after all actual EVM vault receipts exist. The authenticated registration/acknowledgment exchanges were exercised for all three peers of the same cash goal. Solana deposits require all acknowledgments; each EVM vault independently gates its own authenticated pair registration, and normal orchestration waits for the global registration barrier. Application wallet integration remains work.

Acceptance: wrong owner, target, peer, environment or configuration cannot register a goal pair; an existing funded goal cannot be overwritten or silently rebound. Registration and discovery must not grant an operator withdrawal authority.

## 3. Authenticated crosschain lifecycle

The balance design is detailed in [crosschain balance synchronization](CROSSCHAIN_BALANCE_SYNC.md). Each EVM OApp publishes its own absolute snapshot; Solana stores per-peer sequences, observations and reserves. All three bidirectional routes use real public LayerZero delivery. Full Kamino valuation and an application freshness projection remain pending. Keep reported progress estimates separate from realized completion reserves.

The NBFG v2 wire format, SDK endpoint/peer checks, durable reports and retry/abort behavior are locally tested. Public component and goal receipts establish explicit Endpoint/DVN/Executor configuration, actual fee funding and delivered REGISTER/REGISTERED/PROGRESS/PREPARE/READY/COMMIT messages across the participant set. Achievement requires local readiness and every registered peer's same-round READY reserve. Local packet injection remains a different evidence class. A persistent unattended keeper and production security configuration remain work.

Acceptance: replay and cross-goal substitution fail; delayed READY/ABORT_ACK messages cannot revive an aborted round; interruption and recovery preserve each goal independently. Every EVM vault still depends on its honest authenticated coordinator for remote reserve evidence. V2 domain/EID namespaces prevent equal address bytes on different chains from being counted as the same participant or being attributed twice.

## 4. Strategy and runtime integration

SBF/runtime custody and public four-chain cash claims are verified. Next exercise actual Kamino CPI, refreshed NAV and minimum-output checks in an explicitly identified environment, and demonstrate real Aave allocation/redemption within a registered v2 goal. Arbitrum's adapter is available but was idle in the cash proof. Reconcile receipts, net USDC, rounding, losses and liquidity; cash completion or mock return values are insufficient earning evidence.

## 5. Complete contract journey before application expansion

One actual four-chain cash goal has completed the full public lifecycle. Next verify three simultaneous goals through creation, deposits, strategy exits, authenticated completion, partial claims and recovery across the registered chains. The UI/shared-model collection migration remains required. The public single-goal cash proof does not complete multi-goal strategy/keeper/application acceptance.

The earlier v1 pair and receipts remain historical evidence at [source commit b64280b](https://github.com/EndPx/nabungfi/tree/b64280b28ea771fa8c53beae8e8f061d7651e46a). The new virtual domain accessor changes source/compilation metadata; do not compare current v1-named compilation outputs to historical binaries as if their hashes must match.
