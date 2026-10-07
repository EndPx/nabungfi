# Live browser E2E acceptance — 7 October 2026

The live app at **https://nabungfi.endpx.cloud** completed three independent savings goals through a genuine authenticated Privy browser owner. Each goal used Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. The browser performed vault creation, goal initialization, exact approvals, deposits, owner-initiated completion and chain-local claims. The API reconciled **51 distinct original owner transaction hashes**, including **12 claims**. This is cash-only testnet execution; it does not demonstrate live DeFi yield or mainnet safety.

The financial run completed against source `e4b696d02df38ec103913d965cee35e6cbd106b3` and Ready deployment `dpl_ENUkVhPp5LV6n2GCJnH5QtjGe4tY`. The [sanitized machine-readable evidence](../contracts/deployments/backend/browser-e2e-2026-10-07.json) contains all owner receipts and explorer links, goal/vault addresses, final chain observations, token conservation, failure resolution and LayerZero packet evidence. Email, OTPs, access tokens, environment values, private keys and signed transaction wires are excluded. The owner keys were never exported or used by a CLI. Eight operator-signed funding transfers were separate setup actions and are excluded from the 51 owner transactions.

The terminal collected-state UI was then built and deployed from `c27d29884858b4197b14d2b84f42ebd87d17bef1`, deployment `dpl_8DjRGQYNcSzvfukSizDVhiPZZ8Ki`, with Ready status. Its actual authenticated detail displayed the new collected copy and four Collected chain labels. **27 live HTTP checks** passed on the custom HTTPS host, including all app destinations, manifest/icons, service-worker policy, immutable assets, unauthenticated denial, exact CORS and a genuine 404 for a missing wallet module. The native API and keeper were active, and API health returned `ok: true`.

## Financial result

| Goal | Target USDC | Deposited and claimed USDC | Final state | Remaining assets | Claims |
| --- | ---: | ---: | --- | ---: | ---: |
| Car | 0.20 | 0.54 | Claimed | 0 | 4 |
| Laptop | 0.30 | 0.31 | Claimed | 0 | 4 |
| House | 0.40 | 0.41 | Claimed | 0 | 4 |
| Total | | **1.26** | | **0** | **12** |

All three goals initially held 0.01 USDC on each chain: 0.04 USDC per goal, below their individual targets. They remained locked, with no claimable funds or eligible completion action. Car then received a 0.50-USDC Solana top-up. At the isolation checkpoint, Car held 0.54, Laptop 0.04 and House 0.04; the portfolio total was 0.62. Laptop and House remained locked despite the larger portfolio balance. Their later Solana top-ups were 0.27 and 0.37 USDC respectively.

The user signed each Solana Prepare completion action. The native keeper then coordinated the cross-chain freeze, ready reports, achievement and delivery. This deployment has `autoPrepare: false`; the keeper does not initiate preparation for the owner. LayerZero communicates state while funds stay in the respective local vaults. Each successful claim returns that chain's USDC to its owner wallet.

Final independent chain reads showed every goal fully claimed, all twelve positions with zero remaining assets and zero claimable balances. The owner USDC balance returned to **2.00 USDC on each of the four networks**, matching the funded baseline. Native gas balances were lower because of fees and Solana account rent; no native-token refund or rent reclamation is asserted. After claims, the overview retained each completed 100-piece build and collected amount while the current saved portfolio balance correctly became zero.

## LayerZero and keeper result

The three new goals produced **118 original keeper intents**, all terminally delivered. **103 of these were distinct LayerZero packets**, independently checked through the public testnet Scan API. Every packet had a unique GUID, source success, successful DVN verification, successful destination execution and `DELIVERED` status. The evidence lists source and destination hashes and endpoint IDs. Local registration/readiness/achievement intents are not counted as LayerZero packets.

The keeper restart audit included these three goals plus one historical completed goal: four goals, 128 retained intents and **zero pending work**. The final recorded native heartbeat reported zero current errors. Three Arbitrum intents retain historical `nonce-consumed-without-original-receipt` diagnostics; their original hashes subsequently reconciled as delivered and their corresponding Scan packets independently succeeded. Historical notes were preserved rather than erased.

Arbitrum's doubled RPC gas quote exceeded the former 150,000,000-wei keeper price ceiling. A narrow audited policy adjustment raised only domain 3's ceiling to 500,000,000 wei. Nineteen original budget, ledger and wire files were preserved byte-for-byte, with unchanged signers, daily budgets and message fee caps. The restart audit found no pending original transaction to replace. No keeper key, nonce history or financial budget was reset. The API and keeper remain separate native services; no Docker or unrelated application change was required.

