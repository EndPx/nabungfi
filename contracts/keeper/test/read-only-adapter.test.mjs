import test from 'node:test';
import assert from 'node:assert/strict';
import {ChainAdapter} from '../src/adapter.mjs';
test('migration read-only adapter never accesses absent signer file and denies signed operations',async()=>{
  const reader=new ChainAdapter({solana:{rpc:'http://127.0.0.1:1',signerPath:'/nonexistent-do-not-read-private-key'},stateDirectory:'/tmp/private'}, {readOnly:true});
  assert.equal(reader.signer,undefined);
  await assert.rejects(reader.prepare({},{}),/Read-only/);
  await assert.rejects(reader.sign({}),/Read-only/);
  await assert.rejects(reader.broadcast({}),/Read-only/);
});
