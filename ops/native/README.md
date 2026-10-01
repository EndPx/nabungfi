# Native Node deployment on an existing VPS

These are reviewable templates. They have not been installed on a remote server. The backend runs as native Linux processes behind the host's existing nginx; the frontend remains on Vercel. No container runtime is required. Deploy only the `nabungfi-*` units and one dedicated API vhost. Existing CommitPass, Slope, nginx sites, runtime binaries, and service users remain outside this deployment.

## Release gates and fixed boundaries

Confirm architecture, available memory, the free loopback port **3901**, DNS, certificate ownership, and the exact frontend origin before installation. The candidate names `nabungfi-api.endpx.cloud` and `nabungfi.endpx.cloud` in the examples are not evidence of DNS or deployment. The application remains **testnet-only**, with six active coordinator goals and 500 lifetime registry identities. A production process profile does not establish mainnet support, real earning, completed Privy browser login or financial execution evidence.

Use an immutable release directory `/opt/nabungfi/releases/<reviewed-commit>` and a `current` symlink selected only while both processes are stopped. A release contains public source and a fresh Linux dependency installation from the pinned lockfile. It contains no `.env`, operator keys, journals, signed wires, or private config. Do not copy Windows `node_modules`; the Linux runtime proof exposed the incompatible Windows esbuild binary. Do not replace `/usr/bin/node`, a shared global pnpm, or another application's Foundry installation.

[runtime-pins.json](runtime-pins.json) records the tested Node 24.18.0 Linux-x64 archive digest, pnpm 10.21.0, and the existing cast 1.8.3 binary digest/commit. The recorded digests identify inspected artifacts; independently validate the Node official release checksum/signature when acquiring a new copy. Extract under `/opt/nabungfi/runtime`, root-owned and service-read-only. On a fresh Linux installation, install dependencies with the pinned pnpm and `--frozen-lockfile`; verify the Linux native binaries before starting. Do not suppress required dependency installation scripts without verifying an equivalent native binary setup.

## Separate users and filesystem rights

Create dedicated non-login system users `nabungfi-api` and `nabungfi-keeper`, private homes under `/var/lib`, and a supplementary `nabungfi-bridge` group. The API user is never added to the keeper's private group. Install these exact ownership/mode boundaries after checking that the names do not belong to another service:

| Path | Owner / group | Mode and use |
| --- | --- | --- |
| `/opt/nabungfi/releases` and runtime | root / root | Public immutable source/runtime, service-readable |
| `/etc/nabungfi/api.env` | root / nabungfi-api | 0640; Privy/Neon server credentials |
| `/etc/nabungfi/keeper.env`, `keeper.json` | root / nabungfi-keeper | 0640; private RPC/config, no Privy/Neon |
| `/var/lib/nabungfi-api` and `.local` | nabungfi-api / nabungfi-api | 0700; API-only private state |
| `/var/lib/nabungfi-keeper` and `.local` | nabungfi-keeper / nabungfi-keeper | 0700; signer material, budgets, original wires and journals |
| `/var/lib/nabungfi` and `.local` | root / nabungfi-bridge | 0750; traversal to the two bridge directories |
| `/var/lib/nabungfi/.local/registry` | nabungfi-api / nabungfi-bridge | **2750**; API writes, keeper only reads |
| `/var/lib/nabungfi/.local/status` | nabungfi-keeper / nabungfi-bridge | **2750**; keeper writes, API only reads |
| Published registry/status files | respective writer / nabungfi-bridge | **0640**, including every atomic replacement |
| Operator key, encrypted keystore, journals and wires | nabungfi-keeper / nabungfi-keeper | 0600 inside 0700 directories |

The writer directories use setgid so replacement files retain the bridge group. Services use `UMask=0027`: `0077` would remove group readability even when a writer requests 0640. The source permission change affects only API registry publication and the worker's status file. `atomicWrite` retains a **0600 default** for all financial journals and signed wires. Opposite directory write permission is denied, preventing one actor from replacing the other's files. A shared writable directory or one shared service identity would weaken this boundary.

Validate real POSIX behavior with public test markers only:

