# Keeper cutover and Linux restart

This procedure moves the existing **permissionless** application keeper without resetting an accepted goal, native budget, transaction hash or signed wire. It is a source-reviewed deployment procedure. Local subprocess tests do not prove VPS uptime, reboot recovery on the VPS, or delivery of a live unresolved packet after a reboot.

## One signer on one active host

A local filesystem lock cannot fence another machine. Stop and disable the original worker's automatic startup before enabling the VPS worker. Freeze the original API registry publisher during the snapshot/copy; switch publishing to the new registry path only after the copied registry has been validated. Keep the original source state as a private read-only archive. Do not resume the old signer service after cutover. Remove its signing access or otherwise enforce that it cannot restart before handing signing authority to the new host.

These host shutdown and authority-transfer facts are operator attestations; the relocation tool cannot remotely prove that an old service will remain disabled. Its explicit acknowledgement does not substitute for checking the old PID, service and publisher. No unrelated application needs restarting, and this procedure uses Node and a process supervisor, without Docker.

## Snapshot and narrowly audited path relocation

The original manifest binds the effective configuration. Only these fields may differ in the destination configuration:

- `stateDirectory`, `signerLockFile`, `registryFile`, `statusFile`
- `solana.signerPath`, `evm.executable`

Signer account/address, authority mode, RPC/network/token identities, goals, policies, fees and receive options must remain identical. The account remains `deployer-wallet`; ensure the destination service's HOME contains that same encrypted account and the configured Solana signer has the expected public key. Existing chain validation still runs before any signing.

1. Stop the old worker gracefully. Run its unchanged `registry-cli.mjs --once` without `--broadcast` to reconcile any original work. Stop/freeze the registry publisher. Confirm no signer lock remains and no process can restart. This migration intentionally refuses pending work or funded goals.
2. The snapshot command separately reads **every** accepted goal, including archived completed goals, and rechecks every original source receipt. Its read-only adapter does not load signer keys and rejects prepare/sign/broadcast operations. All fresh observations must be within five minutes, achieved and fully claimed with zero cash/NAV/receipts. Observations are stored in the private relocation snapshot; existing goal journal bytes/timestamps remain untouched. The new configuration can be authored on the source host; its destination paths do not need to exist yet.
3. Copy the whole original state directory, original/new private configurations, registry, relocation snapshot and required signer files through a private authenticated channel. Preserve private POSIX permissions. Neither keys nor signed wire contents belong in Git, command output or public evidence.
4. Run destination validation, then the explicit apply command. The registry's bytes and every state file's size/SHA-256 must match the source inventory. The tool stores the exact original manifest and a durable staged receipt before changing only its configuration hash. Budgets, goal ledgers and original signed wires stay byte-identical.
5. Verify the completed receipt and start with read-only `--once` before enabling broadcast. Publish only non-secret counts/hashes and actual runtime/chain checks as deployment evidence.

```sh
# Run on the stopped source host. Configurations and snapshot stay private.
node contracts/keeper/src/relocate-cli.mjs snapshot \
  --old-config /private/source-keeper.json \
  --new-config /private/vps-keeper.json \
  --snapshot /private/cutover-snapshot.json \
  --ack SOURCE_SIGNER_AND_PUBLISHER_STOPPED_NO_OTHER_HOST_ACTIVE

# Run on the destination; this first command only validates the transferred state.
node contracts/keeper/src/relocate-cli.mjs apply \
  --old-config /private/source-keeper.json \
  --new-config /private/vps-keeper.json \
  --snapshot /private/cutover-snapshot.json \
  --ack SOURCE_SIGNER_AND_PUBLISHER_STOPPED_NO_OTHER_HOST_ACTIVE

# After reviewing validation, repeat with --apply to record the audited hash change.
node contracts/keeper/src/relocate-cli.mjs apply \
  --old-config /private/source-keeper.json \
  --new-config /private/vps-keeper.json \
  --snapshot /private/cutover-snapshot.json \
  --ack SOURCE_SIGNER_AND_PUBLISHER_STOPPED_NO_OTHER_HOST_ACTIVE --apply
```

The apply step is idempotent for the same snapshot. A crash after the staged receipt is durable can be recovered by repeating that exact command; the supervisor refuses an incomplete receipt. A crash after the manifest backup but before its receipt requires manual reconciliation rather than a new snapshot or journal reset. Changing another field, missing/corrupt files, orphan reservations, a changed registry, a retained signer lock or a different migration receipt all fail closed.

## Supervised restart on the same Linux host

New Linux signer locks include machine ID, boot ID and process start ticks. The Linux supervisor uses a separate **kernel** exclusive `flock` for its entire lifetime. It verifies that its own PID holds the expected lock; invoking `supervisor.mjs` without `flock` cannot perform recovery. Before the worker starts, it validates the existing manifest, accepted ledgers, original wire integrity and native reservations.

```sh
# Replace paths with the audited destination configuration's paths.
# The .supervisor path must be exactly signerLockFile + '.supervisor'.
umask 0027
/usr/bin/flock --nonblock --no-fork \
  /var/lib/nabungfi-keeper/.local/operator.lock.supervisor \
  /opt/nabungfi/runtime/node-v24.18.0-linux-x64/bin/node contracts/keeper/src/supervisor.mjs \
  --config /etc/nabungfi/keeper.json --once

# The reviewed service uses the same command with --broadcast instead of --once.
```

Only a lock from the same machine with a changed boot ID, an absent PID or different process start ticks is recoverable automatically. An alive owner, legacy lock, foreign-host identity or corrupt state pauses startup. Recovery removes only the stale lock, never a journal or budget. Missing original state is an error; the supervised entry point cannot start a fresh accounting history.

Use `Restart=on-failure`, a finite restart-rate limit and `KillMode=control-group`; signal the supervisor normally so it forwards SIGTERM and waits for its child. Allow up to 15 minutes for bounded in-progress RPC/signing operations before forceful group termination. A forced termination leaves durable original hashes/wires for the next worker's normal reconciliation. It does not authorize fresh replacement signatures. Keep `/etc/machine-id`, `/proc/sys/kernel/random/boot_id`, `/proc/<pid>/stat` and `/proc/locks` visible to the service. Do not delete a lock in an unconditional `ExecStartPre` command.

The worker still queries an original transaction before retrying. Pending retries use the identical private signed bytes and the same reservation; expired Solana transactions, conflicting EVM nonces, ambiguous or failed receipts, and orphan reservations remain manual recovery cases. Daily budgets mean the UTC reservation day, including the previously documented possibility of older reservations executing later.

## Verification boundaries

```sh
pnpm --filter @nabungfi/keeper test
# Linux-only subprocess proof: no RPC, real keys or financial operations.
node --test contracts/keeper/test/supervision.linux.mjs
```

The tests cover exact-state relocation, six-field restrictions, original-wire tampering, missing state, pending/orphan budget refusal, staged migration recovery, live/foreign/legacy lock refusal, PID reuse/reboot decisions, and actual local SIGKILL plus kernel-lock contention. Deployment acceptance additionally needs destination read-only checks, one active signer host, healthy registry/status publication and genuine supervised runtime observations. Retained completed goals must remain in the manifest and database history.
