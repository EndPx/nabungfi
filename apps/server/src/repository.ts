import { randomUUID, createHash } from 'node:crypto';
import type { GoalBinding, ChainPlan, ReconcileResult } from '@nabungfi/shared/chain';
import type { GoalDTO, GoalModel, GoalStepDTO, GoalStepRequest, GoalHistoryEntry } from '@nabungfi/shared/application';
import type { Database, Row } from './database.js';
import { ApiError, notFound } from './errors.js';

export interface GoalRecord { id:string; ownerId:string; goalId:string; name:string; model:GoalModel; targetRaw:string; binding:GoalBinding; createdAt:string; updatedAt:string }
export interface NewGoal { name:string;model:GoalModel;targetRaw:string;binding:GoalBinding;requestId:string;fingerprint:string }
export interface ApplicationRepository {
 user(subject:string):Promise<{id:string}>;
 createGoal(ownerId:string,input:NewGoal):Promise<GoalRecord>;
 goals(ownerId:string):Promise<GoalRecord[]>;
 goal(ownerId:string,id:string):Promise<GoalRecord>;
 reserveStep(ownerId:string,goalId:string,input:GoalStepRequest):Promise<{step:GoalStepDTO;isNew:boolean}>;
 step(ownerId:string,goalId:string,id:string):Promise<GoalStepDTO>;
 savePlan(ownerId:string,goalId:string,id:string,plan:ChainPlan,admissionRequired?:boolean):Promise<GoalStepDTO>;
 refreshPlan(ownerId:string,goalId:string,id:string,oldFingerprint:string,plan:ChainPlan):Promise<GoalStepDTO>;
 walletStart(ownerId:string,goalId:string,id:string,planFingerprint:string):Promise<GoalStepDTO>;
 walletRejected(ownerId:string,goalId:string,id:string,planFingerprint:string,providerCode:number):Promise<GoalStepDTO>;
 walletNotInvoked(ownerId:string,goalId:string,id:string,planFingerprint:string):Promise<GoalStepDTO>;
 expireUntrackedSolana(ownerId:string,goalId:string,id:string,planFingerprint:string,proof:Record<string,unknown>):Promise<GoalStepDTO>;
 planFailed(ownerId:string,goalId:string,id:string,reason:string):Promise<void>;
 bindTransaction(ownerId:string,goalId:string,id:string,hash:string):Promise<GoalStepDTO>;
 reconciled(ownerId:string,goalId:string,id:string,result:ReconcileResult):Promise<GoalStepDTO>;
 history(ownerId:string,goalId:string):Promise<GoalHistoryEntry[]>;
 listProvisionedGoalBindings():Promise<{metadataId:string;ownerId:string;binding:GoalBinding}[]>;
 listKeeperBindings():Promise<{metadataId:string;ownerId:string;binding:GoalBinding}[]>;
 reserveCoordinationAdmission(goalId:string,acceptedRegistryGoalIds:string[],capacity:number,completedIds?:string[]):Promise<{admitted:true;reserved:number;capacity:number}>;
 releaseUnusedCoordinationAdmission(goalId:string):Promise<boolean>;
}
const date=(v:unknown)=>new Date(v as string|Date).toISOString();
const goalRow=(r:Row):GoalRecord=>({id:String(r.id),ownerId:String(r.owner_id),goalId:String(r.goal_id),name:String(r.name),model:r.model as GoalModel,targetRaw:String(r.target_raw),binding:r.binding as GoalBinding,createdAt:date(r.created_at),updatedAt:date(r.updated_at)});
function stepRow(r:Row,goal:GoalRecord):GoalStepDTO {return {id:String(r.id),goalId:goal.goalId,metadataGoalId:goal.id,action:r.action as GoalStepDTO['action'],network:r.network as GoalStepDTO['network'],
 ...(r.amount_raw===null?{}:{amountRaw:String(r.amount_raw)}),status:r.status as GoalStepDTO['status'],plan:r.plan as ChainPlan|null,transactionHash:r.transaction_hash as string|null,createdAt:date(r.created_at),updatedAt:date(r.updated_at),...(r.reason_code?{reasonCode:String(r.reason_code)}:{})};}