## Bugs reproduced and repaired

- The metadata-only goal list did not hydrate onchain balances. The client now reads authenticated goal details with bounded concurrency and verifies goal identity before exposing financial actions.
- A native review dialog covered Privy's confirmation portal. It now yields the page while the wallet is busy, preserving the original request and subsequent reconciliation.
- Privy's asynchronously updated EVM wallet context could leave the provider on the previous chain. The actual signing provider is now switched and its chain and owner are checked before sending.
- Background balance polling interrupted goal rendering and blocked valid actions. Matching goal presentation is retained during an in-flight read; failed reads still withhold financial authority. Polling waits until the prior read settles and pauses for wallet work.
- A stale PWA shell lost lazy wallet confirmation modules across releases. The versioned shell now retains the public lazy module graph, rejects JavaScript/CSS responses with an incorrect MIME type and avoids SPA fallback for missing assets.
- The Solana wallet SDK required browser Buffer compatibility. The app supplies its pinned byte compatibility before importing wallet code, without upgrading unrelated dependencies.
- An expired original Solana deposit had no returned signature. A read-only, finalized-history check now proves either the original transaction or covered message absence before clearing the request. The observed failed request was proved unexecuted; only a later explicit new deposit was signed. No uncertain transaction was silently replayed.
- A fully collected detail page still instructed the owner to claim again. The final UI uses collected-state copy and per-chain Collected labels, retains the completed build and exposes no further deposit, prepare or claim action.

The backend contains 55 request records for this run: 51 confirmed, three owner-attested non-executed rejections and one finalized expired-message absence. These four non-executed requests have no transaction hash and are not included in the 51 network transactions. Their reasons are retained in the evidence.

## Faucet menu and app checks

**[Faucets](https://nabungfi.endpx.cloud/app/faucets)** is the fifth app destination, with the same desktop sidebar and mobile bottom navigation. Each card shows the verified wallet address, copy feedback, a USDC link, a native gas link, the precise network and provider guidance. EVM shares one address across three networks but requires separate gas balances on each.

| Network | USDC | Native gas |
| --- | --- | --- |
| Solana Devnet | [Circle](https://faucet.circle.com/) | [Solana Foundation SOL](https://faucet.solana.com/) |
| Base Sepolia | [Circle](https://faucet.circle.com/) | [Coinbase Developer Platform ETH](https://portal.cdp.coinbase.com/products/faucet) |
| Arbitrum Sepolia | [Circle](https://faucet.circle.com/) | [Alchemy ETH](https://www.alchemy.com/faucets/arbitrum-sepolia) and [Arbitrum's provider list](https://docs.arbitrum.io/chain-info#faucet-list) |
| Ethereum Sepolia | [Circle](https://faucet.circle.com/) | [Google Cloud ETH](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |

Opening a link does not claim tokens. Providers can require sign-in, eligibility or request limits. In particular, Alchemy's Arbitrum faucet requires mainnet balance and activity; the app states this and offers the official alternatives list. This E2E run used project operator funding rather than asserting successful requests from every faucet provider.

The real authenticated browser also exercised creation validation (zero target and more than six decimals rejected), search/filter/reset, goal history links, wallet navigation and exact EVM/Solana address copying, reduced motion, installation guidance, completed-model assembly and 360 rotation. All five mobile dock controls measured 64px high at 375px, with no horizontal overflow. The app persisted the same genuine account and requests across reloads. Repeated actual signing on all four chains is stronger than a synthetic connected-wallet fixture.

## Validation boundaries

The final regression passed **54 frontend unit tests** and **54 isolated browser tests**, including the collected-state regression. Backend validation passed **44 server tests** and **47 real-Neon/database HTTP checks**. The database tests use synthetic authentication/chain adapters and send no financial transactions; they are separate from the 51 actual browser-signed receipts above. Production typechecking/build passed. The production PWA shell acceptance passed six checks, including both CSS chunk orders at three widths, retained wallet modules, standalone manifest, cold offline launch, disabled offline signing and zero private API entries. The separate PWA lifecycle suite covers install cancellation, existing installed mode, offline mode and pending-wallet update deferral.

No physical mobile phone, native installed app window, every third-party wallet brand, fresh Google OAuth sign-in or human-audible sound assessment was exercised in this run. Existing authenticated Google/Privy session use is established. UI reflow and PWA shell/installation mechanics are browser tests, not proof of installation on iOS/Android. This result closes the genuine embedded-wallet cash lifecycle gate; real yield liquidity, mainnet deployment, independent security review, physical-device acceptance and long-term operation remain distinct work.
