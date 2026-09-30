# Concurrent-goal cash and keeper proof

The [public evidence](../contracts/deployments/multichain/concurrent-goals-live.json) records three simultaneously funded goals for one owner across Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. This is separate from the earlier [single-goal 21-message proof](../contracts/deployments/multichain/live-goal.json) and historical v1 receipts.

| Goal | Target/achieved/claimed total | Claim on each chain | Final twelve-vault result |
| --- | --- | --- | --- |
| Car | 8 USDC | 2 USDC | Cash/NAV zero, achievement retained |
| Laptop | 4 USDC | 1 USDC | Cash/NAV zero, achievement retained |
| House | 12 USDC | 3 USDC | Cash/NAV zero, achievement retained |

The keeper journal contains **118 coordination intents**:100 actual delivered LayerZero packets and18 local preparation/readiness/achievement actions. Packets comprise 9 REGISTER,9 REGISTERED,55 PROGRESS,9 PREPARE,9 READY and 9 COMMIT. Root explicitly signed funding and **12 claim transactions**; the daemon did not transfer savings on users' behalf. Each chain's owner account finished with its original 20 USDC.

## Reproduction sequence

1. Use actual created vaults and initialized Solana goals from the evidence, sealed route identities and immutable leaves. The public keeper config is a placeholder; fill an ignored local copy from verified receipts. Preserve per-goal/per-peer IDs and raw six-decimal units. [Keeper package](../contracts/keeper/README.md).
2. Inspect with `node contracts/keeper/src/cli.mjs --config .local/keeper.json --once`. It validates/simulates and does not submit transactions. Start the authorized loop with `--broadcast`; use shared exclusive signer locking and finite per-message/day/cycle/gas/native-floor policies. [Operations](KEEPER_OPERATIONS.md).
3. Wait for every REGISTER/REGISTERED link. Gracefully stop/reconcile the keeper and hold the same operator lock for explicit owner deposits. In the recorded run, each goal initially received1 USDC on each of four chains: portfolio12 USDC, each goal4 USDC.
4. Run actual read-only negative claim simulations: car/house remain locked despite portfolio totals meeting/exceeding their individual targets. Those simulations never broadcast.
5. Release the operator lock and resume the unchanged keeper policy. Laptop's own4 USDC permits automatic preparation/readiness/achievement/COMMIT; car/house remain locked. Wait for destination states rather than merely source submission.
6. Pause/reconcile before owner claims and record real receipts/conservation and sibling state. The chronology below explains the earlier baseline used by this run; future runs should inspect a completed immediate pre-claim capture before proceeding.
7. Explicitly top up car by1 USDC per chain and house by2 USDC per chain, under the owner lock. Resume coordination, wait for actual COMMIT, then separately claim2/3 USDC per chain. Final cash/NAV is zero for all 12 vaults and permanent achieved totals are8/4/12.
8. Resume the daemon to deliver decreasing post-claim progress. At the recorded endpoint it is active locally in WSL but terminal-zero idle with no new signed actions. It cannot run while the host sleeps/offlines; this is not hosted-service or uptime acceptance.

The existing receipts are historical operations, not permission to replay funding/claims. New runs require fresh goals, current identities/resources and preserved semantic journals. Never reset state, switch a goal ID or choose a new nonce merely because the original outcome is unclear.

## Honest claim-isolation chronology

The actual full baseline was observed **30 September 2026 21:41:04.421UTC**, before the earliest laptop claim intent at **21:50:16.594654UTC**. An attempted immediate pre-claim capture failed. Root advanced the approved claim batch before noticing that failure; no later state was relabeled as before.

The late capture at **21:52:41.362UTC** already includes claims and is labeled **during claims**. The actual after capture is **21:59:39.204UTC**. Car/house cash, principal, claims, identity/configuration, phase, round and readiness/reserve state compare exactly. Observer progress sequences, observation/receipt times and read blocks changed between the earlier baseline and daemon pause; their before/after data is disclosed separately rather than normalized silently. See `laptopClaimIsolation` in the manifest.

## Restart and budgets

The live restart preserved 24 original intent hashes; the after journal has 29 entries because new work followed. A progress packet described as pending in an earlier observation was actually delivered before shutdown. The live proof establishes **original-intent preservation**, not a publicly undelivered packet persisting across restart. Pending exact-wire/crash recovery is covered locally by tests.

Keeper fields named `fee`/`spend` and native reservations are **conservative reserved spend**, including transaction gas allowances; they are not asserted as actual paid fees. Actual costs require transaction receipts and chain-specific fee accounting. Reservations and daily/action caps are included independently of savings-USDC conservation. Signed wires, signer paths, credentials and private RPC URLs are excluded from public evidence.

## Scope and source verification

Original Arbitrum components and [three concurrent vaults](../contracts/deployments/multichain/arbitrum-concurrent-vault-verification.json) have Sourcify exact source/creation/runtime matches; Arbiscan/Etherscan pending statuses remain separate provider outcomes. These matches and successful transactions are not an audit.

Cash only: Arbitrum's available Aave adapter stayed idle. No earning, Kamino execution, connected-wallet UI or application collection migration is demonstrated. The shared model/API/UI still use one simulated goal. Hosted supervision/indexing, production key/delegation policy, failed-peer/strategy recovery and security review remain work. One required testnet DVN and retained Solana upgrade authority are explicit trust boundaries. Robinhood and CRE are absent.
