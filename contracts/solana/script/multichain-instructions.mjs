// Separate NBFG v2 identities; never applies these instructions to the historical v1 pair.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(process.env.NABUNGFI_LZ_PACKAGE_JSON||new URL('../package.json',import.meta.url));
const web3=require('@solana/web3.js');
const sdk=require('@layerzerolabs/lz-solana-sdk-v2').UMI;
export const CORE_V2='FWfjDER6zJbP227GymMqTwGveJ5fjw7nKJvwLEAbXsZn';
export const TRANSPORT_V2='G2R7kB4yiYKB8Z6sF8f34w79Lof4L5oqqMhumiTzrG3d';
export const STORE_V2='v4GPUZ7BbKvpzyrtTBXYsASXcDKiC4TZppZaRSeudrp';
export const USDC_V2='4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const ENDPOINT_V2='76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6';
export const EIDS_V2={2:40245,3:40231,4:40161};
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',SYSTEM='11111111111111111111111111111111';
const key=a=>new web3.PublicKey(a),bytes=a=>key(a).toBuffer();
const evm=a=>{assert(/^0x[0-9a-fA-F]{40}$/.test(a)&&BigInt(a)>0n);return Buffer.concat([Buffer.alloc(12),Buffer.from(a.slice(2),'hex')]);};
const u32=(n,endian='LE')=>{const b=Buffer.alloc(4);b[`writeUInt32${endian}`](n);return b;};
const u64=(n,endian='LE')=>{assert(BigInt(n)>=0n&&BigInt(n)<=0xffffffffffffffffn);const b=Buffer.alloc(8);b[`writeBigUInt64${endian}`](BigInt(n));return b;};
const discriminator=n=>createHash('sha256').update(`global:${n}`).digest().subarray(0,8);
const meta=(a,w=false,s=false)=>({pubkey:key(a),isWritable:w,isSigner:s});
const ix=(program,name,accounts,...data)=>new web3.TransactionInstruction({programId:key(program),keys:accounts,data:Buffer.concat([discriminator(name),...data])});
export const peerV2=domain=>{assert(EIDS_V2[domain]);return web3.PublicKey.findProgramAddressSync([Buffer.from('Peer'),bytes(STORE_V2),u32(EIDS_V2[domain],'BE')],key(TRANSPORT_V2))[0].toBase58();};
export function multichainGoal({owner,goalId,target,participants}){
  assert(/^0x[0-9a-fA-F]{64}$/.test(goalId));assert(BigInt(target)>0n);assert(participants.length>=1&&participants.length<=3);
  const id=Buffer.from(goalId.slice(2),'hex');assert(id.some(b=>b));
  const [goal,bump]=web3.PublicKey.findProgramAddressSync([Buffer.from('goal'),bytes(owner),id],key(CORE_V2));
  const cash=web3.PublicKey.findProgramAddressSync([Buffer.from('usdc'),goal.toBuffer()],key(CORE_V2))[0].toBase58();
  let last=1;
  const pairs=participants.map(p=>{assert(p.domain>last&&EIDS_V2[p.domain]===p.eid);last=p.domain;
    const preimage=Buffer.concat([Buffer.from('NABUNGFI_MULTICHAIN_CONFIG_V2'),bytes(CORE_V2),goal.toBuffer(),bytes(owner),id,u64(target),u32(p.domain),u32(p.eid),bytes(USDC_V2),evm(p.asset),evm(p.router),evm(p.vault),evm(p.owner),bytes(TRANSPORT_V2)]);
    return {...p,configHash:`0x${createHash('sha256').update(preimage).digest('hex')}`,peer:peerV2(p.domain)};
  });return {owner,goalId,id,target:BigInt(target),goal:goal.toBase58(),cash,bump,participants:pairs};
}
export function multichainGoalFromEnvironment(environment,solanaOwner){
  const required=name=>{assert(environment[name],`Missing ${name}`);return environment[name];};
  const prefix={2:'BASE_SEPOLIA',3:'ARBITRUM_SEPOLIA',4:'ETHEREUM_SEPOLIA'};
  const domains=(environment.MULTI_PARTICIPANT_DOMAINS||'2,3,4').split(',').map(Number);
  const participants=domains.map(domain=>{assert(prefix[domain]);const p=prefix[domain];return{domain,eid:EIDS_V2[domain],asset:required(`${p}_USDC`),router:required(`MULTI_${p}_ROUTER`),vault:required(`MULTI_${p}_GOAL_VAULT`),owner:environment[`MULTI_${p}_OWNER`]||required('DEPLOYER_ADDRESS')};});
  return multichainGoal({owner:solanaOwner,goalId:required('MULTI_GOAL_ID'),target:required('MULTI_GOAL_TARGET_RAW'),participants});
}
export const initializeGoalV2=g=>ix(CORE_V2,'initialize',[meta(g.owner,true,true),meta(g.goal,true),meta(USDC_V2),meta(g.cash,true),meta(TOKEN),meta(SYSTEM)],g.id,u64(g.target),u32(g.participants.length),...g.participants.map(p=>Buffer.concat([u32(p.domain),u32(p.eid),evm(p.asset),evm(p.router),evm(p.vault),evm(p.owner)])));
export const depositV2=(g,source,amount)=>ix(CORE_V2,'deposit',[meta(g.owner,false,true),meta(g.goal,true),meta(USDC_V2),meta(source,true),meta(g.cash,true),meta(TOKEN)],u64(amount));
export const ownerActionV2=(g,action)=>{assert(['begin_prepare','begin_abort'].includes(action));return ix(CORE_V2,action,[meta(g.owner,false,true),meta(g.goal,true)]);};
export const balanceActionV2=(g,action)=>{assert(['mark_local_ready','achieve'].includes(action));return ix(CORE_V2,action,[meta(g.goal,true),meta(g.cash)]);};
export const claimV2=(g,destination,amount)=>ix(CORE_V2,'claim',[meta(g.owner,false,true),meta(g.goal,true),meta(USDC_V2),meta(g.cash,true),meta(destination,true),meta(TOKEN)],u64(amount));
export function initializeTransportV2(payer,programData){
  const endpoint=new sdk.EndpointProgram.Endpoint(ENDPOINT_V2);
  const types=web3.PublicKey.findProgramAddressSync([Buffer.from('LzReceiveTypes'),bytes(STORE_V2)],key(TRANSPORT_V2))[0].toBase58();
  return ix(TRANSPORT_V2,'initialize',[meta(payer,true,true),meta(TRANSPORT_V2),meta(programData),meta(STORE_V2,true),meta(types,true),meta(SYSTEM),meta(ENDPOINT_V2),meta(payer,true,true),meta(STORE_V2),meta(endpoint.pda.oappRegistry(STORE_V2)[0],true),meta(SYSTEM),meta(endpoint.eventAuthority),meta(ENDPOINT_V2)]);
}
export const initializePeerV2=(payer,p)=>{assert(EIDS_V2[p.domain]===p.eid);return ix(TRANSPORT_V2,'initialize_peer',[meta(payer,true,true),meta(STORE_V2,true),meta(peerV2(p.domain),true),meta(SYSTEM)],u32(p.domain),u32(p.eid),evm(p.router));};
export const sealTransportV2=payer=>{const endpoint=new sdk.EndpointProgram.Endpoint(ENDPOINT_V2);return ix(TRANSPORT_V2,'seal_route',[meta(payer,false,true),meta(STORE_V2,true),...endpoint.getSetDelegateIxAccountMetaForCPI(STORE_V2).map(m=>meta(m.pubkey,m.isWritable,false))]);};
export function transportQuoteV2(g,domain,sequence,options,endpointAccounts){const p=g.participants.find(p=>p.domain===domain);assert(p);return ix(TRANSPORT_V2,'quote',[meta(STORE_V2),meta(p.peer),meta(g.goal),...endpointAccounts.map(m=>meta(m.pubkey,m.isWritable,false))],u32(domain),u64(sequence),u32(options.length),Buffer.from(options));}
export function transportSendV2(g,payer,domain,sequence,fee,options,endpointAccounts){const p=g.participants.find(p=>p.domain===domain);assert(p);return ix(TRANSPORT_V2,'send',[meta(payer,false,true),meta(STORE_V2),meta(p.peer),meta(g.goal),...endpointAccounts.map(m=>meta(m.pubkey,m.isWritable,m.isSigner&&m.pubkey===payer))],u32(domain),u64(sequence),u64(fee),u32(options.length),Buffer.from(options));}
export function decodeMultichainGoal(raw){
  const b=Buffer.from(raw);assert(b.subarray(0,8).equals(createHash('sha256').update('account:Goal').digest().subarray(0,8)));let offset=8;
  const take=n=>{const value=b.subarray(offset,offset+n);assert.equal(value.length,n);offset+=n;return value;};const number=()=>take(8).readBigUInt64LE();const address=()=>`0x${take(32).toString('hex')}`;
  const g={owner:new web3.PublicKey(take(32)).toBase58(),goalId:address(),target:number()};for(const name of ['principal','claimed','round','outboundSequence','localReserved','localReadySlot','achievedTotal'])g[name]=number();
  g.localReady=take(1)[0]===1;g.phase=take(1)[0];g.bump=take(1)[0];const count=take(4).readUInt32LE();assert(count>=1&&count<=3);g.participants=[];
  for(let i=0;i<count;i++){const p={domain:take(4).readUInt32LE(),eid:take(4).readUInt32LE(),asset:address(),router:address(),vault:address(),owner:address(),configHash:address(),linked:take(1)[0]===1};for(const name of ['netAssets','progressSequence','observation','observedAt','receivedAt','inboundSequence','reserved'])p[name]=number();p.ready=take(1)[0]===1;p.abortAck=take(1)[0]===1;g.participants.push(p);}
  assert(b.subarray(offset).every(n=>n===0),'Unexpected trailing Goal account data');return g;
}
export function packetV2(g,domain,{kind,round=0n,sequence=0n,amount=g.target,aggregate=0n,observation,observedAt}){
  const p=g.participants.find(p=>p.domain===domain);assert(p);assert(BigInt(observation)>0n&&BigInt(observedAt)>0n);
  return Buffer.concat([Buffer.from('NBFG'),Buffer.from([2,kind]),u32(domain,'BE'),u32(1,'BE'),g.id,Buffer.from(p.configHash.slice(2),'hex'),evm(p.vault),bytes(g.goal),evm(p.owner),...[round,sequence,amount,aggregate,observation,observedAt].map(n=>u64(n,'BE'))]);
}
