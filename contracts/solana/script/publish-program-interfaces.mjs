// Devnet metadata only. No program deploy/upgrade, goal action or authority change.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {submitJournaled} from './transaction-journal.mjs';
const require=createRequire(new URL('../package.json',import.meta.url));
const web3=require('@solana/web3.js');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const signerPath=arg('--signer'),metadataCli=arg('--metadata-cli');
assert(signerPath&&metadataCli,'Provide --signer and the official --metadata-cli path');
const signer=web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(signerPath,'utf8'))));
const connection=new web3.Connection('https://api.devnet.solana.com','confirmed');
assert.equal(await connection.getGenesisHash(),'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
const broadcast=process.argv.includes('--broadcast');
const journal=resolve(arg('--journal')||'.local/program-interfaces-journal.json');
const records=[
 {name:'nabungfi_multi',program:'FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn'},
 {name:'nabungfi_multi_lz',program:'G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d'},
];
const metadataProgram='ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S';
const tag=Buffer.from('40f4bc78a7e9690a','hex');
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const meta=(pubkey,isWritable=false,isSigner=false)=>({pubkey:new web3.PublicKey(pubkey),isWritable,isSigner});
const hash=data=>createHash('sha256').update(data).digest('hex');
const planPath=resolve(arg('--plan')||'.local/program-interfaces-plan.json');
const fileHashes=Object.fromEntries(records.flatMap(record=>['json','codama.json','security.json'].map(extension=>{
 const file=`contracts/solana/idl/${record.name}.${extension}`;return[file,hash(readFileSync(resolve(file)))];
})));
let reviewed;
if(broadcast){
 reviewed=JSON.parse(readFileSync(planPath,'utf8'));
 assert.equal(reviewed.broadcast,false,'A read-only plan must precede publication');
 assert.equal(reviewed.signer,signer.publicKey.toBase58());
 assert.deepEqual(reviewed.fileHashes,fileHashes,'IDL files changed since planning');
 assert(reviewed.plannedRentLamports<250000000,'Planned rent exceeds the bounded budget');
 assert(await connection.getBalance(signer.publicKey)>reviewed.plannedRentLamports+20000000,'Insufficient Devnet gas');
}
const accountState=async(address,program)=>{
 const account=await connection.getAccountInfo(address);
 if(!account)return null;
 assert.equal(account.owner.toBase58(),program.toBase58());
 assert.equal(new web3.PublicKey(account.data.subarray(8,40)).toBase58(),signer.publicKey.toBase58(),'Unexpected IDL authority');
 const length=account.data.readUInt32LE(40);
 assert(length<=account.data.length-44,'Invalid IDL length');
 return {length,bytes:account.data.subarray(44,44+length)};
};
const simulate=async instructions=>{
 const block=await connection.getLatestBlockhash();
 const tx=new web3.VersionedTransaction(new web3.TransactionMessage({payerKey:signer.publicKey,recentBlockhash:block.blockhash,instructions}).compileToV0Message());
 tx.sign([signer]);
 const result=await connection.simulateTransaction(tx,{sigVerify:true,commitment:'confirmed'});
 assert(!result.value.err,JSON.stringify({error:result.value.err,logs:result.value.logs}));
 return result.value.unitsConsumed;
};
const plans=[];
let rentBudget=0;
for(const record of records){
 const program=new web3.PublicKey(record.program);
 const deployed=await connection.getAccountInfo(program);
 assert(deployed?.executable&&deployed.data.readUInt32LE(0)===2);
 const programData=new web3.PublicKey(deployed.data.subarray(4,36));
 const data=await connection.getAccountInfo(programData);
 assert(data&&data.data.readUInt32LE(0)===3&&data.data[12]===1);
 assert.equal(new web3.PublicKey(data.data.subarray(13,45)).toBase58(),signer.publicKey.toBase58());
 const elf=readFileSync(resolve(`contracts/solana/target/deploy-multichain/${record.name}.so`));
 assert(data.data.subarray(45,45+elf.length).equals(elf),'Local ELF differs from deployed program');
 const idl=JSON.parse(readFileSync(resolve(`contracts/solana/idl/${record.name}.json`),'utf8'));
 assert.equal(idl.address,record.program);
 const serialized=Buffer.from(JSON.stringify(idl)),compressed=deflateSync(serialized);
 assert(compressed.length<=59956,'IDL exceeds the supported account capacity');
 const base=web3.PublicKey.findProgramAddressSync([],program)[0];
 const idlAddress=await web3.PublicKey.createWithSeed(base,'anchor:idl',program);
 const capacity=Math.min(compressed.length*2,59956);
 const create=new web3.TransactionInstruction({programId:program,keys:[meta(signer.publicKey,false,true),meta(idlAddress,true),meta(base),meta(web3.SystemProgram.programId),meta(program)],data:Buffer.concat([tag,Buffer.from([0]),u64(capacity)])});
 const resize=new web3.TransactionInstruction({programId:program,keys:[meta(idlAddress,true),meta(signer.publicKey,false,true),meta(web3.SystemProgram.programId)],data:Buffer.concat([tag,Buffer.from([6]),u64(capacity)])});
 const initial=await accountState(idlAddress,program);
 const createInstructions=[create,...Array.from({length:Math.floor(capacity/10000)},()=>resize)];
 if(!initial){
  rentBudget+=await connection.getMinimumBalanceForRentExemption(capacity+44);
  const units=await simulate(createInstructions);
  plans.push({name:record.name,kind:'anchor',address:idlAddress.toBase58(),compressedBytes:compressed.length,simulationUnits:units});
  if(broadcast)await submitJournaled(connection,signer,createInstructions,journal,`anchor:${record.name}:${hash(serialized)}:create`);
 }
 if(broadcast){
  let state=await accountState(idlAddress,program);
  assert(state&&state.bytes.equals(compressed.subarray(0,state.length)),'Published IDL prefix differs; do not overwrite');
  while(state.length<compressed.length){
   const offset=state.length,chunk=compressed.subarray(offset,offset+600);
   const write=new web3.TransactionInstruction({programId:program,keys:[meta(idlAddress,true),meta(signer.publicKey,false,true)],data:Buffer.concat([tag,Buffer.from([2]),u32(chunk.length),chunk])});
   await submitJournaled(connection,signer,[write],journal,`anchor:${record.name}:${hash(serialized)}:write:${offset}`);
   state=await accountState(idlAddress,program);
   assert(state&&state.bytes.equals(compressed.subarray(0,state.length)));
  }
  assert.equal(inflateSync(state.bytes).toString(),serialized.toString());
 }
 for(const seed of ['idl','security']){
  const file=resolve(`contracts/solana/idl/${record.name}.${seed==='idl'?'codama':'security'}.json`);
  const exportPath=resolve(`.local/metadata-exports/${record.name}-${seed}-${hash(readFileSync(file))}.json`);
  let manifest;
  if(broadcast){manifest=JSON.parse(readFileSync(exportPath,'utf8'));}
  else {
   const exported=spawnSync(process.execPath,[resolve(metadataCli),'write',seed,record.program,file,'--rpc','https://api.devnet.solana.com','--keypair',signerPath,'--export','--export-encoding','base64'],{encoding:'utf8'});
   assert.equal(exported.status,0,exported.stderr||exported.stdout);
   manifest={address:exported.stdout.match(/metadata:\s*(\w+)/)?.[1],transactions:[...exported.stdout.matchAll(/\[Transaction #(\d+)\]\s*\r?\n([A-Za-z0-9+/=]+)/g)].map(match=>({number:match[1],encoded:match[2]}))};
   mkdirSync(dirname(exportPath),{recursive:true});writeFileSync(exportPath,JSON.stringify(manifest,null,2));
  }
  const transactions=manifest.transactions;
  assert(transactions.length,'No official metadata transactions exported');
  const address=manifest.address;
  assert(address,'Missing metadata account');
  if(broadcast){
   const expected=reviewed.plans.find(plan=>plan.name===record.name&&plan.kind==='pmp'&&plan.seed===seed);
   assert(expected,'Missing reviewed metadata plan');
   assert.equal(address,expected.address,'Metadata address changed since planning');
   assert.equal(transactions.length,expected.transactions,'Metadata transaction count changed since planning');
  }
  const allowedWritable=new Set([address,signer.publicKey.toBase58()]);
  for(const {number,encoded}of transactions){
   const tx=web3.VersionedTransaction.deserialize(Buffer.from(encoded,'base64'));
   assert.equal(tx.message.header.numRequiredSignatures,1);
   assert.equal(tx.message.staticAccountKeys[0].toBase58(),signer.publicKey.toBase58());
   assert.equal(tx.message.addressTableLookups.length,0);
   const instructions=tx.message.compiledInstructions.map(ix=>new web3.TransactionInstruction({programId:tx.message.staticAccountKeys[ix.programIdIndex],data:Buffer.from(ix.data),keys:ix.accountKeyIndexes.map(i=>meta(tx.message.staticAccountKeys[i],tx.message.isAccountWritable(i),tx.message.isAccountSigner(i)))}));
   for(const ix of instructions){
    assert([metadataProgram,web3.SystemProgram.programId.toBase58(),web3.ComputeBudgetProgram.programId.toBase58()].includes(ix.programId.toBase58()),'Unexpected exported program');
    assert(ix.keys.filter(k=>k.isWritable).every(k=>allowedWritable.has(k.pubkey.toBase58())),'Unexpected writable account');
    if(ix.programId.equals(web3.SystemProgram.programId))rentBudget+=Number(web3.SystemInstruction.decodeTransfer(ix).lamports);
   }
   if(broadcast)await submitJournaled(connection,signer,instructions,journal,`pmp:${record.name}:${seed}:${hash(readFileSync(file))}:${number}`);
  }
  plans.push({name:record.name,kind:'pmp',seed,address,transactions:transactions.length});
 }
}
assert(rentBudget<250000000,'Metadata storage exceeds the bounded Devnet rent budget');
assert(await connection.getBalance(signer.publicKey)>rentBudget+20000000,'Insufficient Devnet gas for metadata');
const evidence={network:'solana-devnet',broadcast,signer:signer.publicKey.toBase58(),plannedRentLamports:rentBudget,fileHashes,plans};
const output=resolve(arg('--evidence')||(broadcast?'.local/program-interfaces-publication.json':planPath));
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
