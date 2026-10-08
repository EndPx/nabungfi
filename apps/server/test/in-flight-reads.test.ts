import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inFlightReads} from '../src/in-flight-reads.js';

test('overlapping identical goal reads share work; subsequent reads are fresh and identities stay isolated', async () => {
 const read=inFlightReads<number>();let calls=0;let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const first=read('owner-a:goal-a:binding-a',async()=>{calls++;await gate;return 42;});
 const shared=read('owner-a:goal-a:binding-a',async()=>{calls++;return 99;});
 const other=read('owner-b:goal-a:binding-a',async()=>{calls++;return 7;});
 release();assert.deepEqual(await Promise.all([first,shared,other]),[42,42,7]);assert.equal(calls,2);
 assert.equal(await read('owner-a:goal-a:binding-a',async()=>{calls++;return 43;}),43);assert.equal(calls,3);
 assert.equal(await read('owner-a:goal-a:binding-b',async()=>8),8);
});
test('failed reads cannot leave a rejected promise cached', async () => {
 const read=inFlightReads<number>();
 await assert.rejects(read('a',async()=>{throw Error('RPC unavailable');}));
 assert.equal(await read('a',async()=>1),1);
});
