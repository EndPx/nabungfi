#!/usr/bin/env bash
# Local/test-host POSIX proof using public markers only. No network, real keys or services.
set -euo pipefail
node_bin=${1:?Absolute Linux Node binary required}
source_root=${2:?Absolute source checkout required}
[[ $(id -u) == 0 ]] || { echo 'Run isolated POSIX ACL test as root.' >&2; exit 1; }
[[ -x "$node_bin" && -f "$source_root/contracts/keeper/src/persistence.mjs" ]] || exit 1
api_uid=$(id -u nobody)
api_gid=$(id -g nobody)
worker_uid=$(id -u daemon)
bridge_gid=$(id -g daemon)
test_root=$(mktemp -d /tmp/nabungfi-bridge-acl.XXXXXXXX)
[[ "$test_root" == /tmp/nabungfi-bridge-acl.* && -d "$test_root" ]] || exit 1
trap 'rm -rf -- "$test_root"' EXIT
chmod 0755 "$test_root"
install -d -o "$api_uid" -g "$bridge_gid" -m 2750 "$test_root/registry"
install -d -o "$worker_uid" -g "$bridge_gid" -m 2750 "$test_root/status"
install -d -o "$worker_uid" -g "$bridge_gid" -m 0700 "$test_root/worker-private"
printf 'PUBLIC_TEST_MARKER_ONLY\n' > "$test_root/worker-private/mock-key"
chown "$worker_uid:$bridge_gid" "$test_root/worker-private/mock-key"
chmod 0600 "$test_root/worker-private/mock-key"
writer='import{pathToFileURL}from"node:url";const{atomicWrite}=await import(pathToFileURL(process.argv[1]));process.umask(0o027);atomicWrite(process.argv[2],{testOnly:true,version:Number(process.argv[3])},{mode:0o640});atomicWrite(process.argv[4],{testOnly:true});'
reader='import{readFileSync}from"node:fs";readFileSync(process.argv[1]);'
directory_writer='import{openSync,closeSync,unlinkSync}from"node:fs";const path=process.argv[1]+"/forbidden-test-write";const fd=openSync(path,"wx");closeSync(fd);unlinkSync(path);'
for version in 1 2; do
  runuser -u nobody -g "$(id -gn nobody)" -G "$(id -gn daemon)" -- "$node_bin" --input-type=module -e "$writer" "$source_root/contracts/keeper/src/persistence.mjs" "$test_root/registry/goals.json" "$version" "$test_root/registry/private-journal.json"
  runuser -u daemon -- "$node_bin" --input-type=module -e "$reader" "$test_root/registry/goals.json"
  if runuser -u daemon -- "$node_bin" --input-type=module -e "$reader" "$test_root/registry/private-journal.json" >/dev/null 2>&1; then exit 1; fi
  [[ $(stat -c %a "$test_root/registry/goals.json") == 640 ]]
  [[ $(stat -c %a "$test_root/registry/private-journal.json") == 600 ]]
  runuser -u daemon -- "$node_bin" --input-type=module -e "$writer" "$source_root/contracts/keeper/src/persistence.mjs" "$test_root/status/operator-status.json" "$version" "$test_root/status/private-journal.json"
  runuser -u nobody -g "$(id -gn nobody)" -G "$(id -gn daemon)" -- "$node_bin" --input-type=module -e "$reader" "$test_root/status/operator-status.json"
  if runuser -u nobody -g "$(id -gn nobody)" -G "$(id -gn daemon)" -- "$node_bin" --input-type=module -e "$reader" "$test_root/status/private-journal.json" >/dev/null 2>&1; then exit 1; fi
done
if runuser -u nobody -g "$(id -gn nobody)" -G "$(id -gn daemon)" -- "$node_bin" --input-type=module -e "$reader" "$test_root/worker-private/mock-key" >/dev/null 2>&1; then exit 1; fi
if runuser -u daemon -- "$node_bin" --input-type=module -e "$directory_writer" "$test_root/registry" >/dev/null 2>&1; then exit 1; fi
if runuser -u nobody -g "$(id -gn nobody)" -G "$(id -gn daemon)" -- "$node_bin" --input-type=module -e "$directory_writer" "$test_root/status" >/dev/null 2>&1; then exit 1; fi
echo '{"posixCrossUserRead":true,"atomicRenameReplacements":2,"privateJournalMode":"0600","apiCannotReadWorkerPrivate":true,"oppositeWriterDirectoryDenied":true,"networkCalls":0,"realKeyReads":0}'
