# Testnet component deployments

The [fresh backend owner lifecycle](backend/owner-api-lifecycle.json) records a separate 2-USDC Solana/Base run through the actual HTTP API and Neon action journal. Eight owner-signed transactions and seven real delivered LayerZero messages completed with zero assets and restored owner USDC. The owner differs from the operator on both chains. Financial fixture authentication and separately verified genuine Privy login are explicitly distinguished in the [backend runbook](../../docs/BACKEND_OWNER_LIFECYCLE.md).

## Active protocol v2: four-chain proof

The current [v2 manifests](multichain/) record separate programs/contracts on Solana Devnet, Base Sepolia, Arbitrum Sepolia and Ethereum Sepolia. [live-goal.json](multichain/live-goal.json) records one actual 10-USDC goal with 4+2+2+2-USDC deposits, all-participant realized reserves, permanent achievement and complete partial/full claims. **All 21 LayerZero messages were delivered**, including post-claim zero-NAV reports from all three EVM peers. Every vault is empty and each owner's initial 20 USDC restored. Funds stayed on their original chains.

The newer [concurrent-goals-live.json](multichain/concurrent-goals-live.json) records three same-owner goals on all four chains: car 8 / laptop 4 / house 12 USDC, 118 keeper coordination intents and100 actual delivered messages. Root's12 claim transactions restore owner20 USDC on each chain and empty all 12 goal vaults/NAV, without erasing achievement. The laptop isolation comparison preserves actual early/during/after timestamps and separately discloses observer changes. [Concurrent runbook](../../docs/CONCURRENT_GOALS_RUNBOOK.md).

All v2 routes remain sealed; Solana upgrade authority is retained. Base/Ethereum original sources are verified. Arbitrum's original contracts and [three concurrent vaults](multichain/arbitrum-concurrent-vault-verification.json) have Sourcify exact source/creation/runtime matches; original Etherscan/Arbiscan statuses remain separate pending outcomes. No earning was performed, including on the idle Arbitrum adapter. A local WSL daemon coordinated the newer journey, while Root funded/claimed; hosted supervision and application/UI migration remain work. Robinhood is deferred and CRE is absent.

Latest source gates passed 71 EVM units, three v2 forks, 59 native Rust checks and six v2 SBF/LiteSVM scenarios; fresh public-only checks passed frozen install, 14 shared tests, typecheck/build and the operator-journal regression. Local fixtures are distinct from public receipts.

## Historical v1 deployments and checks

The remainder describes the older v1 components and their dated verification. Reproduce them from [source commit b64280b](https://github.com/EndPx/nabungfi/tree/b64280b28ea771fa8c53beae8e8f061d7651e46a). The current EVM parent vault's v2 virtual domain hook changes source/compiler metadata; current source is not byte-for-byte evidence for these historical binaries. Top-level Arbitrum/Ethereum staging records below are superseded for the four-chain proof by the separate v2 manifests.

These historical v1 manifests record public deployments on 30 September 2026. They contain public addresses, transaction receipts, code hashes and source-verification status. Private keys, API keys, buffer signer files and local submission journals are excluded.

| Network | Active components | Savings asset | Strategy |
| --- | --- | --- | --- |
| Solana Devnet | Core, transport and registered Store | Circle USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | Cash-only; Kamino calls disabled |
| Base Sepolia | Router and factory | Circle USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Cash-only |
| Arbitrum Sepolia | Router and factory | Circle USDC `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Aave enabled |
| Ethereum Sepolia | Router and factory | Circle USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Cash-only |

The asset list matches [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). The selected Base/Ethereum Aave testnet pools do not list these Circle assets; their different legacy test assets must not be presented as canonical USDC. The initial component records are preserved under `legacy/` and are superseded by the active manifests.

The Solana core/transport are executable, with deployment signer upgrade authority retained. Downloaded deployed ELF hashes match the reviewed build artifacts. The transport Store was initialized and registered on the real Endpoint using its actual ProgramData authority, peer Base EID `40245`, and the new canonical Base router. This is bootstrap evidence, not a reproducible-build attestation or message-delivery proof.

The initial deployments left all routes unsealed with no goals; those deployment receipts remain historical records. The Solana–Base pair subsequently configured explicit libraries/DVN/Executor, sealed both routes, and completed a 10-USDC goal through seven actual public messages and full claims. [Lifecycle/state evidence](layerzero-solana-base-live.json) records the 4-USDC Solana and 6-USDC Base deposits, partial/full withdrawals, zero remaining vault balances, permanent achievement and a post-claim progress decrease to zero. Arbitrum/Ethereum remain unsealed staging components, outside this goal's peer set. A persistent unattended keeper is not proven by the operator-driven lifecycle.

Active Base/Ethereum source verification is confirmed on Etherscan-family explorers. Arbitrum source-verification submissions were accepted but remained queued at the last recorded check; consult each manifest for exact status rather than inferring verification from deployed code.

Verification includes 64 RPC-free EVM tests, the retained 17 pinned forks (15 testnet, 2 mainnet), and one additional explicit LayerZero configuration/lifecycle fork. Solana has default 35+4 native/6 runtime and Devnet 38+4 native/7 runtime checks, plus an operator-journal regression. Local forks still use artificial balances/time and injected authentication; the separate lifecycle manifest contains actual public source/destination receipts and terminal state. The test pair is cash-only and does not demonstrate live interest or protocol liquidity.

Use `contracts/evm/script/DeployNabungFi.s.sol` with the ignored `.env` configuration. Consumed nonce guards intentionally reject accidental repeat deployment. Historical fork pins retain their matching pre-deployment nonces; archive-capable `*_FORK_RPC_URL` can be configured independently. Source API credentials are read from `.env` and must never be committed.
