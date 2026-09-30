import{execFile}from'node:child_process';import assert from'node:assert/strict';
export function capturedCommand(executable,args,input){return new Promise((resolve,reject)=>{const child=execFile(executable,args,{maxBuffer:1048576,timeout:120000},(error,stdout)=>error?reject(new Error('Foundry command failed (output suppressed)')):resolve(stdout));if(input!==undefined)child.stdin.end(input);});}
export async function verifySignedTransaction(signer,wire,planned){
 const result=JSON.parse(await capturedCommand(signer.executable,[...(signer.prefixArgs||[]),'decode-transaction','--json'],wire));
 assert.equal(result.success,true,'Transaction decoder rejected signed wire');const tx=typeof result.data==='string'?JSON.parse(result.data):result.data;
 return verifyDecodedTransaction(signer,tx,planned);
}
export function verifyDecodedTransaction(signer,tx,planned){
 assert.equal(tx.signer.toLowerCase(),signer.signerAddress.toLowerCase());assert.equal(tx.type,'0x0');assert.equal(tx.to.toLowerCase(),planned.tx.to.toLowerCase());assert.equal(tx.input.toLowerCase(),planned.tx.data.toLowerCase());
 for(const[key,expected]of[['chainId',planned.chain.chainId],['nonce',planned.nonce],['gas',planned.gasLimit],['gasPrice',planned.gasPrice],['value',planned.value]])assert.equal(BigInt(tx[key]),BigInt(expected),`Signed ${key} changed`);
 assert.equal(tx.hash.toLowerCase(),planned.hash.toLowerCase());return true;
}
