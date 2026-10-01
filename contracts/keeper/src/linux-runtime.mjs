import assert from 'node:assert/strict';
import {readFileSync, lstatSync} from 'node:fs';

// Linux identities distinguish reboot/PID reuse. Other platforms remain manual-only.
export function linuxProcessIdentity(pid=process.pid, read=path=>readFileSync(path,'utf8')) {
  if(process.platform!=='linux' && arguments.length<2)return undefined;
  const machineId=read('/etc/machine-id').trim(),bootId=read('/proc/sys/kernel/random/boot_id').trim();
  assert(/^[a-f0-9]{32}$/.test(machineId)&&/^[a-f0-9-]{36}$/.test(bootId),'Linux host identity unavailable');
  let stat;
  try{stat=read(`/proc/${pid}/stat`);}catch(error){if(error.code==='ENOENT')return{machineId,bootId,startTicks:null};throw error;}
  const startTicks=stat.slice(stat.lastIndexOf(')')+2).trim().split(/\s+/)[19];
  assert(/^\d+$/.test(startTicks),'Linux process identity unavailable');
  return{machineId,bootId,startTicks};
}

/** Called by an exec'ed `flock --no-fork` process, never by an unlocked recovery script. */
export function assertKernelSupervisorLock(path) {
  assert.equal(process.platform,'linux','Keeper supervision requires Linux flock');
  const file=lstatSync(path,{bigint:true});assert(file.isFile(),'Supervisor lock must be a regular file');
  assert.equal(file.uid,BigInt(process.getuid()),'Supervisor lock belongs to another user');
  assert.equal(file.mode&0o022n,0n,'Supervisor lock cannot be writable by other users');
  const major=((file.dev>>8n)&0xfffn)|((file.dev>>32n)&~0xfffn);
  const minor=(file.dev&0xffn)|((file.dev>>12n)&~0xffn);
  const held=readFileSync('/proc/locks','utf8').split('\n').some(line=>{
    const match=line.match(/^\d+: FLOCK\s+ADVISORY\s+WRITE\s+(\d+)\s+([\da-f]+):([\da-f]+):(\d+)\s+0\s+EOF$/i);
    return match&&Number(match[1])===process.pid&&BigInt('0x'+match[2])===major&&BigInt('0x'+match[3])===minor&&BigInt(match[4])===file.ino;
  });
  assert(held,'Supervisor must hold its exclusive kernel flock before lock recovery');
}
