# Native VPS backend deployment

**7 October browser acceptance:** the genuine frontend owner completed three goals across four testnets with 51 original transactions and 12 claims. The VPS keeper's 118 new original intents were delivered; public Scan independently confirmed 103 distinct packets at their destinations. The final combined restart audit retained four goals and 128 intents with zero pending work. The [browser E2E record](BROWSER_E2E_ACCEPTANCE.md) and [sanitized evidence](../contracts/deployments/backend/browser-e2e-2026-10-07.json) supersede the historical browser-signing gate and coordinator counts below. The API financial release is `/opt/nabungfi/releases/e4b696d`. The separately audited Arbitrum gas-price ceiling adjustment preserved all original financial journals, budgets and signers. No real yield or mainnet execution is asserted.

The testnet backend is live at **https://nabungfi-api.endpx.cloud**. The primary frontend is now **https://nabungfi.endpx.cloud**, published through the EndPx Vercel project on 7 October 2026. Both that exact origin and the original `https://nabungfi.vercel.app` origin remain permitted. The custom frontend reused the existing allowlist; this release did not restart the API or keeper. [Sanitized backend deployment evidence](../contracts/deployments/backend/vps-runtime.json) · [Frontend deployment evidence](../apps/web/DEPLOYMENT.md).

## Isolation and preservation

The existing Ubuntu 24.04 host received only dedicated NabungFi release/runtime/state paths, unprivileged `nabungfi-api` and `nabungfi-keeper` identities, `nabungfi-*` service units, a dedicated vhost and its DNS/certificate. Node 24.18.0, pnpm 10.21.0 and Cast 1.8.3 are pinned in the isolated runtime. Host-global Node 24.14.0 and pnpm 9.15.9 remained unchanged. No Docker command or container deployment was used.

The API binds to `127.0.0.1:3901` behind nginx. Each process owns a separate bridge writer directory; registry/status files are atomically replaced with mode 0640, while journals and keys remain private. Actual destination permission checks denied API access to operator credentials, configuration and budgets, and denied writes to the opposite bridge directory. The two transferred operator public addresses matched their original identities without publishing keys.

Before/after checks matched all **12 pre-existing vhost hashes**, **11 HTTP results** and **six existing service/master PIDs**. Some earlier endpoints already returned 404/502 at their root paths; those same baseline results were retained. These comparisons establish the observed preservation at deployment, not a health guarantee for every unrelated application.

## Exclusive cutover and recovery

The source worker and registry publisher stopped before the fresh source snapshot. Its normal local launch configuration was archived so the former wrapper cannot restart that worker. The reviewed relocation changed only six filesystem/runtime paths. One completed goal, ten delivered original intents, private wire references and budget reservations transferred without resetting history. The original-manifest backup, budget bytes and goal-ledger bytes matched the source inventory. Destination validation preceded the audited hash-only apply operation and an unprivileged supervised read-only run.

The VPS keeper owns an exclusive kernel `flock`. A scoped SIGKILL test killed only NabungFi processes; systemd automatically restarted the service and validated the same **one goal, ten original intents and zero pending work**, recovering the exited same-host signer lock. The auxiliary signal command reported a host control-group warning, but actual PID replacement, restart count, journal validation and subsequent health proved recovery. No new financial action was needed for the test. API graceful restart also returned to healthy state.

The host itself was not rebooted. Process-crash recovery and Linux boot-identity regression tests do not establish an actual reboot test or recovery of a live unresolved cross-chain packet. The existing applications were kept running.

## HTTPS, authentication and monitoring

External HTTPS health returned 200; unauthenticated goal access returned 401. The exact planned frontend origin received its matching CORS header, while HTTP and unapproved origins returned 403. A genuine Privy user session loaded through a local wireframe's explicit HTTPS development proxy and returned 200 for session and goals. This browser check copied no token and performed no financial transaction; it is separate from the earlier [owner financial lifecycle](BACKEND_OWNER_LIFECYCLE.md).

Certificate renewal was simulated successfully. The initial private-parent ACME location denied nginx traversal, so public challenges now use `/var/lib/nabungfi-acme`, outside the private bridge parent. A deploy hook reloads nginx only after renewal of this certificate. API, keeper and the read-only health timer are enabled at boot. The timer logs availability and authentication denial without restarting a financial worker or sending external messages.

The live coordinator reports six active-goal capacity, zero active registrations and one retained completed goal. Actual VPS checks passed 41 server tests, 48 Linux keeper tests and server typecheck. The current backend socket-IP throttle remains an aggregate 180 requests/minute behind nginx; forwarded-IP trust was not silently enabled.

This is a cash-only testnet release. Earning, mainnet security, long-term uptime and browser-wallet financial signing remain separate acceptance work. Frontend publication is now verified separately. Its API-origin change restarted only `nabungfi-api`; the keeper's PID remained unchanged and both services were active afterward. Operational commands, permissions and rollback are documented in [native deployment](../ops/native/README.md) and [keeper cutover](KEEPER_CUTOVER.md).
