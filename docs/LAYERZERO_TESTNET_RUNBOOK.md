# LayerZero testnet operation

This historical v1 runbook covers the **Solana Devnet–Base Sepolia goal pair** at source commit `b64280b28ea771fa8c53beae8e8f061d7651e46a`. Its coordinator has one EVM peer. The separately deployed v2 coordinator now completes four-chain goals; use the [multichain v2 runbook](MULTICHAIN_TESTNET_RUNBOOK.md) and [live evidence](../contracts/deployments/multichain/live-goal.json) for that deployment. Token reserves stay on their original chains.

## Configuration before route sealing

Use the package-local `.env` files, copied from their public templates. Never commit a private signer, `.env`, signed transaction, or API key. Foundry reads `contracts/evm/.env`; Solana tooling reads `contracts/solana/.env`. Explicitly check chain ID or genesis before signing.

| Setting | Solana Devnet | Base Sepolia |
| --- | --- | --- |
| Endpoint ID | 40168 | 40245 |
| Message library | ULN v3 | Send/Receive ULN302 |
| Required DVN | LayerZero Labs configuration PDA | LayerZero Labs DVN contract |
| Optional DVNs | None, explicitly configured | None, explicitly configured |
| Source confirmations | 10 | 2 |
| Required destination confirmations | 2 for Base messages | 10 for Solana messages |
| Maximum message size | 10,000 bytes | 10,000 bytes |

The single required DVN is a testnet configuration. Production verification policy needs a separate security review. Solana's DVN and Executor entries are their configuration accounts, not program IDs. The EVM peer is the Solana **Store PDA**, not the transport program address.

`contracts/evm/script/ConfigureLayerZero.s.sol` configures explicit libraries, Executor and ULN settings. `contracts/solana/script/layerzero-config.mjs` derives Endpoint/library accounts using the pinned official Solana SDK and plans separate initialization, library and worker phases. Simulate each phase, persist the transaction signature/hash before submission, confirm its receipt, then read back effective and custom configurations. If a multi-transaction phase fails partway, reconcile the completed transactions before continuing.

Do not seal merely because the stored bytes match. First obtain real Endpoint/ULN/DVN/Executor fee quotes and check receive-account discovery, compute/gas budgets and native-value limits. The application route seal is effectively permanent: Base renounces ownership and makes the router its Endpoint delegate; Solana makes the Store PDA its delegate without a configuration-forwarding instruction. Solana program upgrade authority remains a separate deployment control.

## Pair creation

1. Choose a unique 32-byte goal ID and derive the Solana Goal PDA from `goal`, owner and goal ID. Persist these identities.
2. The Base-only seal gate uses explicit configuration readback, real worker quotes and a local fork of seal/create/quote. After review, seal Base and create its **unfunded** vault through the router. Verify the **actual receipt**, owner, coordinator, goal ID, target and configuration hash. A predicted factory address alone is insufficient.
3. Initialize the unfunded Solana goal with that actual Base vault and owner. Compare its independently computed configuration hash to Base. Before sealing Solana, RPC-simulate `seal_route` plus the actual transport quote and receive-account discovery in the same simulation, so the temporary sealed state is visible. Separate simulations can be used for quote and discovery to respect packet limits. Only then seal Solana; funding remains disabled until registration.
4. Quote and send Solana REGISTER. Wait for actual delivery and `isGoalRegistered(vault) = true` on Base.
5. Quote and send Base REGISTERED. Wait for actual delivery and `linked = true` on Solana.

Ordinary deposits remain disabled before authenticated pair registration. A keeper cannot choose a vault balance or fabricate a successful registration.

## Fund, reserve and claim

For a 10 USDC cash-mode smoke test, use raw six-decimal amounts: target `10_000_000`, Solana deposit `4_000_000`, Base deposit `6_000_000`. Circle's testnet tokens and this proof carry no claim of financial yield.

Send a freshly computed Base PROGRESS packet to demonstrate the remote balance update. Its observation timestamp and receipt timestamp are distinct. A progress snapshot can decrease and never authorizes claims.

