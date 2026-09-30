# Contract-first development

The user directed development to focus on contracts first. Multiple simultaneous savings goals per owner are required. Work on the shared application model, API, goal-selection UI and new 3D assets follows the contract milestones below.

Update, 29 September: LayerZero OApps, pair registration, the shared codec and Base progress reception are implemented with local SDK/SBF evidence. The older isolation counts below describe the first pass; [LayerZero integration](LAYERZERO_INTEGRATION.md) records the current 45 EVM + 2 fork + 39 native + 6 SBF test results and remaining network/strategy work. Ethereum, Arbitrum and Robinhood Chain are additional targets requiring multi-peer generalization and chain-specific assets/strategies.

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

## 2. Goal creation and peer registration — implemented locally

The Base factory creates separate vaults and computes the canonical commitment; the authenticated registration/acknowledgment exchange binds the Solana goal, Base owner, target and configuration. Funding is gated by registration. Network provisioning, wallet tooling and multi-peer registration remain required.

Acceptance: wrong owner, target, peer, environment or configuration cannot register a goal pair; an existing funded goal cannot be overwritten or silently rebound. Registration and discovery must not grant an operator withdrawal authority.

## 3. Authenticated crosschain lifecycle

The balance design is detailed in [crosschain balance synchronization](CROSSCHAIN_BALANCE_SYNC.md). Base OApp progress sending and Solana remote snapshot reception are implemented. Full Kamino valuation and freshness projection remain pending. Keep reported progress estimates separate from realized completion reserves.

The common wire format, SDK endpoint/peer checks, durable reports and retry/abort behavior are locally tested. Next verify real endpoint/DVN/executor configuration, finality, fee funding and deployed identities through a two-way test route. Local packet injection does not establish network delivery.

Acceptance: replay and cross-goal substitution fail; delayed READY/ABORT_ACK messages cannot revive an aborted round; interruption and recovery preserve each goal independently. The Base vault still depends on an honest authenticated coordinator for remote reserve evidence.

## 4. Strategy and runtime integration

Build Solana SBF and exercise actual custody, Kamino CPI and minimum-output checks in an explicitly identified test environment. Extend the Aave integration evidence to multiple positions where needed. Reconcile actual receipts, net USDC, rounding, losses and liquidity during preparation; mock return values are insufficient.

## 5. Complete contract journey before application expansion

Verify three simultaneous goals through creation, deposits, strategy exits, authenticated completion, partial claims and retry/recovery across both chains. Only then expose the verified contract behavior through the multi-goal application flow. These milestones are outstanding; the local isolation pass does not complete them.
