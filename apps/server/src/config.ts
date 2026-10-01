import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AppConfig { privyAppId: string; privyAppSecret: string; databaseUrl: string; origins: string[]; port: number; host: string; production: boolean; keeperRegistryFile?:string;keeperStatusFile?:string }
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = (key: string) => { const value = env[key]?.trim(); if(!value) throw new Error(`Required application setting missing: ${key}`); return value; };
  const production=env.NODE_ENV==='production';
  const origins=(env.NABUNGFI_WEB_ORIGIN??'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173').split(',').map(v=>v.trim());
  for(const value of origins){let u:URL;try{u=new URL(value);}catch{throw new Error('Invalid application origin configuration');}if(u.origin!==value||u.username||u.password||(production&&u.protocol!=='https:'))throw new Error('Invalid application origin configuration');}
  const databaseUrl=required('DATABASE_URL');let db:URL;try{db=new URL(databaseUrl);}catch{throw new Error('Invalid database connection configuration');}
  if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname.endsWith('.neon.tech')||db.searchParams.get('sslmode')!=='require')throw new Error('Invalid database connection configuration');
  const port=Number(env.PORT??env.NABUNGFI_API_PORT??3001);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid API port');
  const keeperRegistryFile=env.NABUNGFI_KEEPER_REGISTRY_FILE?.trim();
  const keeperStatusFile=env.NABUNGFI_KEEPER_STATUS_FILE?.trim();
  if(keeperRegistryFile&&!resolve(keeperRegistryFile).split(/[\\/]/).includes('.local'))throw new Error('Invalid private operator registry configuration');
  return {privyAppId:required('PRIVY_APP_ID'),privyAppSecret:required('PRIVY_APP_SECRET'),databaseUrl,origins,port,host:env.NABUNGFI_API_HOST??'127.0.0.1',production,...(keeperRegistryFile?{keeperRegistryFile}:{}),...(keeperStatusFile?{keeperStatusFile}:{})};
}
export function loadLocalEnvironment(): void { const path=resolve(import.meta.dirname,'../.env');if(existsSync(path))loadEnvFile(path); }
