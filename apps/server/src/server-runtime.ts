import type {Server} from 'node:http';
import {ApiError} from './errors.js';

let activeChainReads=0;
/** No queue: callers retain the original intent and retry after a short busy response. */
export async function boundedChainRead<T>(read:()=>Promise<T>):Promise<T>{
 if(activeChainReads>=4)throw new ApiError('CHAIN_READ_BUSY',503,'Chain verification is busy. Retry the original request shortly.');
 activeChainReads++;try{return await read();}finally{activeChainReads--;}
}

export async function stopApplication(server:Server,cleanup:()=>Promise<void>,deadlineMs=30000):Promise<{forcedConnections:boolean;cleanupCompleted:boolean}>{
 let forcedConnections=false,cleanupCompleted=false;
 const closed=new Promise<void>(done=>server.close(()=>done()));server.closeIdleConnections();
 const force=setTimeout(()=>{forcedConnections=true;server.closeAllConnections();},Math.floor(deadlineMs/2));
 let limit:ReturnType<typeof setTimeout>|undefined;
 const work=closed.then(async()=>{clearTimeout(force);await cleanup();cleanupCompleted=true;});
 try{await Promise.race([work,new Promise<void>(done=>{limit=setTimeout(()=>{forcedConnections=true;server.closeAllConnections();done();},deadlineMs);})]);}
 finally{clearTimeout(force);if(limit)clearTimeout(limit);void work.catch(()=>{});}
 return{forcedConnections,cleanupCompleted};
}
export function installShutdownHandlers(server:Server,cleanup:()=>Promise<void>,deadlineMs=30000):void{
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;void(async()=>{try{const result=await stopApplication(server,cleanup,deadlineMs);process.exit(result.cleanupCompleted?0:1);}catch{console.error('Application shutdown could not finish cleanly.');process.exit(1);}})();};
 for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,stop);
}
