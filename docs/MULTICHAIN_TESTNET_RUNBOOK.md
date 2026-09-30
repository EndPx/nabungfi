# Four-chain cash-goal testnet runbook

The separate protocol v2 deployment completed one real goal across **Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia** on 30 September 2026 UTC (1 October in Jakarta). Target: 10 USDC. Deposits and realized reserves: 4 + 2 + 2 + 2 USDC. All funds were claimed in partial and remaining claims. Twenty-one public LayerZero messages were delivered, including all three post-claim balance updates to zero. [Receipts and final states](../contracts/deployments/multichain/live-goal.json).

This is an operator-driven cash proof. It does not demonstrate yield, an unattended keeper, connected-wallet UI or three concurrent public goals. The local isolation suites cover independent goals. CRE is not used; Robinhood remains deferred.

## Identities and trust

| Network | Application domain | LayerZero EID | Role |
|---|---:|---:|---|
| Solana Devnet | 1 | 40168 | Cash custody and reserve coordinator |
| Base Sepolia | 2 | 40245 | Independent goal vault |
| Arbitrum Sepolia | 3 | 40231 | Independent goal vault |
| Ethereum Sepolia | 4 | 40161 | Independent goal vault |

The [Solana manifest](../contracts/deployments/multichain/solana-devnet.json) records core `FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn`, transport `G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d` and Store `v4GPUZ7BbKvpzyrtTBXYsASXcDKiC4TZppZaRSeudrp`. Each [EVM manifest](../contracts/deployments/multichain/) records its chain ID, router, factory, vault, Circle USDC, bytecode hashes, explicit security configuration and seal receipts. Identical Arbitrum/Ethereum address bytes represent separate contracts on separate chains, with different authenticated domain/EID and leaf hashes.

All routes use explicit ULN libraries, one required LayerZero Labs DVN, no optional DVNs and bounded Executor options. EVM send confirmations are Base2 / Arbitrum1 / Ethereum2; Solana-to-EVM uses 10 confirmations. Router ownership is renounced and Endpoint delegates are the router/Store after sealing. Solana program upgrade authority is retained. These are testnet security settings, not a production audit.

Base and Ethereum router/factory/vault sources are verified. Arbitrum's three accepted verification GUIDs still report `Pending in queue` at the recorded check; preserve and query those original submissions rather than resubmitting them. Contract execution and the 21 delivered-message proof are independently confirmed.

## Setup and verification before funds

1. Install Node24/pnpm10.21.0 with the frozen root lockfile; install Foundry and the documented Solana/SBF toolchain separately. Root pnpm tests do not run Foundry/Cargo.
2. Copy `contracts/evm/.env.example` to private `.env` and `contracts/solana/multichain.env.example` to private `.env.multichain`. Never commit real environment files or signer material. Keep actual network identities, nonce guards, fee caps and journal paths there. Configure a local keystore/signer; no private keys are needed in public code.
3. Simulate `DeployMultichain` and `ConfigureMultichain` for one selected EVM network, inspect canonical asset/library/DVN/Executor checks, then broadcast authorized deployment/configuration. Read back each actual receipt and configuration before advancing. Never share a mutable `.env` across simultaneous broadcasts.
4. Deploy the separate Solana core and transport from individually built SBF artifacts. Compare downloaded live ELF hashes with the reviewed binaries. Register the Store, initialize immutable peers and explicitly configure all three routes using the official SDK.
5. After explicit EVM/Solana configuration readbacks, real worker quotes and deployment/fork checks, seal the **EVM** routers. EVM factory goal creation requires that EVM route already sealed. Then create actual **unfunded** factory vaults for the same goal ID and Solana PDA. Verify owner, target, asset, chain-qualified factory provenance and each canonical SHA256 leaf from actual receipts. Initialize the Solana Goal only after those actual vault proofs exist.
6. With actual vault identities and the initialized Solana Goal, quote the actual goal and simulate receive account discovery for every route before irreversible **Solana** sealing. Confirm delegates, peer identities and all seal receipts. Do not reconfigure a sealed route.

The reviewed lifecycle scripts are `contracts/evm/script/OperateMultichain.s.sol` and `contracts/solana/script/operate-multichain-goal.mjs`. They simulate by default. The Solana CLI additionally requires a durable journal and unique semantic intent ID for broadcasting. EVM operator tooling checks identities and expected nonce; operators must separately persist the actual transaction and financial intent, avoid duplicate operations after a restart and refresh nonce only after reconciliation. The private scripts used for this proof are not part of the public checkout.

