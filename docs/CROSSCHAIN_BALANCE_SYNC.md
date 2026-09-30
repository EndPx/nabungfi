# Per-goal USDC balance synchronization

Updated 1 October 2026. V2 stores absolute progress and realized readiness independently for every registered EVM participant. One actual goal completed 4+2+2+2-USDC custody, all-peer achievement and claims across Solana, Base, Arbitrum and Ethereum testnets. All 21 messages were delivered, including post-claim EVM progress to zero. [Public evidence](../contracts/deployments/multichain/live-goal.json), [integration record](LAYERZERO_INTEGRATION.md), [v2 runbook](MULTICHAIN_TESTNET_RUNBOOK.md).

## Responsibility and location

Each vault owns and values its own position. The Solana Goal contains an immutable registered participant set and each participant's progress, lifecycle sequence, readiness and reserve. The source OApp reads that exact goal vault; a caller cannot supply an arbitrary NAV. Local Solana cash is read from its goal-scoped SPL-token account. Funds and strategy receipts stay on their original chains.

The application domains are Solana **1**, Base **2**, Arbitrum **3**, Ethereum **4**. Their LayerZero EIDs are **40168**, **40245**, **40231**, **40161**. These differ from chain IDs. Domain/EID and the bound vault/router/asset belong to the participant identity; equal EVM address bytes on different chains are not duplicates. The canonical v2 leaf binds those fields, the owner, target, goal and Solana identities. [Protocol specification](MULTICHAIN_V2_PLAN.md).

## Three amounts with different meanings

| Amount | Definition | Authority |
| --- | --- | --- |
| Reported total assets | Goal-local cash plus the latest absolute snapshots of its registered EVM positions | Progress estimate; observations may be asynchronous or stale |
| Reserved total | Realized local USDC reserve plus every participant's authenticated prepared reserve in the same goal/round | Input to completion after local checks and all-peer readiness |
| Achieved total | The checked reserve sum permanently recorded at achievement | Historical completion evidence; claims do not reduce or relock it |

Portfolio totals across car/laptop/house goals are display-only. A goal can use only its own positions and registered peers. Remaining claimable balances are different from historical achieved total. In the public proof, achievement stayed at 10 USDC while all four cash accounts and the three remote progress snapshots returned to zero after claims.

## Implemented progress path

1. A user/operator selects a registered goal and requests `quoteProgress`/`sendProgress` on one EVM OApp. The actual vault is authenticated; the caller selects the goal rather than a balance.
2. `totalAssets()` reads idle USDC plus its owned aToken balance when an Aave strategy is enabled. Historical principal must not be added again. Base/Ethereum are cash-only; Arbitrum's adapter was idle in this run.
3. A NBFG v2 PROGRESS packet (kind 6) carries the absolute amount, peer-specific progress sequence and source block/time. An event alone does not deliver it.
4. Solana authenticates the source EID/OApp, goal, leaf, owner and vault, clears the verified Endpoint packet, then updates that participant's snapshot through the atomic core CPI.
5. A newer application progress sequence replaces the previous snapshot. Old or duplicate observations are consumed without rolling the cache backward; skipped intermediate progress sequences are acceptable for absolute values.
6. Application projection may sum goal-local cash and initialized peer snapshots, showing source observations and receipt times. A complete user-facing freshness policy/projection remains unfinished; unverified/stale data must not be shown as current financial authority.

The current cash-only Solana profile does not implement refreshed Kamino NAV. The retained v1 Kamino bindings and proposed local strategy refresh remain separate work. Do not call mocked or forecast yield an observed balance.

## Participant state and packet identity

| Field | Purpose |
| --- | --- |
| Goal ID and peer configuration hash | Bind one observation to the immutable goal and chain-local leaf |
| Domain/EID, asset, router, vault and owner | Resolve the registered participant independently of address-byte equality |
| `net_assets`, `progress_sequence` | Absolute amount and monotonic progress counter for this peer |
| `observation`, `observed_at` | Source block/slot reference and observation time |
| `received_at` | Destination receipt time |
| `linked`, lifecycle sequence, readiness and reserve | Registration and same-round financial state; separate from progress |

