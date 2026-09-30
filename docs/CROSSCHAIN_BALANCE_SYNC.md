# Per-goal USDC balance synchronization

Design baseline: 28 September 2026. Update on 29 September: OApp sender/receiver code, registration, lifecycle transport and Base progress reception are implemented and locally tested. The full local Kamino valuation/freshness projection and public network pathway remain pending. Proposed names below describe the original design; [the integration record](LAYERZERO_INTEGRATION.md) identifies the implemented interfaces and evidence.

## Responsibility and location

Each vault owns and values its own position. Keep the canonical crosschain progress cache alongside the goal coordinator on Solana, in goal-scoped progress accounts. Base sends its position report through an authenticated OApp route. The Solana position refresh reads local accounts directly. USDC and strategy receipts stay on their original chains.

LayerZero's OApp interfaces carry arbitrary application messages. Their EVM and Solana integration patterns differ; the Solana receiver requires peer validation, Endpoint clear and receive-account discovery. This supports the proposed messaging shape, not proof that NabungFi's accounting or selected pathway is configured correctly. [EVM OApp](https://docs.layerzero.network/v2/developers/evm/oapp/overview), [Solana OApp](https://docs.layerzero.network/v2/developers/solana/oapp/overview).

## Three amounts with different meanings

| Amount | Definition | Authority |
| --- | --- | --- |
| Reported total assets | Sum of the latest goal-specific local and remote position snapshots | Progress estimate; observations can have different timestamps and become stale |
| Reserved total | Realized local USDC reserve plus the authenticated peer's prepared reserve for the same goal/configuration/round | Input to the coordinator's completion decision after the existing readiness checks |
| Achieved total | The reserve sum recorded when achievement is committed | Historical completion evidence; does not decrease or relock after claims |

Portfolio totals across car/laptop/house goals are display-only. A goal can use only its own positions and registered peers. Current remaining claim balances must be shown separately after achievement; a delayed progress snapshot cannot change a terminal decision or supply a new withdrawal permission.

## Proposed update path

1. A user or keeper submits a bounded source-chain refresh/send transaction for a registered goal. The caller chooses the goal, not an arbitrary balance.
2. The Base publisher loads the registered vault and reads `totalAssets()` in that source transaction. Today this equals the vault's USDC balance plus its own aToken balance. Do not add historical principal again.
3. The source OApp sends a typed `POSITION_UPDATE` containing that computed value and its observation metadata. Emitting an event alone does not send a LayerZero packet. An offchain event watcher may trigger the transaction but must not sign its own replacement NAV as financial authority.
4. The destination receiver validates the origin and packet, resolves the registered goal/vault, and updates that goal's Base snapshot. A newer snapshot replaces the previous value; it is never added as a new contribution.
5. A proposed `refresh_local_progress(goal)` reads the goal's Solana USDC/cToken accounts and the registered Kamino reserve, using protocol-consistent refreshed valuation and conservative rounding. This valuation path still needs implementation and runtime proof.
6. A read/projection sums those two snapshots and returns their observation times and freshness. Recomputing the sum avoids maintaining a separate independently writable global total.

The implemented Base OApp uses `sendProgress(vault, options)` and `quoteProgress`. The authenticated Solana receiver calls the core's `receive_progress`. The proposed `refresh_local_progress(goal)` and full aggregate/freshness projection are not implemented yet.

## Proposed progress state and payload

Keep progress storage separate from the financial `Goal` lifecycle. Use a bounded snapshot per registered goal and source domain, keyed by the goal PDA and source domain; resolve its registered source vault/configuration before accepting data.

| Field | Purpose |
| --- | --- |
| `goalId`, `configHash` | Bind the observation to one goal and immutable configuration |
| `sourceDomain`, `sourceVault` | Bind the amount to its registered chain-local position |
| `netAssets` | Absolute current position value, in six-decimal native USDC units |
| `progressSequence` | Monotonic application-level progress counter for this goal/source |
| `observedBlockOrSlot`, `observedAt` | Source observation reference and source time |
| `receivedAt` | Destination receipt time, written by the destination |
| `initialized` | Distinguish a genuine reported zero balance from a missing report |

The wire envelope also needs a protocol version and message kind. Use a canonical cross-VM encoding with explicit field widths, endianness and checked conversions; existing Anchor/Borsh events and Solidity ABI structs cannot simply be forwarded as if they shared a format. The core currently uses u64 USDC amounts on Solana, so an out-of-range EVM value must fail conversion rather than truncate.

Registered LayerZero endpoint IDs belong in the transport configuration. The existing application domains `1 = Solana` and `2 = Base` are neither EVM chain IDs nor LayerZero endpoint IDs. Official deployment pages identify [Base](https://docs.layerzero.network/v2/deployments/chains/base) and [Solana](https://docs.layerzero.network/v2/deployments/chains/solana); endpoint existence does not establish a funded, correctly wired two-way pathway.

## Acceptance and freshness rules

- Authenticate the transport origin and registered OApp peer, then separately check goal ID, configuration, source vault, environment and message kind. The source publisher must validate its registered vault/caller; trusting the remote OApp does not make arbitrary user-provided amounts valid.
- Absolute progress snapshots accept a newer application progress sequence. Duplicate/older progress must not roll the cache backward; consume authenticated obsolete progress without applying it. Gaps can be tolerated for progress because the latest absolute snapshot supersedes intermediate ones.
- Lifecycle commands/reports retain their separate per-goal round and exact-order rules. Do not substitute LayerZero's pathway-wide nonce for a goal's lifecycle counter or make another goal wait on its business sequence.
- New valid values may decrease after losses. Never use `max(oldAssets, newAssets)` to manufacture monotonic financial progress.
- Validate source times against an explicit freshness policy; track receipt time separately so a recently delivered old observation does not look fresh. Block numbers/slots across chains are not a common clock. Do not invent an update interval or skew allowance before measuring the route.
- Missing/stale observations are exposed as missing/stale. They cannot authorize completion or be replaced with projected APY. Freeze or label unverified visual progress until suitable evidence is available.
- Progress updates never set `Achieved`, write prepared reserves or enable a claim. Finalization continues to use realized reserves and same-round readiness.

## Keeper versus LayerZero workers

The application keeper decides when to request a fresh report, pays within its execution budget and retries/resolves submitted work. LayerZero DVNs verify packets and Executors deliver verified packets; these are separate responsibilities. [LayerZero worker services](https://docs.layerzero.network/v2/concepts/verification-execution-services).

Trigger reporting after relevant deposits/strategy actions, on useful progress changes, on bounded periodic refreshes, and before assessing whether to start preparation. Yield does not automatically create a transaction in our app. Do not send one message for every accrued cent or animation frame. A caller-funded refresh path should remain available if the main keeper stops; relaying a packet cannot create missing strategy liquidity.

Peer, DVN, library, confirmation and execution settings require explicit review and fee estimates in both directions. Who can modify that configuration matters even when the vault's messenger address is immutable. SDK compatibility with the existing Anchor/toolchain and receiver-account discovery must be tested before an integration claim.

## Completion remains reserve-based

When the reported total suggests the goal may be ready, the owner can start the existing preparation round. Each vault redeems its own strategy position, records its actual local reserve and supplies same-round READY evidence. The Solana coordinator commits only after its local checks and the authenticated Base reserve reach the target, then sends COMMIT to Base. Lower realized funds keep that goal locked. A transmitted progress total is never a substitute for this flow.

## Current code gaps

| Component | Current implementation | Missing work |
| --- | --- | --- |
| Base valuation | `AaveSupplyAdapter.totalAssets()` reads owned balances; OApp sends the computed snapshot | Actual network fee/route operation |
| Base progress | Quote/send implemented through the official OApp; lifecycle outbox persists retries | Keeper/operator funding and live delivery |
| Solana progress | Authenticated absolute Base snapshot stored in Goal with sequence and timestamps | Refreshed Kamino valuation and total/freshness projection |
| Solana readiness | Implemented receiver calls real Endpoint clear before core CPI; locally SBF-tested | Real deployed identities and two-way public pathway |
| Completion | Common codec, registration and reserve/claim rules locally verified | Network finality/DVN evidence, Kamino execution and multi-peer generalization |

Required next tests include absolute replacement (no double credit), reordered/duplicate updates, lower balances after losses, missing/stale data, wrong-goal/peer/configuration packets, checked unit conversion, and proving that even a high reported total cannot bypass reservation or change an achieved goal's claim rules.