export const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function conflict(){return new ApiError('IDEMPOTENCY_CONFLICT',409,'This request ID is already bound to a different operation.');}
function walletLaneBusy(){return new ApiError('ORIGINAL_WALLET_OUTCOME_REQUIRED',409,'Reconcile your original wallet action on this network before starting another, including another savings goal.');}
function applyPatch(binding:GoalBinding,patch:NonNullable<ReconcileResult['bindingPatch']>):GoalBinding {
 const next=structuredClone(binding);
 if('initialized'in patch){if(!next.participants.every(p=>p.vault&&p.configHash))throw new ApiError('BINDING_INCOMPLETE',409,'Participant receipts must be verified first.');next.initialized=true;}
 else {const p=next.participants.find(p=>p.network===patch.network);if(!p)throw conflict();if(p.vault&&(p.vault.toLowerCase()!==patch.vault.toLowerCase()||p.configHash!==patch.configHash))throw conflict();p.vault=patch.vault.toLowerCase();p.configHash=patch.configHash;p.creationHash=patch.creationHash;}
 return next;
}
export function postgresRepository(db:Database):ApplicationRepository {
 const goal=async(ownerId:string,id:string)=>{const q=await db.query('SELECT * FROM nabungfi.goals WHERE id=$1 AND owner_id=$2',[id,ownerId]);if(!q.rows[0])throw notFound();return goalRow(q.rows[0]);};
 const step=async(ownerId:string,goalId:string,id:string)=>{const g=await goal(ownerId,goalId);const q=await db.query('SELECT * FROM nabungfi.goal_steps WHERE id=$1 AND goal_id=$2 AND owner_id=$3',[id,goalId,ownerId]);if(!q.rows[0])throw notFound();return stepRow(q.rows[0],g);};
 const provisioned=async()=>{const q=await db.query("SELECT * FROM nabungfi.goals WHERE binding->>'initialized'='true'");return q.rows.map(goalRow).filter(g=>g.binding.participants.every(p=>p.vault&&p.configHash&&p.creationHash)).map(g=>({metadataId:g.id,ownerId:g.ownerId,binding:g.binding}));};
 return {
  async user(subject){const q=await db.query('INSERT INTO nabungfi.users(id,privy_subject) VALUES($1,$2) ON CONFLICT(privy_subject) DO UPDATE SET privy_subject=EXCLUDED.privy_subject RETURNING id',[randomUUID(),subject]);return{id:String(q.rows[0]?.id)};},
  async createGoal(ownerId,input){return db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',['goal-cap:'+ownerId]);
   const replay=await tx.query('SELECT * FROM nabungfi.goals WHERE owner_id=$1 AND create_request_id=$2',[ownerId,input.requestId]);if(replay.rows[0]){if(replay.rows[0].create_fingerprint!==input.fingerprint)throw conflict();return goalRow(replay.rows[0]);}
   const count=await tx.query('SELECT count(*)::integer AS count FROM nabungfi.goals WHERE owner_id=$1',[ownerId]);if(Number(count.rows[0]?.count)>=100)throw new ApiError('OWN_GOAL_CAPACITY',409,'This account already has 100 savings goals. Existing goals remain available.');
   const q=await tx.query('INSERT INTO nabungfi.goals(id,owner_id,goal_id,name,model,target_raw,binding,create_request_id,create_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner_id,create_request_id) DO NOTHING RETURNING *',
    [randomUUID(),ownerId,input.binding.goalId,input.name,input.model,input.targetRaw,JSON.stringify(input.binding),input.requestId,input.fingerprint]);
   if(q.rows[0])return goalRow(q.rows[0]);
   const existing=await tx.query('SELECT * FROM nabungfi.goals WHERE owner_id=$1 AND create_request_id=$2',[ownerId,input.requestId]);const r=existing.rows[0];if(!r||r.create_fingerprint!==input.fingerprint)throw conflict();return goalRow(r);
  });},
  async goals(ownerId){const q=await db.query('SELECT * FROM nabungfi.goals WHERE owner_id=$1 ORDER BY created_at DESC',[ownerId]);return q.rows.map(goalRow);},goal,step,
  async reserveStep(ownerId,goalId,input){const g=await goal(ownerId,goalId);const intent=fingerprint({goal:g.goalId,action:input.action,network:input.network,amountRaw:input.amountRaw??null});
   return db.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[ownerId+':'+input.network]);
    const prior=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE goal_id=$1 AND owner_id=$2 AND request_id=$3',[goalId,ownerId,input.requestId]);
    if(prior.rows[0]){if(prior.rows[0].intent_fingerprint!==intent)throw conflict();return{step:stepRow(prior.rows[0],g),isNew:false};}
    const active=await tx.query("SELECT id FROM nabungfi.goal_steps WHERE owner_id=$1 AND network=$2 AND plan IS NOT NULL AND status IN ('signing','submitted','pending','attention') LIMIT 1",[ownerId,input.network]);if(active.rows.length)throw walletLaneBusy();
    const q=await tx.query('INSERT INTO nabungfi.goal_steps(id,goal_id,owner_id,request_id,intent_fingerprint,action,network,amount_raw,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(goal_id,owner_id,request_id) DO NOTHING RETURNING *',
    [randomUUID(),goalId,ownerId,input.requestId,intent,input.action,input.network,input.amountRaw??null,'planning']);
    if(q.rows[0])return {step:stepRow(q.rows[0],g),isNew:true};
    const again=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE goal_id=$1 AND owner_id=$2 AND request_id=$3',[goalId,ownerId,input.requestId]);const row=again.rows[0];if(!row||row.intent_fingerprint!==intent)throw conflict();return{step:stepRow(row,g),isNew:false};});
  },
  async savePlan(ownerId,goalId,id,plan,admissionRequired=false){const g=await goal(ownerId,goalId);const prior=await step(ownerId,goalId,id);if(prior.status!=='planning')throw conflict();
   if(plan.id!==id||plan.goalId!==g.goalId||plan.action!==prior.action||plan.network!==prior.network||plan.amountRaw!==prior.amountRaw||plan.owner!==(plan.network==='solana'?g.binding.owner.solana:g.binding.owner.evm))throw new ApiError('PLAN_IDENTITY_MISMATCH',500,'The transaction plan did not match this step.');
   return db.transaction(async tx=>{
    if(admissionRequired){await tx.query("SELECT pg_advisory_xact_lock(hashtext('nabungfi_operator_admissions'))");const slot=await tx.query('SELECT goal_id FROM nabungfi.operator_admissions WHERE goal_id=$1 AND retired=false',[g.goalId]);if(!slot.rows.length)throw new ApiError('OPERATOR_ADMISSION_REQUIRED',503,'The provisioning plan has no active coordinator admission.');}
    const q=await tx.query("UPDATE nabungfi.goal_steps SET plan=$1,status='planned',updated_at=now() WHERE id=$2 AND goal_id=$3 AND owner_id=$4 AND status='planning' RETURNING *",[JSON.stringify(plan),id,goalId,ownerId]);if(!q.rows[0])throw conflict();return stepRow(q.rows[0],g);
   });
  },
  async planFailed(ownerId,goalId,id,reason){await db.query("UPDATE nabungfi.goal_steps SET status='attention',reason_code=$1,updated_at=now() WHERE id=$2 AND goal_id=$3 AND owner_id=$4 AND status='planning'",[reason,id,goalId,ownerId]);},
  async refreshPlan(ownerId,goalId,id,oldFingerprint,plan){const g=await goal(ownerId,goalId),prior=await step(ownerId,goalId,id);
   if(plan.id!==id||plan.goalId!==g.goalId||plan.action!==prior.action||plan.network!==prior.network||plan.amountRaw!==prior.amountRaw||plan.owner!==(plan.network==='solana'?g.binding.owner.solana:g.binding.owner.evm))throw conflict();
   const q=await db.query("UPDATE nabungfi.goal_steps SET plan=$1,updated_at=now() WHERE id=$2 AND goal_id=$3 AND owner_id=$4 AND status='planned' AND transaction_hash IS NULL AND plan->>'fingerprint'=$5 RETURNING *",[JSON.stringify(plan),id,goalId,ownerId,oldFingerprint]);
   if(!q.rows[0])throw new ApiError('STEP_NOT_UNSIGNED',409,'The original wallet outcome must be reconciled before another plan can be made.');return stepRow(q.rows[0],g);
  },
  async walletStart(ownerId,goalId,id,planFingerprint){const g=await goal(ownerId,goalId);try{
   const q=await db.query("UPDATE nabungfi.goal_steps SET status='signing',updated_at=now() WHERE id=$1 AND goal_id=$2 AND owner_id=$3 AND status='planned' AND transaction_hash IS NULL AND plan->>'fingerprint'=$4 AND (plan->>'expiresAt')::timestamptz>now() RETURNING *",[id,goalId,ownerId,planFingerprint]);
   if(!q.rows[0])throw new ApiError('WALLET_START_REJECTED',409,'Refresh an unsigned expired plan or reconcile the original wallet outcome.');return stepRow(q.rows[0],g);
   }catch(error){if((error as{constraint?:string}).constraint==='goal_steps_active_wallet_lane')throw walletLaneBusy();throw error;}
  },
  async bindTransaction(ownerId,goalId,id,hash){const g=await goal(ownerId,goalId);try{return await db.transaction(async tx=>{const q=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE id=$1 AND goal_id=$2 AND owner_id=$3 FOR UPDATE',[id,goalId,ownerId]);const r=q.rows[0];if(!r)throw notFound();if(!r.plan)throw new ApiError('STEP_NOT_PLANNED',409,'This step has no transaction plan.');if(r.transaction_hash&&r.transaction_hash!==hash)throw new ApiError('ORIGINAL_TRANSACTION_REQUIRED',409,'Reconcile the original transaction hash.');
    const duplicate=await tx.query('SELECT id FROM nabungfi.goal_steps WHERE owner_id=$1 AND network=$2 AND transaction_hash=$3 AND id<>$4',[ownerId,r.network,hash,id]);if(duplicate.rows.length)throw new ApiError('TRANSACTION_ALREADY_BOUND',409,'This transaction is already assigned to one of your actions.');
    const updated=await tx.query("UPDATE nabungfi.goal_steps SET transaction_hash=$1,status=CASE WHEN status IN ('confirmed','failed') THEN status ELSE 'submitted' END,updated_at=now() WHERE id=$2 RETURNING *",[hash,id]);return stepRow(updated.rows[0]!,g);});
   }catch(error){if((error as{constraint?:string}).constraint==='goal_steps_active_wallet_lane')throw walletLaneBusy();if((error as {code?:string}).code==='23505')throw new ApiError('TRANSACTION_ALREADY_BOUND',409,'This transaction is already assigned to a step.');throw error;}},
  async expireUntrackedSolana(ownerId,goalId,id,planFingerprint,proof){
   const g=await goal(ownerId,goalId);return db.transaction(async tx=>{
    const q=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE id=$1 AND goal_id=$2 AND owner_id=$3 FOR UPDATE',[id,goalId,ownerId]);const r=q.rows[0];if(!r)throw notFound();const original=r.plan as ChainPlan|null;
    if(r.transaction_hash||r.network!=='solana'||!original||original.fingerprint!==planFingerprint)throw new ApiError('ORIGINAL_TRANSACTION_REQUIRED',409,'Keep the original attempted transaction.');
    if(r.status==='failed'&&r.reason_code==='EXPIRED_SOLANA_MESSAGE_NOT_EXECUTED')return stepRow(r,g);
    if(r.status!=='signing'||proof.kind!=='finalized-expired-message-absence'||proof.planFingerprint!==planFingerprint||proof.historyCoveredBeforeCreation!==true)throw new ApiError('ORIGINAL_EXPIRY_NOT_PROVEN',409,'The original signing outcome is not proven expired.');
    const updated=await tx.query("UPDATE nabungfi.goal_steps SET status='failed',receipt=$1,reason_code='EXPIRED_SOLANA_MESSAGE_NOT_EXECUTED',updated_at=now() WHERE id=$2 RETURNING *",[JSON.stringify(proof),id]);return stepRow(updated.rows[0]!,g);
   });
  },
  async walletNotInvoked(ownerId,goalId,id,planFingerprint){
   const g=await goal(ownerId,goalId);return db.transaction(async tx=>{
    const q=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE id=$1 AND goal_id=$2 AND owner_id=$3 FOR UPDATE',[id,goalId,ownerId]);const r=q.rows[0];if(!r)throw notFound();
    const original=r.plan as ChainPlan|null;
    if(r.transaction_hash||!original||original.fingerprint!==planFingerprint)throw new ApiError('ORIGINAL_TRANSACTION_REQUIRED',409,'Reconcile any attempted wallet transaction using its original hash.');
    if(r.status==='rejected'&&(r.receipt as {kind?:string}|null)?.kind==='owner-attested-wallet-not-invoked')return stepRow(r,g);
    if(r.status!=='signing')throw new ApiError('WALLET_NOT_INVOKED_NOT_ALLOWED',409,'Only a signing marker whose wallet was never invoked can be closed by attestation.');
    const receipt={kind:'owner-attested-wallet-not-invoked',ownerId,stepId:id,planFingerprint,attestedAtUtc:new Date().toISOString(),onchainProof:false};
    const update=await tx.query("UPDATE nabungfi.goal_steps SET status='rejected',receipt=$1,reason_code='OWNER_ATTESTED_WALLET_NOT_INVOKED',updated_at=now() WHERE id=$2 RETURNING *",[JSON.stringify(receipt),id]);return stepRow(update.rows[0]!,g);
   });
  },
  async walletRejected(ownerId,goalId,id,planFingerprint,providerCode){
   if(providerCode!==4001)throw new ApiError('EXPLICIT_WALLET_REJECTION_REQUIRED',400,'Only a direct numeric wallet-provider 4001 rejection can be attested.');
   const g=await goal(ownerId,goalId);return db.transaction(async tx=>{
    const q=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE id=$1 AND goal_id=$2 AND owner_id=$3 FOR UPDATE',[id,goalId,ownerId]);const r=q.rows[0];if(!r)throw notFound();
    const original=r.plan as ChainPlan|null;if(r.transaction_hash||!original||original.fingerprint!==planFingerprint)throw new ApiError('ORIGINAL_TRANSACTION_REQUIRED',409,'An unknown or submitted wallet outcome must be reconciled using its original transaction.');
    if(r.status==='rejected'&&(r.receipt as{kind?:string;providerCode?:number}|null)?.kind==='owner-attested-wallet-rejection'&&(r.receipt as{providerCode?:number}).providerCode===4001)return stepRow(r,g);
    if(r.status!=='signing')throw new ApiError('WALLET_REJECTION_NOT_ALLOWED',409,'Only an explicitly rejected signing request with no transaction hash can be closed.');
    const receipt={kind:'owner-attested-wallet-rejection',providerCode:4001,ownerId,stepId:id,planFingerprint,attestedAtUtc:new Date().toISOString(),onchainProof:false};
    const update=await tx.query("UPDATE nabungfi.goal_steps SET status='rejected',receipt=$1,reason_code='OWNER_ATTESTED_PROVIDER_4001',updated_at=now() WHERE id=$2 RETURNING *",[JSON.stringify(receipt),id]);return stepRow(update.rows[0]!,g);
   });
  },
  async reconciled(ownerId,goalId,id,result){try{return await db.transaction(async tx=>{const q=await tx.query('SELECT * FROM nabungfi.goal_steps WHERE id=$1 AND goal_id=$2 AND owner_id=$3 FOR UPDATE',[id,goalId,ownerId]);const r=q.rows[0];if(!r)throw notFound();const goals=await tx.query('SELECT * FROM nabungfi.goals WHERE id=$1 AND owner_id=$2 FOR UPDATE',[goalId,ownerId]);const g=goalRow(goals.rows[0]!);if(r.transaction_hash!==result.transactionHash)throw conflict();if(r.status==='confirmed'||r.status==='failed')return stepRow(r,g);
    if(result.status==='confirmed'&&result.bindingPatch){g.binding=applyPatch(g.binding,result.bindingPatch);await tx.query('UPDATE nabungfi.goals SET binding=$1,updated_at=now() WHERE id=$2 AND owner_id=$3',[JSON.stringify(g.binding),goalId,ownerId]);}
    const update=await tx.query('UPDATE nabungfi.goal_steps SET status=$1,receipt=$2,reason_code=$3,updated_at=now() WHERE id=$4 RETURNING *',[result.status,result.receipt?JSON.stringify(result.receipt):null,result.reasonCode??null,id]);return stepRow(update.rows[0]!,g);});}catch(error){if((error as{constraint?:string}).constraint==='goal_steps_verified_transaction')throw new ApiError('TRANSACTION_ALREADY_VERIFIED',409,'This receipt has already verified another action.');throw error;}},
  async history(ownerId,goalId){const g=await goal(ownerId,goalId);const q=await db.query('SELECT * FROM nabungfi.goal_steps WHERE owner_id=$1 AND goal_id=$2 ORDER BY created_at DESC LIMIT 200',[ownerId,goalId]);return q.rows.map(r=>{const s=stepRow(r,g);return {id:s.id,goalId:s.goalId,action:s.action,network:s.network,...(s.amountRaw?{amountRaw:s.amountRaw}:{}),status:s.status,transactionHash:s.transactionHash,createdAt:s.createdAt,updatedAt:s.updatedAt};});},
  listProvisionedGoalBindings:provisioned,listKeeperBindings:provisioned,
  async reserveCoordinationAdmission(goalId,acceptedRegistryGoalIds,capacity,completedIds=[]){
   if(!/^0x[0-9a-f]{64}$/.test(goalId)||!Number.isInteger(capacity)||capacity<1||capacity>6||acceptedRegistryGoalIds.length>500||completedIds.length>500||acceptedRegistryGoalIds.some(id=>!/^0x[0-9a-f]{64}$/.test(id))||completedIds.some(id=>!acceptedRegistryGoalIds.includes(id)))throw new ApiError('INVALID_ADMISSION',500,'Operator admission configuration is invalid.');
   return db.transaction(async tx=>{
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('nabungfi_operator_admissions'))");
    const goal=await tx.query('SELECT goal_id FROM nabungfi.goals WHERE goal_id=$1',[goalId]);if(!goal.rows.length)throw notFound();
    await tx.query('UPDATE nabungfi.operator_admissions SET retired=true WHERE goal_id=ANY($1::text[])',[completedIds]);
    const existing=await tx.query('SELECT goal_id,retired FROM nabungfi.operator_admissions WHERE goal_id=$1',[goalId]);
    const union=await tx.query('SELECT count(*)::integer AS count FROM (SELECT goal_id FROM nabungfi.operator_admissions WHERE retired=false UNION SELECT unnest($1::text[])) admitted WHERE NOT(goal_id=ANY($2::text[])) AND goal_id NOT IN (SELECT goal_id FROM nabungfi.operator_admissions WHERE retired=true)',[acceptedRegistryGoalIds,completedIds]);const count=Number(union.rows[0]?.count);
    const lifetime=await tx.query('SELECT count(*)::integer AS count FROM (SELECT goal_id FROM nabungfi.operator_admissions UNION SELECT unnest($1::text[])) admitted',[acceptedRegistryGoalIds]);if(!existing.rows.length&&!acceptedRegistryGoalIds.includes(goalId)&&Number(lifetime.rows[0]?.count)>=500)throw new ApiError('OPERATOR_HISTORY_CAPACITY',503,'The coordinator lifetime registry is full. Do not pay provisioning fees.');
    const completed=completedIds.includes(goalId),accepted=acceptedRegistryGoalIds.includes(goalId);if(!existing.rows.length&&!accepted&&count>=capacity)throw new ApiError('OPERATOR_CAPACITY_FULL',503,'The coordinator has no available active goal capacity. Your metadata is saved; do not pay provisioning fees yet.');
    await tx.query('INSERT INTO nabungfi.operator_admissions(goal_id,retired) VALUES($1,$2) ON CONFLICT(goal_id) DO NOTHING',[goalId,completed]);
    return{admitted:true,reserved:count+(!existing.rows.length&&!accepted&&!completed?1:0),capacity};
   });
  },
  async releaseUnusedCoordinationAdmission(goalId){return db.transaction(async tx=>{
   await tx.query("SELECT pg_advisory_xact_lock(hashtext('nabungfi_operator_admissions'))");
   const goals=await tx.query('SELECT * FROM nabungfi.goals WHERE goal_id=$1 FOR UPDATE',[goalId]);const row=goals.rows[0];if(!row)return false;
   const b=row.binding as GoalBinding;if(b.initialized||b.participants.some(p=>p.vault||p.configHash||p.creationHash))return false;
   const steps=await tx.query('SELECT id FROM nabungfi.goal_steps WHERE goal_id=$1 AND (plan IS NOT NULL OR transaction_hash IS NOT NULL OR status IN (\'planning\',\'signing\',\'submitted\',\'pending\')) FOR UPDATE',[row.id]);if(steps.rows.length)return false;
   const deleted=await tx.query('DELETE FROM nabungfi.operator_admissions WHERE goal_id=$1 AND retired=false RETURNING goal_id',[goalId]);return deleted.rows.length>0;
  });},
 };
}
