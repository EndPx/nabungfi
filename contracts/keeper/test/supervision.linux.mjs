import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,chmodSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
assert.equal(process.platform,'linux','Run this integration file on Linux');
const persistence=new URL('../src/persistence.mjs',import.meta.url).href;
const supervision=new URL('../src/supervision.mjs',import.meta.url).href;
const linux=new URL('../src/linux-runtime.mjs',import.meta.url).href;
const ready=child=>new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Exited before ready: '+code)));});
test('kernel flock prevents concurrent supervisors; SIGKILL leaves recoverable original lock',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'keeper-linux-')),lock=join(dir,'signer.lock'),guard=lock+'.supervisor';writeFileSync(guard,'');chmodSync(guard,0o600);
  const owner=spawn(process.execPath,['--input-type=module','-e',`import{acquireSignerLock}from${JSON.stringify(persistence)};acquireSignerLock(${JSON.stringify(lock)});console.log('ready');setInterval(()=>{},1000);`]);
  let holder;
  try{
    await ready(owner);
    const check=()=>spawnSync('flock',['--nonblock','--conflict-exit-code','75','--no-fork',guard,process.execPath,'--input-type=module','-e',`import{recoverSameHostSignerLock}from${JSON.stringify(supervision)};recoverSameHostSignerLock(${JSON.stringify(lock)});`],{encoding:'utf8'});
    assert.notEqual(check().status,0,'Must not remove a live owner lock');assert(existsSync(lock));
    const exited=new Promise(resolve=>owner.once('exit',resolve));owner.kill('SIGKILL');await exited;
    assert.equal(check().status,0);assert(!existsSync(lock));
    holder=spawn('flock',['--nonblock','--no-fork',guard,process.execPath,'--input-type=module','-e',`import{assertKernelSupervisorLock}from${JSON.stringify(linux)};assertKernelSupervisorLock(${JSON.stringify(guard)});console.log('ready');setInterval(()=>{},1000);`]);
    await ready(holder);assert.equal(check().status,75,'Second supervisor cannot enter recovery');
  }finally{owner.kill('SIGKILL');if(holder){const exited=new Promise(resolve=>holder.once('exit',resolve));holder.kill('SIGKILL');await exited;}rmSync(dir,{recursive:true,force:true});}
});