The Solana owner starts preparation. Send the state-derived PREPARE command to Base and wait for authenticated receipt. Both sides reserve their actual cash balances; Base persists a READY report and sends that stored report to Solana. Solana commits only after both reserves satisfy the target and its local readiness slot boundary passes. Send COMMIT to Base and wait for its achieved state. Each owner then claims the chain-local USDC; no token bridge is involved.

Record the source transaction, LayerZero GUID/pathway nonce, destination transaction, goal state, reserve amounts and token balance changes for every stage. A successful source transaction is **not** proof that the destination executed.

## Tooling commands

Install the pinned packages from the repository root with `pnpm install --frozen-lockfile`. Solana operator tooling requires Node 24 and a locally configured Devnet signer path. It reads the ignored package `.env` by default; `--env` can select a specific configuration. Populate the goal fields using a confirmed Base vault creation, and store journals outside tracked source.

```sh
# Read-only application state; no broadcast.
node contracts/solana/script/operate-goal.mjs state

# Simulate first. Amounts are raw six-decimal USDC units.
node contracts/solana/script/operate-goal.mjs deposit --amount 4000000

# Use a unique operation ID for this financial intent.
# Reuse that ID only to reconcile the exact same instructions/signature.
node contracts/solana/script/operate-goal.mjs deposit --amount 4000000 --broadcast --operation-id first-deposit-4usdc

pnpm --filter @nabungfi/solana-runtime test:tooling
```

The Solana CLI supports `initialize`, `register`, `prepare`, `local-ready`, `achieve`, `send-command` and `claim` as separate stages; it does not pretend a source send proves delivery. Its initializer checks Base Sepolia chain ID, router factory provenance and the actual vault's configuration hash. The public route is already sealed; do not try to repeat its configuration or seal with a new goal owner.

EVM stages are in `OperateNabungFi.s.sol`. Run from `contracts/evm`, set `EXPECTED_OPERATION_NONCE` from the confirmed and pending nonce, and invoke a single stage after its protocol gate:

```sh
forge script script/OperateNabungFi.s.sol:OperateNabungFi --sig 'progress()' --rpc-url base-sepolia --sender "$DEPLOYER_ADDRESS"
```

The command above simulates. A real broadcast additionally needs the explicitly selected local keystore/account and `--broadcast`; keep the credentials local. The script rejects a stale nonce and mismatched goal configuration, quotes the actual workers, caps the fee and uses finite token approval. Deployment and configuration nonce values in examples are historical guards, not reusable counters.

## Reconciliation and retries

- Application lifecycle/progress sequences are per goal; Endpoint pathway nonces are separate.
- Retry an unsent durable READY report using its stored sequence and amount. Never replace the report with an operator-supplied NAV.
- Reconcile a submitted transaction before retrying. For Solana, inspect the original signature, expiry and history; do not rebuild an ambiguous financial operation with a fresh blockhash.
- A confirmed journal entry must match the intended goal, instruction arguments and amount. A generic operation name such as `claim` is insufficient for several goals or partial claims.
- After a claim, achievement remains permanent. Post-claim balances may be zero without relocking the goal.

LayerZero Scan exposes the [testnet transaction-message API](https://docs.layerzero.network/v2/tools/layerzeroscan/testnet/messages/get-messagestx): `GET https://scan-testnet.layerzero-api.com/v1/messages/tx/{transactionHash}`. Inspect configuration errors, source confirmation status, DVN verification, execution failures and the destination receipt. Confirm application state on-chain as well; indexing can lag.

## Evidence boundaries

Local forks, LiteSVM fixtures and simulation can validate runtime compatibility and failure behavior. They do not establish public DVN verification, source finality or Executor delivery. Only actual public source/destination receipts and state transitions establish that pathway. Cash-mode proofs do not establish Aave/Kamino liquidity, earnings or production safety. Upgrade-authority policy, persistent keeper operations and independent release review remain separate work.
