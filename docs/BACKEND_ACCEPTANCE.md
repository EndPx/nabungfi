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
| Fresh financial API lifecycle | One external owner completed a 2-USDC Solana/Base cash goal: eight original owner receipts, seven actual delivered LayerZero messages, full claims, zero assets and restored wallet USDC |
| Actual operational retirement | Completed goal retained in history; verified worker completion removed it from active capacity and API reported zero active registrations |
| Repository exclusions | Environment files, keys, private state, signed wires and research excluded from Git; staged private-value and local-link scans passed |

No Docker engine or container image is required. A fresh Linux installation must install its own platform dependencies; sharing Windows-installed dependencies with WSL initially exposed an esbuild binary mismatch. The isolated probe used the matching Linux binary privately. A normal Linux `pnpm install --frozen-lockfile` provides the platform dependency for that host.

## Outstanding gates

The [fresh owner-signed backend lifecycle](BACKEND_OWNER_LIFECYCLE.md) now has actual receipt, state and LayerZero delivery evidence. It uses isolated fixture authentication and CLI owner signing; it cannot substitute for the genuine Privy session proved separately above or a browser-wallet-signed end-to-end flow. Historical four-chain and concurrent-goal proofs remain separate evidence.

The [VPS deployment](VPS_DEPLOYMENT.md) now proves external TLS, exact origins, isolated supervised services, persistent original journals, API restart and same-host keeper process-crash recovery. Actual host reboot, long-term uptime and recovery of a live unresolved packet were not tested. Testnet cash custody does not establish earning, mainnet security or an audit.

See [release gates](BACKEND_RELEASE_GATES.md), [API behavior](../apps/server/README.md) and [permissionless coordination](PERMISSIONLESS_KEEPER.md).
