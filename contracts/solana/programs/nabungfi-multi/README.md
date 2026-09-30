# NabungFi multichain coordinator v2

This is a separate cash-only Solana Devnet program, not an upgrade of the v1 pair. Its fixed program identity is `FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn`; only transport `G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d` can supply authenticated report signers. USDC is Circle Devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. [Actual deployment receipts](../../../deployments/multichain/solana-devnet.json) and [four-chain lifecycle evidence](../../../deployments/multichain/live-goal.json) are separate from the successful local builds.

Each goal has an immutable sorted list of one to three participants: domain 2/Base Sepolia EID40245, domain 3/Arbitrum Sepolia EID40231, domain 4/Ethereum Sepolia EID40161. Assets, routers, vaults, owners and pair-specific SHA256 configuration hashes belong to each participant. The same EVM address bytes on two different chains are valid: the domain/EID namespaces and leaf commitments remain distinct.

All selected participants must authenticate registration before deposits. Progress is an absolute estimate per participant and may decrease. It never grants readiness. Owner preparation starts one round for every participant. Local readiness snapshots actual USDC; every selected participant must report actual reserve readiness in the same round, including participants reserving zero. Achievement uses a checked aggregate after a local slot boundary. Abort waits for every selected peer acknowledgement before another round. Claims preserve achievement permanently, including when all balances and progress later reach zero.

## ABI

`initialize` arguments are `goal_id[32], target:u64LE, participants:Vec<ParticipantArgs>`. Each participant encodes `domain:u32LE, eid:u32LE, asset[32], router[32], vault[32], owner[32]`. Accounts in order are owner signer/writable, Goal PDA/writable, USDC mint, cash PDA/writable, Token program, System program. Initialize only after actual EVM vault creation and configuration-hash readback.

`deposit(amount:u64)` accounts are owner signer, writable Goal, USDC mint, writable owner source token account, writable goal cash, Token program. `claim(amount:u64)` uses owner signer, writable Goal, USDC mint, writable goal cash, writable owner destination, Token program. `begin_prepare` and `begin_abort` take owner signer and writable Goal. `mark_local_ready` and `achieve` take writable Goal and read-only goal cash. `receive_packet` takes writable Goal, the transport-derived receiver signer and fixed executable transport program; clients cannot call it with arbitrary signatures.

Goal PDA seeds are `goal, owner, goal_id`; cash seeds are `usdc, Goal`; receiver seeds under the transport are `nabung-receiver, Goal`. The account has an Anchor discriminator, owner, ID, target, principal, claims, round, outbound lifecycle sequence, local reserve/slot, achieved total, local-ready flag, phase, bump and a maximum-three participant vector. Each participant carries independent registration, progress, lifecycle sequence, reserve, readiness and abort status. Operator builders and the decoder live in `../../script/multichain-instructions.mjs`.

## Verification

From `contracts/solana`:

```bash
cargo test -p nabungfi-multi -p nabungfi-multi-lz --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo check --workspace --features idl-build --locked
```

Build the core and transport separately with their own Cargo manifests into `target/deploy-multichain`. Do not build the whole workspace to SBF: CPI feature unification can disable a standalone entrypoint. Keep owned program keypairs and artifacts ignored. Six local LiteSVM scenarios in `tests/multichain.svm.test.mjs` execute the fresh binaries, the actual Endpoint fixture and real SPL custody. Incoming verification records are explicitly precommitted local fixtures; outbound uses the test-only message library. Public DVN/finality/Executor delivery requires separate receipt evidence.
