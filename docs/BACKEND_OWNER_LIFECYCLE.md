# Fresh external-owner backend lifecycle

On 1 October 2026, one fresh **2-USDC** goal completed through the actual HTTP API, actual Neon repository, deployed contracts and permissionless operator. The financial owner wallets differ from both operator wallets. [Transaction, state and public LayerZero evidence](../contracts/deployments/backend/owner-api-lifecycle.json).

This is a **Solana Devnet / Base Sepolia** backend acceptance run, separate from the earlier four-chain contract and three-concurrent-goal proofs. The fixture uses isolated synthetic loopback authentication. A genuine user Privy browser session was verified separately against the normal application API. These are two evidence classes; the financial run does not establish a browser-wallet-signed end-to-end flow.

## Observed lifecycle

The owner created the Base vault, initialized the Solana goal, deposited exactly 1 USDC on Solana, approved exactly 1 USDC on Base, deposited that 1 USDC and signed preparation after authenticated total assets reached 2 USDC. The operator paid for registration, progress, preparation delivery, local/peer readiness and COMMIT coordination. The owner then claimed 1 USDC from each chain. All **eight original owner transactions** were confirmed through the backend receipt verifier and persisted action history.

All **seven actual LayerZero packets** were independently fetched from testnet Scan: REGISTER, REGISTERED, positive PROGRESS, PREPARE, READY, COMMIT and post-claim zero PROGRESS. The evidence includes the actual source/destination transactions, configured DVN success, canonical Store/router pathways and 222-byte version-2 payloads for this exact goal. PREPARE carries zero amount; COMMIT carries the 1-USDC peer reserve and 2-USDC aggregate.

| Final property | Result |
| --- | --- |
| Permanent achieved total | 2,000,000 raw USDC units |
| Total claimed | 2,000,000 raw units |
| Solana goal assets | 0 |
| Base vault assets | 0 |
| Solana owner USDC | 1,000,000 raw units, matching its actual pre-deposit baseline |
| Base owner USDC | 1,000,000 raw units, matching its actual pre-deposit baseline |
| Authenticated Base post-claim report on Solana | 0 net assets |
| Worker retirement | Verified completed goal retained in registry/journal history; zero active registrations reported by API |

## Resource and recovery boundaries

The operator was gracefully stopped before four fixed funding transfers to the fresh owner: 0.1 Devnet SOL, 1 Devnet USDC, 0.003 Base Sepolia ETH and 1 Base USDC. The operator funded the associated token account rent. Signed original bytes and hashes were journaled before RPC disclosure or broadcast. Two immediate Base receipt checks paused; resuming queried the same originals, with no replacement signatures or repeated transfers. All four funding receipts subsequently passed exact token/native/rent/fee conservation checks. The permissionless operator restarted before the financial lifecycle.

The run retained its original metadata, action IDs, deadline, hashes and historical journals. No reset, deletion, additional goal, extra funding or mainnet operation was used. The owner wallets retain their faucet USDC and remaining gas. Their private keys, fixture bearer token and signed wires are excluded from the repository.

## Limits and next acceptance

This proves fresh owner signing, API planning/reconciliation, real persistence, non-owner fee coordination, actual delivery, complete claims and operational retirement. The signed transactions used the reviewed private CLI adapter. Browser wallet signing, production TLS, service supervision and reboot recovery require their own acceptance. The contracts used cash-only testnet profiles; no earning, mainnet security or audit assurance is established.

The public [test orchestrator](../apps/server/scripts/owner-lifecycle-test.ts) is an authoring module. It never loads wallet keys or runs by import. Its [execution boundary](../apps/server/scripts/owner-lifecycle.README.md) requires a separately reviewed external signer, exact finite resources and durable originals. See [backend acceptance](BACKEND_ACCEPTANCE.md) for the genuine login, runtime and persistence gates.
