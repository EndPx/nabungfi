import {PrivyClient} from '@privy-io/node';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {loadAppConfig,loadLocalEnvironment} from '../src/config.js';
import {neonDatabase} from '../src/database.js';
loadLocalEnvironment();const config=loadAppConfig();const db=neonDatabase(config.databaseUrl);
try{
 const result=await db.query("SELECT current_database() AS database, (SELECT count(*)::text FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')) AS user_tables");
 const client=new PrivyClient({appId:config.privyAppId,appSecret:config.privyAppSecret,timeout:15000,maxRetries:0});
 const users=await client.users().list({limit:1});
 const report={checkedAtUtc:new Date().toISOString(),neonSelect:true,databaseNamed:Boolean(result.rows[0]?.database),userTableCount:Number(result.rows[0]?.user_tables),privyApiAuthentication:true,userListReadable:Array.isArray(users.data),financialTransactions:0};
 const reportPath=resolve(import.meta.dirname,'../../../.local/backend-readiness-report.json');await mkdir(dirname(reportPath),{recursive:true});
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify(report));
}catch{console.error('Backend readiness failed; private provider details withheld.');process.exitCode=1;}finally{await db.close();}
