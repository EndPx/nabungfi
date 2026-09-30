# Contract-first development

The user directed development to focus on contracts first. Multiple simultaneous savings goals per owner are required. Work on the shared application model, API, goal-selection UI and new 3D assets follows the contract milestones below.

Update, 30 September: the Solana Devnet–Base Sepolia cash pair completed actual registration, 4+6-USDC deposits, reserve-based achievement and partial/full claims through seven public LayerZero messages. [Public lifecycle evidence](../contracts/deployments/layerzero-solana-base-live.json) records the receipts and terminal balances; [LayerZero integration](LAYERZERO_INTEGRATION.md) records current verification and remaining strategy/operations work. Older isolation counts below remain dated historical evidence. Ethereum/Arbitrum components are staging; simultaneous multi-EVM aggregation and Robinhood remain extensions.

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

## 2. Goal creation and peer registration — public cash pair verified

The Base factory creates separate vaults and computes the canonical commitment; the authenticated registration/acknowledgment exchange binds the Solana goal, Base owner, target and configuration. Funding is gated by registration. Public testnet provisioning, actual two-way registration and goal-scoped operator tooling have been exercised for one cash goal. Multi-peer registration and application wallet integration remain work.

Acceptance: wrong owner, target, peer, environment or configuration cannot register a goal pair; an existing funded goal cannot be overwritten or silently rebound. Registration and discovery must not grant an operator withdrawal authority.

## 3. Authenticated crosschain lifecycle

The balance design is detailed in [crosschain balance synchronization](CROSSCHAIN_BALANCE_SYNC.md). Base OApp progress sending and Solana remote snapshot reception are implemented. Full Kamino valuation and freshness projection remain pending. Keep reported progress estimates separate from realized completion reserves.

The common wire format, SDK endpoint/peer checks, durable reports and retry/abort behavior are locally tested. The separate public test route now establishes explicit Endpoint/DVN/Executor configuration, configured confirmations, actual fee funding and delivered REGISTER/REGISTERED/PROGRESS/PREPARE/READY/COMMIT messages. Local packet injection remains a different evidence class. A persistent unattended keeper and production security configuration remain work.

Acceptance: replay and cross-goal substitution fail; delayed READY/ABORT_ACK messages cannot revive an aborted round; interruption and recovery preserve each goal independently. The Base vault still depends on an honest authenticated coordinator for remote reserve evidence.

## 4. Strategy and runtime integration

Build Solana SBF and exercise actual custody, Kamino CPI and minimum-output checks in an explicitly identified test environment. Extend the Aave integration evidence to multiple positions where needed. Reconcile actual receipts, net USDC, rounding, losses and liquidity during preparation; mock return values are insufficient.

## 5. Complete contract journey before application expansion

One actual cash goal has completed the full public lifecycle. Next verify three simultaneous goals through creation, deposits, strategy exits, authenticated completion, partial claims and retry/recovery across both chains. Only then expose those behaviors through the multi-goal application flow. The public single-goal cash proof does not complete multi-goal strategy/keeper/application acceptance.
