import {loadAppConfig,loadLocalEnvironment} from './config.js';
import {privyAuthentication} from './auth.js';
import {neonDatabase,migrateDatabase} from './database.js';
import {postgresRepository} from './repository.js';
import {applicationServer} from './application-server.js';
import * as chain from './chain/index.js';
import {startRegistryPublisher,coordinationRuntime} from './keeper-registry.js';
import {ApiError} from './errors.js';
import {installShutdownHandlers} from './server-runtime.js';
let database:ReturnType<typeof neonDatabase>|undefined;
let stopPublisher:(()=>Promise<void>)|undefined;
try{
 loadLocalEnvironment();const config=loadAppConfig();database=neonDatabase(config.databaseUrl);
 await database.query('SELECT 1 AS connected');await migrateDatabase(database);
 const repo=postgresRepository(database);if(config.keeperRegistryFile)stopPublisher=startRegistryPublisher(repo,config.keeperRegistryFile);
 const coordination=coordinationRuntime(config.keeperRegistryFile,config.keeperStatusFile,async(goalId,ids,capacity,completedIds)=>{await repo.reserveCoordinationAdmission(goalId,ids,capacity,completedIds);});
 const runtime={coordinationStatus:coordination.coordinationStatus,async assertCoordinationAdmission(binding:Parameters<typeof coordination.assertCoordinationAdmission>[0]){try{await coordination.assertCoordinationAdmission(binding);}catch(error){if(error instanceof ApiError)throw error;throw new ApiError('OPERATOR_UNAVAILABLE',503,'The coordinator is unavailable. Your goal metadata is saved; wait before paying provisioning fees.');}}};
 const server=applicationServer(config,repo,privyAuthentication(config.privyAppId,config.privyAppSecret),chain,runtime);
 await new Promise<void>((ready,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.off('error',reject);ready();});});
 console.log('NabungFi authenticated testnet API ready; financial authority remains onchain.');
 installShutdownHandlers(server,async()=>{await stopPublisher?.();await database?.close();});
}catch{console.error('Application startup failed: check local configuration and database readiness.');await stopPublisher?.();await database?.close();process.exitCode=1;}
