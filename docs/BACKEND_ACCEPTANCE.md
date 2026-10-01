# Backend acceptance evidence

Checkpoint: 1 October 2026 UTC. This records the backend source and direct-process acceptance separately from a new owner's financial lifecycle or hosted uptime.

| Evidence | Observed result |
| --- | --- |
| Server tests | 41 passed, including official Privy ES256 verification, exact receipts, wallet-start recovery, owner isolation, actual deployed PREPARE semantics and bounded shutdown |
| Shared tests | 17 passed, including exact USDC units, per-goal binding and irreversible achievement |
| Permissionless keeper tests | 36 passed; financial owner operations are denied at the operator signing boundary |
| Real Neon | 41 persistence checks passed across applied migrations 1-9; only unique test rows removed; zero financial transactions |
| Actual provider credentials | Privy users API authenticated and Neon SELECT succeeded; no secret values published |
| Genuine owner login | Browser reload returned HTTP 200 for authenticated session and goal collection; authoritative EVM/Solana wallets matched the wallet view; database UUID and Privy subject remained distinct |
| Clean public source | Frozen offline installation, workspace tests, typecheck and build passed in an exported Git-index copy with no environment files |
| Separate simulator | Exported legacy API accepted its explicit test port and served sample state without private configuration |
| Actual local API/operator | API healthy; permissionless heartbeat fresh, zero worker errors, six active-goal capacity and zero registered goals at this checkpoint |
| Direct Linux runtime | Node 24.18.0 in WSL Ubuntu, production configuration, isolated port; health 200, unauthorized private request 401, HTTPS Origin accepted, HTTP Origin denied |
| Native shutdown | SIGTERM with an unfinished header connection closed the socket and exited 0 after 15,129 ms, within the 30-second deadline |
| Repository exclusions | Environment files, keys, private state, signed wires and research excluded from Git; staged private-value and local-link scans passed |

No Docker engine or container image is required. A fresh Linux installation must install its own platform dependencies; sharing Windows-installed dependencies with WSL initially exposed an esbuild binary mismatch. The isolated probe used the matching Linux binary privately. A normal Linux `pnpm install --frozen-lockfile` provides the platform dependency for that host.

## Outstanding gates

A fresh owner-signed lifecycle through the backend still needs receipt and LayerZero delivery evidence. The isolated external-owner test module uses fixture authentication; it cannot substitute for the genuine Privy session proved separately above. Historical contract proofs are preserved and do not establish this new API lifecycle.

VPS deployment requires actual TLS ingress, exact origins, service supervision, private persistent operator journals, native-fee monitoring and reboot recovery. Internal HTTP in WSL establishes the Node runtime and HTTPS-origin policy, not those host-level results. Testnet cash custody does not establish earning, mainnet security or an audit.

See [release gates](BACKEND_RELEASE_GATES.md), [API behavior](../apps/server/README.md) and [permissionless coordination](PERMISSIONLESS_KEEPER.md).