```sh
sudo bash ops/native/check-bridge-acl.sh /absolute/linux/node /absolute/public/checkout
```

The check uses two existing test-host identities (`nobody` and `daemon`) in a fresh temporary directory. It performs actual cross-user reads after two atomic replacements, verifies default private file denial, attempts opposite-directory writes, then removes only its temporary fixture. It does not open real keys, connect to a network, modify account membership, or start services. Repeat an equivalent check with the actual dedicated VPS users before cutover; Windows file permissions are insufficient evidence.

## Private configuration

Install [api.env.example](api.env.example) and [keeper.env.example](keeper.env.example) as private files with real values supplied securely outside Git/chat. Keep `PRIVY_APP_SECRET` and the Neon credential URL only in the API environment. Set `PORT=3901`, `NABUNGFI_API_HOST=127.0.0.1`, and exact HTTPS frontend origins. The release's `apps/server/.env` must be absent so no unexpected local credentials override the service environment.

Create the private keeper config from the **actual reviewed current config**, preserving contract IDs, owner bindings, policy/caps and every accepted goal. Set `authorityMode` to `permissionless`, `autoPrepare:false` for application goals, and `goals:[]` only for a genuinely new empty registry. Existing accepted history must never be replaced with an empty registry. Intended target paths are:

```text
stateDirectory: /var/lib/nabungfi-keeper/.local/state
signerLockFile: /var/lib/nabungfi-keeper/.local/operator.lock
registryFile: /var/lib/nabungfi/.local/registry/goals.json
statusFile: /var/lib/nabungfi/.local/status/operator-status.json
solana.signerPath: /var/lib/nabungfi-keeper/.local/keys/solana.json
evm.executable: /opt/nabungfi/runtime/foundry-1.8.3/cast
```

The encrypted `deployer-wallet` belongs under the keeper's private `HOME/.foundry/keystores`. The API must fail an attempt to read that tree. Copy only the coordination operator material; external financial-owner fixture keys must not be deployed. Runtime paths participate in existing configuration fingerprints: do not simply edit the config and delete its manifest to bypass a mismatch. Follow the reviewed [keeper cutover](../../docs/KEEPER_CUTOVER.md) audit/relocation procedure. The six allowed runtime-path changes require explicit provenance while financial identities, intent bytes, hashes, fees/budgets and original wires remain intact.

## Exclusive signer cutover

1. Stage and validate public code, runtimes and private target directories while **all VPS NabungFi services remain disabled**. Do not start a second signer as a connectivity test. The API may be tested on an isolated port with coordinator publishing disabled.
2. Gracefully stop the local WSL keeper and the Windows API publisher. Wait until the original worker and any child signer have exited and its live signer lock is released. Archive the exact private config, accepted registry, full goal ledgers, budgets, manifest, wires and completion status with a checksum inventory. Do not copy a live lock as a usable VPS lock.
3. Transfer the private archive through the authenticated SSH channel with restrictive destination ownership. Preserve the originals for recovery. Execute only the reviewed path-relocation audit; do not reset budgets, clear ambiguous intents, change goal owners/targets or regenerate original wire files.
4. Audit the target state before broadcast. Every original intent must retain its original hash/wire. The current relocation tool deliberately requires **all accepted goals fully claimed and every intent terminal/delivered**; it refuses pending work or funded goals. If this gate fails, retain the old host as the only operator and reconcile the original hashes there. Do not mark a journal complete or discard funded goals to force migration. A dry read-only worker check also acquires the same signer lock, so it cannot run alongside a live signer. Native balances must satisfy the existing per-network floors and finite fee caps.
5. Verify users/permissions, pinned binaries, the supervisor's kernel lock, service parsing, localhost API auth denial and nginx/TLS routing. Start **one VPS keeper**, confirm a fresh broadcast-enabled status and original history, then start the API publisher against that same registry. Publish the backend URL to the Vercel configuration only after these gates pass.
6. Keep the local signer disabled after cutover. Record host, release commit, runtime hashes, migration manifest digest, service PIDs, status freshness and pending-original reconciliation outcomes without credentials or wire contents.

