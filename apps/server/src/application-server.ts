import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {parseGoalTarget,type CreateGoalRequest,type GoalDTO,type GoalStepRequest,type SessionDTO,APP_NETWORKS,GOAL_TEMPLATES,isGoalModel} from '@nabungfi/shared/application';
import {rawAmount,type GoalBinding,type ChainPlan,type GoalChainState,type GoalStepInput,type ReconcileResult} from '@nabungfi/shared/chain';
import type {ApplicationRepository,GoalRecord} from './repository.js';
import {fingerprint} from './repository.js';
import type {Authentication} from './auth.js';
import {requireGoalWallets} from './auth.js';
import {ApiError,notFound} from './errors.js';
import type {AppConfig} from './config.js';
import {boundedChainRead} from './server-runtime.js';
import type {ExpiredSolanaResolution} from './chain/expired-solana.js';
import {inFlightReads} from './in-flight-reads.js';
import {testnetGasPayment,assertGasEligibility} from './gas-policy.js';

export interface ChainServices {
 deriveGoalBinding(input:{goalId:string;targetRaw:string;owner:{solana:string;evm:string};networks:typeof APP_NETWORKS[number][]}):GoalBinding;
 readGoalState(binding:GoalBinding):Promise<GoalChainState>;
 planGoalStep(binding:GoalBinding,input:GoalStepInput):Promise<ChainPlan>;
 assertPlanUsable(binding:GoalBinding,plan:ChainPlan):Promise<void>;
 reconcileGoalStep(binding:GoalBinding,plan:ChainPlan,hash:string):Promise<ReconcileResult>;
 resolveExpiredSolanaPlan?(binding:GoalBinding,plan:ChainPlan):Promise<ExpiredSolanaResolution>;
}
export interface CoordinationStatus { configured:boolean;available:boolean;capacity:number;registered:number;reasonCode?:string }
export interface ApplicationRuntime { coordinationStatus():Promise<CoordinationStatus>;assertCoordinationAdmission(binding:GoalBinding):Promise<void> }
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function body(req:IncomingMessage):Promise<Record<string,unknown>>{
 if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError('JSON_REQUIRED',415,'Send a JSON request.');
 let length=0;const chunks:Buffer[]=[];for await(const chunk of req){const b=Buffer.from(chunk);length+=b.length;if(length>16384)throw new ApiError('REQUEST_TOO_LARGE',413,'The request is too large.');chunks.push(b);}
 try{const v=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw new Error();return v;}catch{throw new ApiError('INVALID_JSON',400,'Send a valid JSON object.');}
}
function fields(v:Record<string,unknown>,allowed:string[]){if(Object.keys(v).some(k=>!allowed.includes(k)))throw new ApiError('INVALID_INPUT',400,'The request contains unsupported fields.');}
function requestId(v:unknown):string{if(!uuid(v))throw new ApiError('REQUEST_ID_REQUIRED',400,'Use a UUID request ID.');return v;}
function createInput(v:Record<string,unknown>):CreateGoalRequest {
 fields(v,['name','targetAmount','model','solanaOwner','evmOwner','chains']);
 if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>100||!isGoalModel(v.model)||typeof v.solanaOwner!=='string'||typeof v.evmOwner!=='string')throw new ApiError('INVALID_GOAL',400,'Enter a name, model and linked owner wallets.');
 if(!Array.isArray(v.chains)||v.chains.length<2||v.chains.length>4||!v.chains.includes('solana')||new Set(v.chains).size!==v.chains.length||v.chains.some(c=>!APP_NETWORKS.includes(c)))throw new ApiError('INVALID_CHAINS',400,'Choose Solana and at least one supported EVM chain.');
 try{parseGoalTarget(v.targetAmount);}catch{throw new ApiError('INVALID_TARGET',400,'Enter a positive USDC target with at most six decimals.');}
 return {name:v.name.trim(),targetAmount:v.targetAmount as string,model:v.model as CreateGoalRequest['model'],solanaOwner:v.solanaOwner,evmOwner:v.evmOwner.toLowerCase(),chains:APP_NETWORKS.filter(c=>(v.chains as unknown[]).includes(c))};
}
function stepInput(v:Record<string,unknown>):GoalStepRequest {
 fields(v,['requestId','action','network','amountRaw']);requestId(v.requestId);
 if(!['create-vault','initialize','approve','deposit','prepare','abort','claim'].includes(String(v.action))||!APP_NETWORKS.includes(v.network as typeof APP_NETWORKS[number]))throw new ApiError('INVALID_STEP',400,'Choose a supported action and chain.');
 const money=['approve','deposit','claim'].includes(String(v.action));if(money){try{rawAmount(v.amountRaw);}catch{throw new ApiError('INVALID_AMOUNT',400,'Use a positive exact USDC base-unit amount.');}}else if(v.amountRaw!==undefined)throw new ApiError('INVALID_AMOUNT',400,'This action does not accept an amount.');
 return {requestId:v.requestId as string,action:v.action as GoalStepRequest['action'],network:v.network as GoalStepRequest['network'],...(money?{amountRaw:v.amountRaw as string}:{})};
}
async function viewGoal(r:GoalRecord,chain:ChainServices):Promise<GoalDTO>{
 const dto:GoalDTO={id:r.id,goalId:r.goalId,name:r.name,model:r.model,targetRaw:r.targetRaw,createdAt:r.createdAt,updatedAt:r.updatedAt,binding:r.binding,chainState:null,chainStatus:'unprovisioned'};
 try{dto.chainState=await chain.readGoalState(r.binding);dto.chainStatus=dto.chainState.phase==='unprovisioned'?'unprovisioned':'available';}catch{dto.chainStatus='unavailable';}return dto;
}
function metadataGoal(r:GoalRecord):GoalDTO{return{id:r.id,goalId:r.goalId,name:r.name,model:r.model,targetRaw:r.targetRaw,createdAt:r.createdAt,updatedAt:r.updatedAt,binding:r.binding,chainState:null,chainStatus:'unavailable'};}
function respond(res:ServerResponse,status:number,value:unknown){if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
export function applicationServer(config:AppConfig,repo:ApplicationRepository,auth:Authentication,chain:ChainServices,runtime?:ApplicationRuntime){
 const requests=new Map<string,{count:number;reset:number}>();
 const readDetail=inFlightReads<GoalDTO>();
 const server=createServer(async(req,res)=>{const correlation=randomUUID();try{
  const origin=req.headers.origin;if(origin&&!config.origins.includes(origin))throw new ApiError('ORIGIN_REJECTED',403,'This origin is not allowed.');
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Idempotency-Key, X-NabungFi-Plan-Version');}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const path=new URL(req.url??'/','http://localhost').pathname;
  if(req.method==='GET'&&path==='/api/health')return respond(res,200,{ok:true,mode:'testnet-app',financialAuthority:'contracts'});
  if(req.method==='GET'&&path==='/api/config'){
   let coordination:CoordinationStatus={configured:false,available:false,capacity:0,registered:0,reasonCode:'OPERATOR_NOT_CONFIGURED'};
   if(runtime)try{const status=await runtime.coordinationStatus();coordination={configured:status.configured===true,available:status.available===true,capacity:Number.isInteger(status.capacity)&&status.capacity>=0?status.capacity:0,registered:Number.isInteger(status.registered)&&status.registered>=0?status.registered:0,...(status.reasonCode&&/^[A-Z_]{1,80}$/.test(status.reasonCode)?{reasonCode:status.reasonCode}:{})};}catch{coordination={configured:true,available:false,capacity:0,registered:0,reasonCode:'OPERATOR_UNAVAILABLE'};}
   return respond(res,200,{profile:'testnet',privyAppId:config.privyAppId,chains:APP_NETWORKS,goalModels:GOAL_TEMPLATES.map(template=>template.id),gasSponsorship:config.testnetGasSponsorship===true?'privy-testnet':null,coordinationAvailable:coordination.available,coordination});
  }
  const ip=req.socket.remoteAddress??'unknown',now=Date.now(),limit=requests.get(ip);if(limit&&limit.reset>now){if(++limit.count>180)throw new ApiError('RATE_LIMITED',429,'Please wait before making more requests.');}else requests.set(ip,{count:1,reset:now+60000});if(requests.size>10000)for(const[k,v]of requests)if(v.reset<now)requests.delete(k);
  const identity=await auth.authenticate(req.headers.authorization);const user=await repo.user(identity.subject);
  // Old installed PWA clients send direct transactions and must never receive a bundler-only plan.
  const clientSponsorship=config.testnetGasSponsorship===true&&req.headers['x-nabungfi-plan-version']==='gas-v1';
  if(req.method==='GET'&&path==='/api/session'){const session:SessionDTO={user:{id:user.id,privySubject:identity.subject,wallets:identity.wallets},profile:'testnet',privyAppId:config.privyAppId,chains:[...APP_NETWORKS]};return respond(res,200,session);}
  if(req.method==='GET'&&path==='/api/goals'){const goals=await repo.goals(user.id);return respond(res,200,{goals:goals.map(metadataGoal),financialReads:'detail-only'});}
  if(req.method==='POST'&&path==='/api/goals'){
   const id=requestId(req.headers['idempotency-key']),input=createInput(await body(req));const owners={solana:input.solanaOwner,evm:input.evmOwner};requireGoalWallets(identity,owners);
   const targetRaw=parseGoalTarget(input.targetAmount),binding=chain.deriveGoalBinding({goalId:'0x'+randomBytes(32).toString('hex'),targetRaw,owner:owners,networks:input.chains});
   const g=await repo.createGoal(user.id,{name:input.name,model:input.model,targetRaw,binding,requestId:id,fingerprint:fingerprint({name:input.name,model:input.model,targetRaw,owner:owners,chains:input.chains})});return respond(res,201,{goal:metadataGoal(g)});
  }
  const match=path.match(/^\/api\/goals\/([0-9a-f-]+)(?:\/(history|steps)(?:\/([0-9a-f-]+)(?:\/(reconcile|refresh|wallet-start|wallet-rejected|wallet-not-invoked|cancel-unsigned|resolve-expired-solana))?)?)?$/i);if(!match||!uuid(match[1]))throw notFound();
  const gid=match[1],g=await repo.goal(user.id,gid);if(!match[2]&&req.method==='GET')return respond(res,200,{goal:await readDetail(fingerprint({owner:user.id,id:gid,binding:g.binding}),()=>boundedChainRead(()=>viewGoal(g,chain)))});
  if(match[2]==='history'&&req.method==='GET'){const history=await repo.history(user.id,gid);return respond(res,200,{history,entries:history});}
  if(match[2]==='steps'&&req.method==='GET'&&uuid(match[3])&&!match[4])return respond(res,200,{step:await repo.step(user.id,gid,match[3])});
  if(match[2]==='steps'&&req.method==='POST'&&!match[3]){
   requireGoalWallets(identity,g.binding.owner);const input=stepInput(await body(req));const result=await repo.reserveStep(user.id,gid,input);if(!result.isNew)return respond(res,200,{step:result.step});
   let admitted=false;try{
    const plan=await boundedChainRead(()=>chain.planGoalStep(g.binding,{id:result.step.id,action:input.action,network:input.network,...(testnetGasPayment(clientSponsorship,identity,g.binding,input.network)?{gasPayment:testnetGasPayment(clientSponsorship,identity,g.binding,input.network)}:{}),...(input.amountRaw?{amountRaw:input.amountRaw}:{})}));
    if(input.action==='create-vault'&&runtime){await runtime.assertCoordinationAdmission(g.binding);admitted=true;}
    return respond(res,201,{step:await repo.savePlan(user.id,gid,result.step.id,plan,admitted)});
   }catch(error){const reason=typeof(error as {code?:unknown}).code==='string'?(error as {code:string}).code:'CHAIN_PLAN_UNAVAILABLE';await repo.planFailed(user.id,gid,result.step.id,reason);if(admitted)try{await repo.releaseUnusedCoordinationAdmission(g.goalId);}catch{/* Ambiguous DB state retains the slot. */}if(error instanceof ApiError)throw error;throw new ApiError(reason,409,'The chain could not prepare this step. Refresh its original status before retrying.');}
  }
  if(match[2]==='steps'&&req.method==='POST'&&uuid(match[3])&&match[4]==='resolve-expired-solana'){
   requireGoalWallets(identity,g.binding.owner);const v=await body(req);fields(v,['fingerprint']);const prior=await repo.step(user.id,gid,match[3]);
   if(prior.status==='failed'&&!prior.transactionHash&&prior.reasonCode==='EXPIRED_SOLANA_MESSAGE_NOT_EXECUTED'&&prior.plan?.fingerprint===v.fingerprint)return respond(res,200,{step:prior});
   if(prior.network!=='solana'||prior.status!=='signing'||prior.transactionHash||!prior.plan||prior.plan.fingerprint!==v.fingerprint)throw new ApiError('ORIGINAL_TRANSACTION_REQUIRED',409,'Reconcile the original attempted wallet transaction.');
   if(!chain.resolveExpiredSolanaPlan)throw new ApiError('RECOVERY_UNAVAILABLE',503,'Keep the original request until finalized history can be checked.');
   let result:ExpiredSolanaResolution;try{result=await boundedChainRead(()=>chain.resolveExpiredSolanaPlan!(g.binding,prior.plan!));}catch(error){if(error instanceof ApiError)throw error;const code=(error as {code?:string}).code;throw new ApiError(code&&/^[A-Z_]{1,80}$/.test(code)?code:'ORIGINAL_HISTORY_UNAVAILABLE',code==='ORIGINAL_STILL_LIVE'||code==='ORIGINAL_HISTORY_LIMIT'?409:503,'The original message could not be proven expired without execution. Keep this request and its original signature.');}
   if(result.kind==='located')return respond(res,200,{step:prior,transactionHash:result.transactionHash});
   return respond(res,200,{step:await repo.expireUntrackedSolana(user.id,gid,prior.id,prior.plan.fingerprint,result.proof)});
  }
  if(match[2]==='steps'&&req.method==='POST'&&uuid(match[3])&&match[4]==='cancel-unsigned'){
   requireGoalWallets(identity,g.binding.owner);const v=await body(req);fields(v,['fingerprint']);if(typeof v.fingerprint!=='string'||!v.fingerprint||v.fingerprint.length>200)throw new ApiError('INVALID_FINGERPRINT',400,'Use the original unsigned plan fingerprint.');
   return respond(res,200,{step:await repo.cancelUnsignedPlan(user.id,gid,match[3],v.fingerprint)});
  }
  if(match[2]==='steps'&&req.method==='POST'&&uuid(match[3])&&match[4]==='wallet-not-invoked'){
   requireGoalWallets(identity,g.binding.owner);const v=await body(req);fields(v,['fingerprint','attestation']);if(typeof v.fingerprint!=='string'||!v.fingerprint||v.fingerprint.length>200||!['wallet-sdk-never-invoked','wallet-approval-never-invoked'].includes(String(v.attestation)))throw new ApiError('EXPLICIT_NOT_INVOKED_ATTESTATION_REQUIRED',400,'Attest only that no wallet approval or signing call was invoked for this original plan.');
   return respond(res,200,{step:await repo.walletNotInvoked(user.id,gid,match[3],v.fingerprint)});
  }
  if(match[2]==='steps'&&req.method==='POST'&&uuid(match[3])&&match[4]==='wallet-rejected'){
   requireGoalWallets(identity,g.binding.owner);const v=await body(req);fields(v,['fingerprint','providerCode']);if(typeof v.fingerprint!=='string'||!v.fingerprint||v.fingerprint.length>200||v.providerCode!==4001)throw new ApiError('EXPLICIT_WALLET_REJECTION_REQUIRED',400,'Attest only a direct numeric wallet-provider 4001 rejection of this original plan.');
   return respond(res,200,{step:await repo.walletRejected(user.id,gid,match[3],v.fingerprint,v.providerCode)});
  }
  if(match[2]==='steps'&&req.method==='POST'&&uuid(match[3])&&['refresh','wallet-start'].includes(match[4]??'')){
   requireGoalWallets(identity,g.binding.owner);const v=await body(req);fields(v,['fingerprint']);if(typeof v.fingerprint!=='string'||!v.fingerprint||v.fingerprint.length>200)throw new ApiError('INVALID_FINGERPRINT',400,'Use the original transaction plan fingerprint.');
   if(match[4]==='wallet-start'){
    const original=await repo.step(user.id,gid,match[3]);if(original.status!=='planned'||original.transactionHash||!original.plan||original.plan.fingerprint!==v.fingerprint)throw new ApiError('WALLET_START_REJECTED',409,'Refresh an unsigned expired plan or reconcile the original wallet outcome.');
    assertGasEligibility(clientSponsorship,identity,g.binding,original.plan);
    if(original.action==='create-vault'&&runtime)await runtime.assertCoordinationAdmission(g.binding);
    try{await boundedChainRead(()=>chain.assertPlanUsable(g.binding,original.plan!));}catch(error){if(error instanceof ApiError)throw error;const code=(error as{code?:string}).code;throw new ApiError(code&&/^[A-Z_]{1,80}$/.test(code)?code:'CHAIN_PLAN_UNAVAILABLE',409,'The original plan is unusable or could not be checked. Refresh only an unsigned plan; no wallet action was started.');}
    return respond(res,200,{step:await repo.walletStart(user.id,gid,match[3],v.fingerprint)});
   }
   const prior=await repo.step(user.id,gid,match[3]);if(prior.status!=='planned'||prior.transactionHash||!prior.plan||prior.plan.fingerprint!==v.fingerprint)throw new ApiError('STEP_NOT_UNSIGNED',409,'Reconcile the original wallet outcome before another plan can be made.');
   const plan=await boundedChainRead(()=>chain.planGoalStep(g.binding,{id:prior.id,action:prior.action,network:prior.network,...(testnetGasPayment(clientSponsorship,identity,g.binding,prior.network)?{gasPayment:testnetGasPayment(clientSponsorship,identity,g.binding,prior.network)}:{}),...(prior.amountRaw?{amountRaw:prior.amountRaw}:{})}));if(prior.action==='create-vault'&&runtime)await runtime.assertCoordinationAdmission(g.binding);return respond(res,200,{step:await repo.refreshPlan(user.id,gid,prior.id,v.fingerprint,plan)});
  }
  if(match[2]==='steps'&&req.method==='POST'&&uuid(match[3])&&match[4]==='reconcile'){
   requireGoalWallets(identity,g.binding.owner);const v=await body(req);fields(v,['transactionHash']);const prior=await repo.step(user.id,gid,match[3]);const h=v.transactionHash;
   if(typeof h!=='string'||!(prior.network==='solana'?/^[1-9A-HJ-NP-Za-km-z]{70,100}$/:/^0x[0-9a-f]{64}$/i).test(h))throw new ApiError('INVALID_TRANSACTION_HASH',400,'Provide the original transaction hash.');
   const hash=prior.network==='solana'?h:h.toLowerCase();if(prior.transactionHash&&prior.transactionHash!==hash)throw new ApiError('ORIGINAL_TRANSACTION_REQUIRED',409,'Reconcile the original transaction hash.');if(!prior.plan)throw new ApiError('STEP_NOT_PLANNED',409,'This action has no original plan.');if(prior.status==='confirmed'||prior.status==='failed'||prior.status==='rejected')return respond(res,200,{step:prior});
   let result:ReconcileResult;
   try{result=await boundedChainRead(()=>chain.reconcileGoalStep(g.binding,prior.plan!,hash));}catch(error){if(error instanceof ApiError)throw error;const code=(error as{code?:string}).code;if(code&&code!=='CHAIN_UNAVAILABLE')throw new ApiError('RECEIPT_REJECTED',400,'The supplied receipt could not prove this action. No new transaction hash was bound.');result={status:'attention',transactionHash:hash,reasonCode:'CHAIN_UNAVAILABLE'};}
   const disproven=new Set(['TRANSACTION_SUBSTITUTION','WRONG_RECEIPT_HASH','WRONG_CREATION_EVENT','WRONG_CONFIGURATION','TOKEN_CONSERVATION','WRONG_GOAL','WRONG_PEER','WRONG_CHAIN','PLAN_SUBSTITUTION','WRONG_TRANSACTION_TYPE','INVALID_RECEIPT_STATUS','WRONG_MESSAGE','RECEIPT_TOO_OLD','RECEIPT_PRECEDES_PLAN','WRONG_INITIALIZED_GOAL']);
   if(result.status==='attention'&&result.reasonCode&&disproven.has(result.reasonCode)&&!prior.transactionHash)throw new ApiError('RECEIPT_REJECTED',400,'The supplied receipt belongs to a different or invalid action. No transaction hash was bound.');
   await repo.bindTransaction(user.id,gid,prior.id,hash);return respond(res,200,{step:await repo.reconciled(user.id,gid,prior.id,result)});
  }
  throw notFound();
 }catch(error){if(error instanceof ApiError)return respond(res,error.status,{code:error.code,error:error.message,requestId:correlation});console.error(JSON.stringify({event:'application-request-failed',requestId:correlation}));respond(res,500,{code:'SERVICE_UNAVAILABLE',error:'The request could not be completed. Reconcile the same operation before retrying.',requestId:correlation});}});
 server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;server.setTimeout(30000,socket=>socket.destroy());return server;
}