## Goal lifecycle

1. Send REGISTER separately from Solana to each selected peer. Each EVM vault authenticates its own registration. Send each REGISTERED acknowledgement back and wait until the Solana participant set is fully linked. The global all-acknowledgement funding gate is enforced on Solana and by application/operator orchestration; a single EVM vault does not independently know whether other chains acknowledged.
2. Deposit canonical USDC into that goal's independent chain-local vaults. Send each absolute PROGRESS report. Progress can decrease and does not authorize claims.
3. Begin PREPARE on Solana. Snapshot local USDC with `local-ready`. Send the matching PREPARE command to every participant.
4. Each EVM vault realizes its assets into actual USDC, marks readiness, then reports READY. A zero-reserve participant still has to report. Wait for every authenticated READY in the same round and the Solana slot boundary. The checked aggregate must be at least the target.
5. Execute `achieve` on Solana. Send each exact-reserve COMMIT to the corresponding EVM vault. Wait for its own destination receipt/state before enabling that chain's claim UI.
6. Claim chain-local USDC as owner. A partial claim preserves permanent achievement. No tokens are bridged to another chain by these messages.
7. Send post-claim PROGRESS reports and verify balances zero, claimed counters equal deposits, owner token balances restored, and phase still Achieved. Historical realized reserves and achieved total remain recorded even though current NAV is zero.

Illustrative read/simulation commands from the repository root:

```bash
node contracts/solana/script/operate-multichain-goal.mjs state --env contracts/solana/.env.multichain
node contracts/solana/script/operate-multichain-goal.mjs deposit --amount 4000000 --env contracts/solana/.env.multichain
node contracts/solana/script/operate-multichain-goal.mjs register --domain 2 --env contracts/solana/.env.multichain
```

For a reviewed Solana broadcast add `--broadcast --operation-id <unique-intent-id>`. Reusing an ID means reconciling that original intent; it is not permission to send it again. For EVM, run Foundry from `contracts/evm`, selecting the matching environment/RPC/keystore and one explicit script function such as `progress()`; add `--broadcast` only after simulation and prior receipt verification. The completed goal is empty: further deposits/claims should fail rather than reproduce the lifecycle. Use a new goal ID and fresh actual factory creation for a new proof.

## Receipt acceptance and recovery

A successful source send is insufficient. For every source transaction, inspect [LayerZeroScan testnet](https://testnet.layerzeroscan.com/) and its `/v1/messages/tx/{sourceTx}` API. Require DELIVERED, successful DVN verification, a successful destination transaction and no configuration error. Then check the application goal state through the destination RPC. The public manifest retains payload, GUID, pathway nonce, DVN/sealer transactions, source/destination receipts and effective security configuration.

On an ambiguous submission, first query the recorded original transaction/signature and semantic journal. Do not issue another deposit, claim or source message merely because output stopped. A message can arrive before a local serializer or RPC read fails. Reconcile already confirmed operations and resume only missing steps. Fees and quote values are time-specific; fresh quotes were capped at 20,000,000 lamports for Solana outgoing messages and 1,000,000,000,000,000 wei for EVM outgoing messages. Executor options used 500,000 EVM gas for Solana-to-EVM and 200,000 compute units plus 2,500,000 lamports for EVM-to-Solana.

Arbitrum's packet observation uses Solidity `block.number`; it can differ from the L2 receipt height. Preserve both fields rather than equating them. [Official Arbitrum Solidity differences](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/solidity-support).

## Proven boundaries

The public negative simulations rejected a claim at displayed 100% before reserves were ready (`StillLocked`) and achievement with only two of three remote READY reports (`MissingReady`). They were simulations against actual deployed accounts, with no rejected transaction broadcast. All successful financial actions have confirmed/finalized receipts.

The historical v1 Solana–Base proof remains in its original manifests/runbook. Reproduce its source from commit `b64280b28ea771fa8c53beae8e8f061d7651e46a`; the current parent EVM vault contains a virtual destination-domain hook for v2 and changes source/metadata hashes. The v2 identities are separate deployments; no historical v1 route was upgraded.
