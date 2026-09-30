# Testnet component deployments

These manifests record public deployments on 30 September 2026. They contain public addresses, transaction receipts, code hashes and source-verification status. Private keys, API keys, buffer signer files and local submission journals are excluded.

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
