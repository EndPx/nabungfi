# User wallets and permissionless coordination

The authenticated application uses the deployed v2 testnet contracts. Each user's linked Solana and EVM wallets own their goals. The API produces unsigned plans and validates original receipts; it never signs user financial operations.

Publication status: the keeper kernel and the authenticated application API/database admission source are published in separate verified steps. Direct Node runtime and genuine owner login evidence are recorded in [backend acceptance](BACKEND_ACCEPTANCE.md). The fresh external-owner backend financial lifecycle is now proved with fixture authentication and CLI signing; browser wallet signing and hosted uptime remain separate gates.

## Authority

Users sign EVM vault creation, exact USDC approval/deposit/claim, and Solana initialization/deposit/preparation/abort/claim. A separate fee-paying operator can send state-derived registration/progress/coordination packets, mark local readiness and commit verified achievement. It cannot withdraw savings, initialize a user goal, change targets, allocate investment exposure or prepare a user goal automatically.

`authorityMode: "permissionless"` requires `autoPrepare: false` for every goal. The actual user starts preparation through their wallet when fresh authenticated reports meet that goal's target. The operator then helps realize the deployed all-peer lifecycle. The original `owner` mode remains available for the earlier operator-owned test goals.

## Registry and private state

The API publishes a private registry only from receipt-verified initialized bindings. Display labels use immutable chain goal IDs. Accepted identities are append-only; later database omissions cannot silently remove them or change owner, target, participant or journal identity.

The registry worker uses a fresh state directory and the same exclusive signer lock as every other operator using those keys. Owner-mode journals cannot be reinterpreted as registry journals. Shared native budgets, private original signed wires and per-goal reconciliation remain durable. Policy/signers are immutable; bounded retries preserve identical bytes. Signing accepts only adapter-produced plans whose exact action, message/calldata, fees and nonce identity remain unchanged.

The registry stores at most 500 lifetime identities; this is a storage bound, not a claim of 500 concurrent live goals. The local beta admits at most six active goals. The API reserves those operational slots before users pay provisioning fees. Slots retire only after the operator's validated snapshot shows permanent achievement, zero cash/NAV/receipts and every original intent reconciled. Old identities and journals remain immutable.

The worker services the small active set each cycle and refreshes the oldest peer first. Unchanged below-target goals do not spend native fees on idle heartbeats; changed balances are still reported. Target-funded manual-owner goals obtain fresh reports from zero-balance peers too. Finite daily/action/fee/gas limits remain. Capacity and a recent successful broadcast-mode heartbeat are checked before provisioning; an unavailable operator leaves goal metadata intact and does not start a wallet transaction. These policy checks are not a hosted-throughput or uptime benchmark.

Configure private registry/status locations with `NABUNGFI_KEEPER_REGISTRY_FILE` and `NABUNGFI_KEEPER_STATUS_FILE` in the server environment. A private operator JSON file must specify matching `registryFile`, `statusFile`, `authorityMode`, signers, canonical network identities, spend policies and an initially empty `goals` list.

```sh
node contracts/keeper/src/registry-cli.mjs --config .local/app-keeper.json --once
node contracts/keeper/src/registry-cli.mjs --config .local/app-keeper.json --broadcast
```

The first command reads/simulates and never broadcasts. Start the second only after the prior signer-lock owner has stopped gracefully. Keep private journals on a filesystem that enforces file permissions; the public status bridge contains only runtime health, never keys, RPC credentials or signed wires.

## Evidence and limits

The [earlier concurrent cash proof](CONCURRENT_GOALS_RUNBOOK.md) demonstrates three operator-owned goals and 100 actual delivered packets. It does not prove a new customer's browser-signed financial lifecycle or hosted uptime. This permissionless application mode adds separate authority, exact-plan signing, append-only registry and recovery checks; its API and worker runtime acceptance are recorded in the application release evidence.

The current operator runs locally. It cannot operate while its host sleeps/offlines. Production needs a continuously available host, private persisted journals, bounded funded signers and monitoring. Current deployments are testnet cash vaults; the new application does not enable earning automatically or claim a production security audit.
