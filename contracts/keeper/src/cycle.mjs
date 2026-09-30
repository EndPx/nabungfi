import{runGoal}from'./engine.mjs';
export async function runCycle(config,adapter,broadcast,log,onGoal=()=>{}){
 adapter.cycleActions=0;
 for(const goal of config.goals){try{await runGoal(goal,config,adapter,broadcast,log);onGoal(goal);}catch(error){log({event:'goal-error',goal:goal.name,error:error.name,code:'operation-paused'});}}
}
