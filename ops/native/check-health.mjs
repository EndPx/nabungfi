// Read-only localhost check. It never signs, retries transactions, or restarts a worker.
const url='http://127.0.0.1:3901';
try{
 const health=await fetch(url+'/api/health',{signal:AbortSignal.timeout(5000)});if(!health.ok)throw new Error();
 const denied=await fetch(url+'/api/goals',{signal:AbortSignal.timeout(5000)});if(denied.status!==401)throw new Error();
 const response=await fetch(url+'/api/config',{signal:AbortSignal.timeout(5000)}),config=await response.json();
 if(!response.ok||!config.coordinationAvailable||config.coordination?.capacity!==6)throw new Error();
 console.log(JSON.stringify({event:'nabungfi-health',api:true,authDenial:true,coordinator:true,capacity:6}));
}catch{console.error(JSON.stringify({event:'nabungfi-health',code:'api-or-coordinator-unavailable',action:'inspect-original-state-no-automatic-restart'}));process.exitCode=1;}