Starting the API after the keeper avoids an initial empty publication. API and keeper availability are independent: the API remains readable when coordination is paused, but refuses new provisioning fees. There is no cross-host distributed signer lock. Human-controlled exclusive cutover is required whenever the same operator key can still run on another machine.

## Services, nginx and health

Review [API](nabungfi-api.service), [keeper](nabungfi-keeper.service), [health service](nabungfi-health.service) and [health timer](nabungfi-health.timer) before installing them into `/etc/systemd/system`. The keeper is exec'ed through nonblocking `flock --no-fork` on `<signerLockFile>.supervisor`, then runs the reviewed supervisor. Do not hide `/proc/locks`, `/proc/sys/kernel/random/boot_id`, `/proc/<pid>/stat` or `/etc/machine-id`; Linux restart identity verification needs them.

The defaults limit each daemon to 512 MiB, 50% CPU, 64 tasks and 2048 descriptors. These are initial shared-host limits, not a throughput guarantee; validate against actual VPS headroom. API stop allowance is 35 seconds around its bounded 30-second cleanup. Keeper graceful stop allowance is 15 minutes for bounded multi-step RPC/signing work; forced termination preserves original journals and requires audited recovery. Finite restart bursts prevent an invalid configuration from looping forever. The health timer only records availability and auth-denial checks; it neither restarts a financial worker nor sends external notifications.

Confirm the dedicated candidate domain and certificate, then install only [nginx-api.conf.example](nginx-api.conf.example). Test the complete host config with `nginx -t` before a reload; leave unrelated vhosts untouched. The vhost forwards `/api/` to loopback 3901, limits bodies, does not cache private responses, and disables upstream retry after an ambiguous action. The frontend remains on Vercel with an explicit backend rewrite/base URL and matching Privy production-origin settings.

The current API deliberately does not trust arbitrary forwarded-IP headers. Behind nginx its existing 180/minute socket-IP limiter acts as a conservative aggregate beta limit. Do not silently enable forwarded-IP trust or promise a larger multi-user rate before a separate reviewed proxy policy.

Useful scoped checks after installation:

```sh
systemd-analyze verify /etc/systemd/system/nabungfi-api.service /etc/systemd/system/nabungfi-keeper.service /etc/systemd/system/nabungfi-health.service /etc/systemd/system/nabungfi-health.timer
systemctl status nabungfi-api nabungfi-keeper --no-pager
curl --fail --silent http://127.0.0.1:3901/api/health
curl --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3901/api/goals
journalctl -u nabungfi-api -u nabungfi-keeper -u nabungfi-health --since '10 minutes ago' --no-pager
```

Expected unauthenticated status is 401. A health response alone does not prove Neon, real Privy user login, immutable contract routes or a user-owned transaction. Verify those separate backend gates and fresh coordinator status before declaring live readiness. Inspect log output privately; never publish environment dumps, raw SDK errors, signed wires or operator material.

## Crash, reboot and rollback

The supervisor holds a kernel guard for the full worker lifetime. Automatic stale file-lock recovery is allowed only after same-machine Linux identity, dead/reused PID or a previous boot, correct owner and intact original journal checks pass. A foreign-host lock, live competing process, missing wire or corrupt ledger fails closed. Do not use `rm *.lock`, reset state directories, rebuild pending nonces or start a second process to "unstick" coordination.

For rollback, stop **both** NabungFi services, prove the signer and child processes are gone, retain the latest authoritative state, and point `current` to a previously reviewed compatible code release. Restart against the latest journals; never restore older database/journal snapshots that forget signed or submitted work. Reconcile the original hashes before any renewed signing. A return to the local host repeats the same exclusive archive/audit/cutover procedure in reverse.

Primary references: [systemd 255 execution isolation](https://github.com/systemd/systemd/blob/v255/man/systemd.exec.xml), [systemd service lifecycle](https://github.com/systemd/systemd/blob/v255/man/systemd.service.xml), and [nginx proxy directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html). VPS application of these templates, real TLS, permissions under the actual service users, and operator cutover remain deployment evidence to collect separately.
