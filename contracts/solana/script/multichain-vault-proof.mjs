// Read the actual factory/router/vault commitments before binding a Solana goal.
import{createRequire}from'node:module';import assert from'node:assert/strict';
import{CORE_V2,TRANSPORT_V2,STORE_V2,USDC_V2}from'./multichain-instructions.mjs';
const directRequire=createRequire(new URL('../package.json',import.meta.url));const{keccak_256}=directRequire('@noble/hashes/sha3.js');
const runtimeRequire=createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON||new URL('../package.json',import.meta.url));const{PublicKey}=runtimeRequire('@solana/web3.js');
const selector=s=>`0x${Buffer.from(keccak_256(Buffer.from(s))).subarray(0,4).toString('hex')}`;const solBytes=a=>`0x${new PublicKey(a).toBuffer().toString('hex')}`;
export async function verifyMultichainVaults(environment,g){
 const prefixes={2:'BASE_SEPOLIA',3:'ARBITRUM_SEPOLIA',4:'ETHEREUM_SEPOLIA'},chainIds={2:84532n,3:421614n,4:11155111n};const proofs=[];
 for(const p of g.participants){const rpcUrl=environment[`${prefixes[p.domain]}_RPC_URL`];assert(rpcUrl);let next=0;
  const call=async(method,params)=>{await new Promise(done=>setTimeout(done,Math.max(0,next-Date.now())));next=Date.now()+550;const response=await(await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json();assert(!response.error,JSON.stringify(response.error));return response.result;};
  assert.equal(BigInt(await call('eth_chainId',[])),chainIds[p.domain]);assert((await call('eth_getCode',[p.router,'latest'])).length>2);assert((await call('eth_getCode',[p.vault,'latest'])).length>2);
  const read=async(address,signature,arg='')=>call('eth_call',[{to:address,data:`${selector(signature)}${arg}`},'latest']);const addressWord=a=>a.slice(2).toLowerCase().padStart(64,'0');
  assert.equal(BigInt(await read(p.router,'domain()')),BigInt(p.domain));assert.equal(BigInt(await read(p.router,'eid()')),BigInt(p.eid));assert.equal(BigInt(await read(p.router,'solanaEid()')),40168n);assert.equal(await read(p.router,'solanaOApp()'),solBytes(STORE_V2));
  assert.equal(BigInt(await read(p.router,'isVault(address)',addressWord(p.vault))),1n,'Vault must be created by configured factory');const factory=`0x${(await read(p.router,'factory()')).slice(-40)}`;
  assert.equal(await read(factory,'solana()'),`${solBytes(CORE_V2)}${solBytes(USDC_V2).slice(2)}${solBytes(TRANSPORT_V2).slice(2)}`);
  assert.equal((await read(factory,'router()')).slice(-40).toLowerCase(),p.router.slice(2).toLowerCase());assert.equal(BigInt(await read(factory,'domain()')),BigInt(p.domain));assert.equal(BigInt(await read(factory,'eid()')),BigInt(p.eid));
  assert.equal((await read(factory,'asset()')).slice(-40).toLowerCase(),p.asset.slice(2).toLowerCase());
  assert.equal((await read(p.vault,'owner()')).slice(-40).toLowerCase(),p.owner.slice(2).toLowerCase());assert.equal(await read(p.vault,'goalId()'),g.goalId.toLowerCase());assert.equal(await read(p.vault,'sourceCoordinator()'),solBytes(g.goal));assert.equal(BigInt(await read(p.vault,'target()')),g.target);assert.equal(BigInt(await read(p.vault,'destinationDomain()')),BigInt(p.domain));assert.equal((await read(p.vault,'messenger()')).slice(-40).toLowerCase(),p.router.slice(2).toLowerCase());assert.equal(await read(p.vault,'configHash()'),p.configHash);
  proofs.push({domain:p.domain,eid:p.eid,router:p.router,vault:p.vault,factory,configHash:p.configHash,targetRaw:g.target.toString(),verifiedAt:new Date().toISOString()});
 }return proofs;
}