Missing/uninitialized progress differs from a genuine reported zero. Registration linkage and progress sequence must be inspected rather than assuming a default zero is a fresh report.

NBFG v2 keeps the 222-byte layout, version **2**, neutral EVM-owner field and explicit big-endian wire integers. The configuration preimage deliberately uses specified little-endian numeric fields. Values crossing EVM uint256 to Solana u64 must fail on overflow rather than truncate. V1 is rejected by v2 receivers. [Golden fixtures](../shared/protocol/wire-v2.json).

## Acceptance and freshness

- Validate transport origin and registered peer, then the complete goal/leaf/owner/vault/domain identity. Authenticated OApp access does not authorize caller-supplied NAV.
- Lifecycle counters and rounds remain per goal and participant. Pathway nonces must not replace business sequence numbers or mix unrelated goals.
- New valid snapshots may decrease after losses or claims. Taking `max(old,new)` would invent financial value.
- Record source time separately from receipt time. A recently delivered old observation is not automatically fresh; blocks/slots across chains are not one clock. Do not invent interval/skew guarantees without measurement.
- Missing/stale reports cannot authorize completion or be replaced by projected APY. Label or freeze unverified visual progress as appropriate.
- PROGRESS never marks READY, writes a reserve, sets Achieved or enables claims. Its freshness policy does not replace same-round realized reserves.

Local native/SVM tests cover replacement/decreases, obsolete sequences, wrong-goal/peer/domain/configuration, conversion bounds and no progress-based unlock. The separate public run confirms actual delivery and three post-claim zero reports. Public loss, strategy-exit and stalled-peer recovery scenarios remain additional acceptance work.

## Application keeper and LayerZero workers

Application orchestration requests reports, pays bounded fees and reconciles/retries original signatures and semantic intents. LayerZero DVNs verify packets and Executors deliver verified packets. These responsibilities are distinct. The public demonstration used an operator; an unattended keeper/indexer is not implemented as a verified service.

Trigger useful reports after deposits or strategy actions and before preparation. Earning does not automatically emit an application transaction. Do not send a packet per accrued cent or animation frame. A caller-funded refresh can coexist with a keeper, but neither can create strategy liquidity that is unavailable.

The three public routes have explicit libraries, DVN/confirmation configuration and Executor budgets. Their EVM owners/delegates were sealed before funding. Retained Solana upgrade authority and the single required testnet DVN remain documented trust/liveness boundaries.

## Reserve-based completion

The owner starts one preparation round. Every participant realizes its own strategy into actual USDC, then sends same-round READY. The coordinator waits for local readiness/cross-slot checks and **all** registered peers, performs checked reserve aggregation, and compares against the fixed target. A missing or illiquid peer blocks achievement even if optimistic progress would exceed target. A zero-reserve participant must still authenticate registration and readiness.

After achievement, COMMIT carries the exact reserve for each destination and the permanent global achieved total. Each chain independently enables its owner's claims after its own command arrives. Claiming one chain never relocks another. Abort acknowledgment barriers prevent reopening a round while old participant state remains unresolved.

## Remaining gaps

| Component | Current evidence | Remaining work |
| --- | --- | --- |
| EVM valuation/reporting | Actual cash snapshots delivered from all three peers; adapter reads owned Aave balances | Demonstrated v2 earning/allocation/redemption and liquidity recovery |
| Solana progress | Authenticated independent peer snapshots, including actual post-claim zeroes | Refreshed strategy NAV and complete freshness projection |
| Completion/claims | One public four-chain cash goal fully claimed with permanent achievement | Multiple simultaneous public goals, live abort/retry/loss scenarios and independent audit |
| Operations | Explicit routes and operator journals with semantic reconciliation guards | Persistent unattended keeper/indexer, monitoring and fee replenishment |
| Application | Existing private local prototype/shared model uses one simulated goal | Wallet integration, owner-scoped collection, migration and accurate per-goal display |

Robinhood and Chainlink CRE are not part of this implementation. No live earning or mainnet assurance follows from the cash proof. Historical v1 evidence remains separate and source-pinned at commit b64280b; current domain-hook compilation metadata must not be equated with its deployed binaries.
