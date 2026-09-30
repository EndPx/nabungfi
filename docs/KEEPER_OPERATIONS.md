# Automatic coordination keeper

The public Node worker in [contracts/keeper](../contracts/keeper/README.md) coordinates existing protocol-v2 cash goals on Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. Each configured goal has its own immutable identity, target, participant hashes and journal. A portfolio total never authorizes an individual goal's completion.

## Authority and financial boundaries

The worker pays message and transaction fees, authenticates registration, publishes absolute balance reports, and services preparation, readiness, achievement and COMMIT delivery. Automatic preparation requires an explicit per-goal owner policy and fresh reports. Every registered participant must be ready in the same round; actual realized reserves must meet the goal's target.

The worker never creates goals, deposits, invests, redeems strategies, claims, deploys programs or seals routes. Current owner-key preparation authority is suitable for this scoped testnet proof. Production requires a reviewed signer/delegation and hosting policy; configuration limits do not make a compromised owner key harmless.

## Start and inspect

Use Node24, the frozen workspace lockfile and Linux/WSL for the existing encrypted Foundry signer. Copy the public template to an ignored local configuration and fill it only from actual initialized goals and factory vault receipts. Keep private configuration, signer/password files, original signed transaction files and journals outside Git.

```sh
pnpm install --frozen-lockfile
pnpm --filter @nabungfi/keeper test
node contracts/keeper/src/cli.mjs --config .local/keeper.json --once
node contracts/keeper/src/cli.mjs --config .local/keeper.json --broadcast
```

The first keeper command reads and simulates; it never broadcasts or retries an earlier send. The second starts the continuously running loop. Use a process supervisor on an available host for continuous operation. A local process cannot operate while its host is asleep or offline.

Use a Linux filesystem for private state where POSIX0600 permissions can be enforced. Set a global signer lock shared by every worker/operator using these signers. The worker binds its effective policy and signer configuration, creates all goal journals before its first send, and refuses missing or corrupt prior state.

## Funding and claims

1. Initialize the actual goal and every participant vault; verify identities, hashes and sealed routes.
2. Run the keeper until every participant's REGISTER has been received and every REGISTERED acknowledgement is linked on Solana. No savings funding occurs before that barrier in the reviewed orchestration.
3. Stop the daemon gracefully, reconcile original pending signatures/nonces, then hold the same signer lock for owner deposits. Capture actual financial receipts and token conservation.
4. Release the operator lock and restart the unchanged keeper configuration. It observes new balances and prepares only goals whose own fresh totals meet their target.
5. Wait for actual destination COMMIT states before presenting a claim. Stop/reconcile the keeper before owner claims, then restart to publish decreasing post-claim balance reports.

Root financial operations and keeper coordination are distinct evidence. Goal-local cash, principal, claims, rounds and status must reconcile independently; owner-wallet/native balances are shared resources and are not another goal's reserves.

## Restart and budgets

The worker reserves finite native spend and actions, persists exact signed bytes privately, and journals semantic goal/domain/round/sequence intents before submission. Restarts query the original signature/hash and application destination state. Bounded retries use the identical signed bytes; they never blindly choose a new nonce or blockhash. Changing policy or signer configuration requires explicit reconciliation.

A stale lock, expired unresolved signature, consumed nonce without the original receipt, failed transaction, missing journal, corrupt wire, or orphan reservation before intent persistence pauses the affected operation. Verify the original transaction and PID before manual recovery. Do not delete accounting state to force another send.

Daily budgets use the UTC reservation day. Per-message caps, per-network gas caps, native reserve floors and per-cycle/day action limits also apply. Balance reports are change-driven with bounded refresh; fully claimed, achieved peers with zero current balances stop refreshing. Native resources must cover both ongoing coordination and eventual owner claims.

The scheduler and recovery regressions are local evidence. Public automatic completion, restart and concurrent-goal isolation require separate genuine source/destination receipts and actual state snapshots; a green test or running process alone does not establish those outcomes.
