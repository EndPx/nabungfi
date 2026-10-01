import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export type Row = Record<string,unknown>;
export interface SqlConnection { query(text:string,values?:unknown[]):Promise<{rows:Row[];rowCount:number|null}> }
export interface Database extends SqlConnection { transaction<T>(callback:(connection:SqlConnection)=>Promise<T>):Promise<T>;close():Promise<void> }
export const migrationChecksum=(source:string)=>createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
export function neonDatabase(url:string): Database {
  neonConfig.webSocketConstructor=WebSocket;
  const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:15000,idleTimeoutMillis:20000,query_timeout:15000});
  pool.on('error',()=>{console.error('Application database connection interrupted.');});
  return {query:(text,values)=>pool.query(text,values),async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},close:()=>pool.end()};
}
export async function migrateDatabase(db:Database):Promise<void> {
  await db.transaction(async tx=>{
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('nabungfi_application_migrations_v1'))");
    await tx.query('CREATE SCHEMA IF NOT EXISTS nabungfi');
    await tx.query('CREATE TABLE IF NOT EXISTS nabungfi.schema_migrations(version integer PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    for(const [version,file]of [[1,'001_application.sql'],[2,'002_binding_guards.sql'],[3,'003_wallet_start.sql'],[4,'004_active_wallet_lane.sql'],[5,'005_owner_wallet_lane.sql'],[6,'006_verified_receipt_hash.sql'],[7,'007_coordination_admission.sql'],[8,'008_wallet_rejection.sql'],[9,'009_retired_admissions.sql']] as const){
      const source=await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8');
      const checksum=migrationChecksum(source);
      const prior=await tx.query('SELECT checksum FROM nabungfi.schema_migrations WHERE version=$1',[version]);
      if(prior.rows.length){if(prior.rows[0]?.checksum!==checksum)throw new Error('Migration checksum mismatch');continue;}
      await tx.query(source);
      await tx.query('INSERT INTO nabungfi.schema_migrations(version,checksum) VALUES($1,$2)',[version,checksum]);
    }
  });
}
