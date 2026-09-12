import {runRegressionCorpus,runBatch,runDiagnosticForPersona,runInstructionalJourney} from './harness.mjs';
import {SIMULATED_PERSONAS,personaById} from './personas.mjs';
import {writeReports} from './report.mjs';
function arg(name,fallback=null){const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]:fallback;}
const mode=arg('mode','smoke'),seed=Number(arg('seed','20260911')),learners=Number(arg('learners',mode==='batch'?'100':'12')),hands=Number(arg('hands','2')),write=process.argv.includes('--write-report');
let result;
if(mode==='regression')result=await runRegressionCorpus({seed,throwOnFailure:true});
else if(mode==='placement'){const rows=[];for(let i=0;i<SIMULATED_PERSONAS.length;i++)rows.push(await runDiagnosticForPersona(SIMULATED_PERSONAS[i],{seed:seed+i}));result={source:'synthetic-simulation',kind:'placement',seed,rows};}
else if(mode==='persona'){const id=arg('persona',SIMULATED_PERSONAS[0].learnerId),persona=personaById(id);if(!persona)throw new Error(`Unknown persona ${id}`);result=await runInstructionalJourney(persona,{seed,hands});}
else result=await runBatch({learners,hands,seed});
if(result?.isolation&&(result.isolation.calibrationEligible!==0||result.isolation.learnerModelEligible!==0||result.isolation.productionStateTouched))throw new Error(`Synthetic isolation failed: ${JSON.stringify(result.isolation)}`);
if(write&&result.kind==='batch')console.log(JSON.stringify(writeReports(result),null,2));
console.log(JSON.stringify(result.kind==='batch'?{kind:result.kind,learners:result.learners,seed:result.seed,placement:result.placement,evaluationMetrics:result.evaluationMetrics,failures:result.failures,isolation:result.isolation}:result,null,2));
