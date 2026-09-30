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

All routes remain **unsealed**, all factories have **zero goals**, and no savings goal was funded by this deployment. Explicit security-stack configuration, fees, keeper operations and public two-way delivery remain open. The current coordinator has one Base peer; Arbitrum/Ethereum components are staging, not participants in a combined multi-EVM goal.

Active Base/Ethereum source verification is confirmed on Etherscan-family explorers. Arbitrum source-verification submissions were accepted but remained queued at the last recorded check; consult each manifest for exact status rather than inferring verification from deployed code.

Verification includes 60 RPC-free EVM tests, 17 pinned fork cases (15 testnet, 2 retained mainnet), 12 deployment/configuration cases within the local suite, and three fork cases invoking the actual Foundry deployment entrypoint. Solana has default 35+4 native/6 runtime and Devnet 38+4 native/7 runtime checks. Local forks use artificial balances/time and injected application authentication; the public transactions recorded here are component deployments and OApp bootstrap only.

Use `contracts/evm/script/DeployNabungFi.s.sol` with the ignored `.env` configuration. Consumed nonce guards intentionally reject accidental repeat deployment. Historical fork pins retain their matching pre-deployment nonces; archive-capable `*_FORK_RPC_URL` can be configured independently. Source API credentials are read from `.env` and must never be committed.
