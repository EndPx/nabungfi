# Four-chain goal coordinator, protocol v2

Authorized 30 September 2026: expand one goal to Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. Robinhood remains deferred; CRE is not used. The public cash-mode lifecycle is now verified: one 10-USDC goal, 4+2+2+2-USDC deposits/reserves, 21 delivered LayerZero messages and complete claims on all four chains. [Receipt/state evidence](../contracts/deployments/multichain/live-goal.json), [runbook](MULTICHAIN_TESTNET_RUNBOOK.md).

## Scope and compatibility

Use separate v2 Solana core/transport programs and v2 EVM routers/factories/vaults. Preserve the existing, fully claimed v1 pair and its historical receipts. Domain IDs are application IDs: Solana 1, Base 2, Arbitrum 3, Ethereum 4. LayerZero EIDs are 40168, 40245, 40231, 40161 respectively. A goal has a fixed registered EVM participant set of one to three domains; the four-chain proof uses all three. Participants may reserve zero but must still authenticate registration/readiness. No portfolio-wide totals or duplicate reserve attribution.

Separate deployed Devnet identities: core `FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn`, transport `G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d`, Store `v4GPUZ7BbKvpzyrtTBXYsASXcDKiC4TZppZaRSeudrp`. Downloaded live ELF hashes match reviewed binaries; routes are sealed. Private program keypairs remain ignored. Historical v1 deployments are preserved and reproduced from source commit `b64280b28ea771fa8c53beae8e8f061d7651e46a`.

## Wire and configuration contract

NBFG v2 keeps the 222-byte field layout of v1, with version byte **2**. Kind values remain PREPARE1, COMMIT2, ABORT3, READY4, ABORT_ACK5, PROGRESS6, REGISTER7, REGISTERED8. Integers in packets are big-endian. Commands/REGISTER originate on domain1 and target a specific domain2/3/4. Reports originate on that exact EVM domain and target1. Positive observation/time, authenticated goal/source/destination/owner, exact configHash and kind-specific round/sequence/amount rules remain mandatory. Each receiver rejects v1-as-v2 and domain substitution. Zero READY reserve is valid.

The canonical pair-specific SHA256 preimage is, in this exact order:

```
ASCII("NABUNGFI_MULTICHAIN_CONFIG_V2")
solanaCoreProgram[32]
solanaGoal[32]
solanaOwner[32]
goalId[32]
target:u64LE
evmDomain:u32LE
evmEid:u32LE
solanaUsdcMint[32]
evmAsset:leftPaddedAddress[32]
evmRouter:leftPaddedAddress[32]
evmVault:leftPaddedAddress[32]
evmOwner:leftPaddedAddress[32]
solanaTransportProgram[32]
```

Each factory computes its actual CREATE address inside the transaction and binds this leaf hash. Solana initializes only after all actual EVM vault receipts exist, with an owner-authorized immutable sorted participant list (unique canonical domains/EIDs and unique chain-qualified `(domain, vault)` identities). Identical address bytes on different chains are valid; CREATE addresses do not include chain ID. EVM vaults trust their authenticated Solana coordinator's aggregate certification, as in v1; they do not independently prove other chains' NAV. The Solana participant set is not operator-editable after initialization.

## Financial state machine

- Per goal: owner, ID, target, principal, claims, round, global outbound lifecycle sequence, local reserve/readiness slot, achieved total and permanent phase.
- Per EVM participant: domain/EID, vault/owner/asset/router identity, configuration hash, linked flag, absolute NAV/progress sequence and timestamps, lifecycle inbound sequence, ready/abort status and realized reserve. Sequences are independent for each participant.
- All participant registration acknowledgments are required by Solana before normal deposits and by application/operator orchestration before funding any chain. An EVM vault authenticates its own REGISTER but does not independently observe other peers' acknowledgments. Target remains fixed; no deadline escape or discretionary withdrawal.
- Owner PREPARE increments the goal round and outbound command sequence. The same logical command is sent separately to every registered EVM peer, with its own authenticated leaf and destination.
- READY snapshots actual USDC after receipts are fully redeemed. Achievement requires local readiness, the cross-slot boundary, and **every** participant READY in that exact round. Checked sum(local + each unique ready reserve) must be >= target.
- COMMIT names that participant's exact reserve and the global achieved sum. Each destination enables only its owner claims after its own COMMIT delivery. Claims never rerun the target comparison or erase achievement.
- Progress may decrease, including after claims; it never grants readiness. Failed/illiquid/missing peers block achievement. Abort waits for all peer acknowledgments before a new round; delayed READY cannot restore aborted readiness.
- Solana v2 Devnet remains cash-only. EVM may reuse the reviewed Aave adapter on supported assets; no automatic allocation or live earning claim is added by this expansion.

## Delivery gates and task ledger

1. [x] Independent Solana/EVM implementation, common v2 codec/hash fixture and isolation tests.
2. [x] Review all-peer readiness, zero peer, per-peer replay, wrong domain/EID/owner/config, overflow, abort races, permanent achievement and multiple isolated goals.
3. [x] Fresh SBF/runtime and EVM local/fork evidence, operator tools and finite fee/compute budgets.
4. [x] Deploy fresh testnet v2 programs/contracts; preserve v1 receipts/source references.
5. [x] Configure explicit libraries/DVNs/confirmations/Executor for all three bidirectional routes. Verify real quotes and discovery before sealing.
6. [x] Create one four-chain goal using actual vault receipts, authenticate all registrations, fund 4+2+2+2 USDC (target10), deliver progress and each PREPARE/READY/COMMIT, then partial/full claims with terminal conservation. All post-claim NAV reports are zero at sequence2; achievement remains permanent.
7. [x] Public receipt/state manifest, accurate limits/docs and clean public checkout validation. Publication scope and private-value scan passed; source/evidence are ready for the authorized commit/push without env/keys/apps/research.

The fresh public-only checkout passed frozen pnpm install, 14 shared tests, typecheck, build and the transaction-journal regression. Independent review decoded all 21 delivered packets and verified chain-qualified identities, leaf hashes, security configuration and final conservation. Base/Ethereum Etherscan source verification succeeded. Arbitrum's router/factory/original vault are verified as exact creation/runtime matches on Sourcify, independently recompiled and matched to RPC hashes; their original Etherscan GUIDs remain pending. [Separate provider results](ARBITRUM_SOURCE_VERIFICATION.md). That external queue is not a failed execution receipt or a source mismatch.

Do not substitute local packet injection for public DVN/Executor delivery. If a native gas or public worker resource blocks a step, record the exact boundary and continue independent source/verification work.
