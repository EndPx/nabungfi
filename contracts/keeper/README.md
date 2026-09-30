# NabungFi testnet keeper

This Node worker coordinates **existing, explicitly allowlisted** v2 goals on Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. It reads real goal/vault state and uses the deployed LayerZero routes. It supports several independent goals for one owner; it never adds another goal's assets to a target.

The worker sends registration and registration acknowledgements, absolute USDC balance progress, PREPARE commands, local readiness, cash-only EVM readiness reports, achievement and COMMIT commands. `autoPrepare: true` explicitly allows the owner signer to begin a preparation round when that goal's fresh balance reports reach its target. `maxAutoPrepareRounds` bounds that policy. Without this flag, the worker only services an owner-initiated round. It drains stored reports and command predecessors during an owner-initiated abort; it never interprets a timeout as permission to abort.

**Deposits, claims, investment, strategy redemption, goal creation, deployment and route sealing are outside the worker.** EVM strategy receipts must be zero before it automatically prepares or marks ready. This is a cash route; the worker does not demonstrate yield.

The [public concurrent run](../deployments/multichain/concurrent-goals-live.json) exercised three same-owner goals across all four chains: car 8 / laptop 4 / house 12 USDC, 118 journaled worker intents and100 delivered LayerZero messages. Root signed the separate12 claims. All 12 vaults/NAV ended zero with permanent achievement and owner20 USDC per chain. Laptop claims preserved locked sibling financial state. The worker runs locally in WSL and is terminal-zero idle at the recorded endpoint; it is not a hosted always-on service. [Concurrent runbook](../../docs/CONCURRENT_GOALS_RUNBOOK.md).

## Configure and inspect

Use Node 24 and the workspace's pinned dependencies. The worker imports the existing Solana package; it adds no SDK dependency. Run the signer on Linux/WSL with an existing Foundry encrypted account. Keep the configuration, keypair, password file, journals and original transaction files in ignored local storage.

```sh
pnpm install --frozen-lockfile
pnpm --filter @nabungfi/keeper test
mkdir -p .local
cp contracts/keeper/config.example.json .local/keeper.json
# Replace signer paths, RPC settings, targets, IDs and all three actual vault addresses.
node contracts/keeper/src/cli.mjs --config .local/keeper.json --once
```

The example has placeholder goal/vault data and cannot operate until it is replaced with the **actual created goal and vault receipts**. Copy one goal entry for each savings goal. USDC amounts, native fees and budgets use raw integer units. Configure the same `signerLockFile` for every process/tool that uses these owner signers. RPC URLs may contain private provider credentials; do not commit the filled configuration. Nonempty Foundry passwords use `emptyPassword: false` plus a local `passwordFile` path. No private EVM key is exported.

The default command validates the Devnet genesis, EVM chain IDs, sealed route security configuration, Solana cash mint/authority and each vault's factory registration, owner, coordinator, domain, messenger and independent leaf hash. It reads journals and simulates the next action for each goal. It does **not** sign an EVM transaction or resend a previous transaction. Solana simulation signatures authenticate the simulation, with no submission.

## Run unattended

```sh
node contracts/keeper/src/cli.mjs --config .local/keeper.json --broadcast --once
node contracts/keeper/src/cli.mjs --config .local/keeper.json --broadcast
```

Use SIGINT/SIGTERM for a graceful stop. A cycle takes at most one new action per goal. Source confirmation and the actual destination application state must reconcile before that goal advances. A failing goal is logged as paused, while other goals continue. Pin the configuration before starting: changing the allowlist or deleting earlier goal/budget state fails closed.

Progress reports are sent when a balance changes, including decreases after a claim. A finite refresh interval keeps locked-goal observations fresh. Initial empty peers do not consume fees unless a fresh zero report is needed to prepare a locally funded goal. Fully claimed, achieved peers with zero balances stop refreshing; achieved status remains permanent. Fresh goal-specific reports can trigger prepare before optional heartbeat refreshes.

## Restart and transaction safety

Each signed operation has a semantic goal/domain/round/sequence intent. Its exact signed bytes are fsynced in separate private `wires` files, and its signature/hash, instruction fingerprint and original native spend are journaled before broadcast. Native spend/action budgets are reserved before any retryable intent. After restart, the worker looks up the original signature/receipt before quoting or constructing new transactions. It may rebroadcast **identical bytes only**, within configured retry bounds. It does not choose a fresh nonce or blockhash to replace an unresolved action. An expired Solana signature, consumed EVM nonce without the original receipt, failed receipt, missing wire or corrupt state pauses the goal for explicit reconciliation.

A global exclusive lock prevents two workers from signing concurrently. A lock left after a crash is deliberately retained. Verify the recorded PID/hostname and that no worker or operator is using the signer, reconcile pending transactions, then remove only that stale lock. Automatic stale-lock stealing is unsafe when two processes restart together. Never delete journals or budgets to force a retry.

A crash after a native budget reservation or private wire has been saved but before its goal intent is saved leaves an orphan reservation. This window requires manual reconciliation; it does not automatically sign a replacement. All configured goal ledgers and the manifest are created before any first submission, and the manifest binds the full effective policy and signer configuration. A missing previously expected ledger therefore cannot reset a funded goal's operation history.

Fee quotes are capped per message; each chain has a native reserve floor, daily spend cap, gas price and gas limit cap. Budget reservations conservatively include native message value and twice the capped legacy transaction gas cost for L2 overhead; rejected quotes/simulations do not broadcast. RPC reads have bounded timeouts and limited read-only backoff. Raw signed transactions, key material, keystore errors and credential URLs are suppressed from logs.

The public journal's `fee`/`spend` fields are conservative reserved native spend, not actual paid transaction fees. Actual paid costs require public receipts and chain-specific fee accounting; do not sum reservation values and label them realized fees.

Daily spend and action caps are counted by the UTC day on which a reservation is made. A transaction reserved on an earlier day may still execute after midnight. Pending reservations remain in the journal and keep their original bytes and amount; this version does not move them into the next day's budget. Keep the native reserve floor high enough for unresolved transactions and cleanup.

## Validation boundary

Scheduler/recovery tests cover isolated targets, stale/decreasing NAV, zero participants, incomplete READY, slots, abort predecessors, ambiguous receipts, wire integrity, budgets and locks. The separate public run proves actual concurrent cash coordination and original-intent preservation across restart. It does not prove live undelivered-across-restart recovery:24 old hashes were preserved while new work expanded the later journal. Pending exact-wire/crash recovery stays a local test boundary. Shared-model/API/UI multi-goal migration, real earning and hosted supervision remain unfinished.
