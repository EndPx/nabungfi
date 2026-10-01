import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,get} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {boundedChainRead,stopApplication} from '../src/server-runtime.js';

test('four global chain reads are admitted without queue; a fifth returns503 and slots release on errors',async()=>{
 let release!:()=>void;const gate=new Promise<void>(done=>{release=done;});let entered=0;
 const active=Array.from({length:4},()=>boundedChainRead(async()=>{entered++;await gate;}));
 assert.equal(entered,4);await assert.rejects(()=>boundedChainRead(async()=>{}),{code:'CHAIN_READ_BUSY',status:503});release();await Promise.all(active);
 await assert.rejects(()=>boundedChainRead(async()=>{throw new Error('controlled');}));assert.equal(await boundedChainRead(async()=>42),42);
});
test('shutdown closes in-flight sockets before cleanup and completes inside its deadline',async()=>{
 const server=createServer((_req,res)=>{res.writeHead(200);res.write('active');});server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
 const request=get('http://127.0.0.1:'+address.port);request.on('error',()=>{});const [response]=await once(request,'response');response.on('error',()=>{});await once(response,'data');
 let cleaned=false;const start=Date.now();const result=await stopApplication(server,async()=>{assert.equal(server.listening,false);const count=await new Promise<number>((done,fail)=>server.getConnections((error,n)=>error?fail(error):done(n)));assert.equal(count,0);cleaned=true;},120);
 assert.equal(result.forcedConnections,true);assert.equal(result.cleanupCompleted,true);assert.equal(cleaned,true);assert.ok(Date.now()-start<1000);
});
test('shutdown returns at deadline even when a cleanup provider stalls',async()=>{
 const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const start=Date.now();const result=await stopApplication(server,async()=>new Promise<void>(()=>{}),40);assert.equal(result.cleanupCompleted,false);assert.ok(Date.now()-start<500);
});
test('SIGTERM handler terminates an in-flight child request after connection cleanup', {timeout:5000},async()=>{
 const child=spawn(process.execPath,['--import','tsx',fileURLToPath(new URL('./fixtures/shutdown-child.ts',import.meta.url))],{stdio:['ignore','pipe','pipe','ipc']});let output='';child.stdout.on('data',data=>{output+=data.toString();});child.stderr.on('data',()=>{});const exited=once(child,'exit');let request:ReturnType<typeof get>|undefined;
 try{const [ready]=await once(child,'message');request=get('http://127.0.0.1:'+(ready as{port:number}).port);request.on('error',()=>{});const [response]=await once(request,'response');response.on('error',()=>{});await once(response,'data');if(process.platform==='win32')child.send('test-sigterm');else child.kill('SIGTERM');const [code]=await exited;assert.equal(code,0);assert.deepEqual(JSON.parse(output.trim()),{cleaned:true,connections:0});}
 finally{request?.destroy();if(child.exitCode===null)child.kill();}
});
