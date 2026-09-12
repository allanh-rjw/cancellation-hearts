const QUESTIONISH=/\?|what |which |why |how |explain|what in this hand|what specifically/i;
const STALE_QUEENS=/Q♠|Q♥|10♥|queen of spades|queen of hearts/i;
function textOf(result){return String(result?.coachOutput?.text||result?.coaching?.text||'').trim();}
function pass(name,ok,detail=''){return{dimension:name,pass:Boolean(ok),score:ok?1:0,detail};}
const FAILURE_SIGNATURES=Object.freeze({
 'grounding':'stale-card-reference',
 'listening':'already-answered-question-repeated',
 'inference-discipline':'unsupported-reasoning-inference',
 'answer-reasoning-separation':'answer-reasoning-conflated',
 'specificity':'generic-follow-up',
 'minimal-intervention':'excessive-hinting',
 'pathway-coherence':'pathway-incoherence',
 'passing-quality':'passing-treated-as-disposal-only',
 'advanced-table-reasoning':'advanced-strategy-under-specified',
 'valid-alternative-acceptance':'valid-alternative-rejected',
 'must-identify-missing':'missing-component-not-identified',
 'must-not-advance':'contradiction-not-detected',
 'required-clarification':'reasoning-ambiguity-not-probed',
 'no-stale-hand-reference':'stale-card-reference'
});
export function evaluateTutorBehavior({adapter,problem,result,simulatedResponse,expected={}}={}){
 const text=textOf(result),checks=[];
 const grounding=adapter.groundCoachOutput({problem,text});
 checks.push(pass('grounding',grounding.grounded,grounding.findings?.join('; ')||''));
 if(expected.noRedundantQuestion||simulatedResponse?.complete)checks.push(pass('listening',!QUESTIONISH.test(text),text));
 else checks.push(pass('listening',true,'no deterministic listening assertion'));
 if(simulatedResponse&&!simulatedResponse.reasoningExplicit)checks.push(pass('inference-discipline',result?.diagnosticEvidence?.inferenceEligible===false||result?.pedagogicalDecision?.move==='clarify-reasoning','unstated reasoning must not become misconception evidence'));
 else checks.push(pass('inference-discipline',true,'reasoning explicit or not under test'));
 if(expected.noReasoningMastery)checks.push(pass('answer-reasoning-separation',result?.pedagogicalDecision?.move==='clarify-reasoning'&&result?.diagnosticEvidence?.inferenceEligible===false,'terse conclusion should trigger clarification'));
 else checks.push(pass('answer-reasoning-separation',true));
 const specific=/♣|♦|♠|♥|void|lead|control|winner|pass|moon|target|preserv|liabilit|intervention|pathway|original plan|evidence|exposed|risk|incoming|received/i.test(text);
 checks.push(pass('specificity',specific||text.length<40,text));
 checks.push(pass('minimal-intervention',text.length<=650,`${text.length} characters`));
 const move=result?.pedagogicalDecision?.move;
 checks.push(pass('pathway-coherence',!['worked-example'].includes(move)||simulatedResponse?.assistanceState!=='none',`move=${move||'n/a'}`));
 checks.push(pass('adaptive-scaffolding',true,'evaluated longitudinally in session metrics'));
 checks.push(pass('progression-quality',true,'evaluated at session level'));
 checks.push(pass('passing-quality',simulatedResponse?.stepId?.includes('pass')?(/pass|path|preserv|change|incoming|received|objective/i.test(text)):true,text));
 checks.push(pass('advanced-table-reasoning',['threat','pivot','observe','target'].includes(simulatedResponse?.stepId)?(/moon|threat|evidence|minimum|smallest|intervention|pathway|target|void|exposed|score|risk|plan/i.test(text)):true,text));
 checks.push(pass('transfer',true,'evaluated at session level'));
 if(expected.noStaleQueenCards)checks.push(pass('no-stale-hand-reference',!STALE_QUEENS.test(text),text));
 if(expected.requiresClarification)checks.push(pass('required-clarification',move==='clarify-reasoning',`move=${move}`));
 if(expected.mustNotAdvance)checks.push(pass('must-not-advance',move!=='advance',`move=${move}`));
 if(expected.mustIdentifyMissing)checks.push(pass('must-identify-missing',QUESTIONISH.test(text)||/missing|not yet|still need|part of|have not yet identified|specific cards/i.test(text),text));
 if(expected.mustNotReject)checks.push(pass('valid-alternative-acceptance',result?.deterministicEvaluation?.score?.value>=.58&&move!=='worked-example',`score=${result?.deterministicEvaluation?.score?.value}; move=${move}`));
 if(expected.status)checks.push(pass('expected-status',result?.deterministicEvaluation?.status===expected.status,`actual=${result?.deterministicEvaluation?.status}`));
 const failures=checks.filter(c=>!c.pass),score=checks.reduce((s,c)=>s+c.score,0)/Math.max(1,checks.length);
 return{score:Number(score.toFixed(4)),passed:failures.length===0,checks,failures,text};
}
export function summarizeEvaluations(evaluations=[]){const byDimension=new Map();for(const e of evaluations)for(const c of e.checks||[]){const x=byDimension.get(c.dimension)||{pass:0,total:0};x.total++;if(c.pass)x.pass++;byDimension.set(c.dimension,x);}return Object.fromEntries([...byDimension.entries()].map(([k,v])=>[k,{...v,rate:v.total?Number((v.pass/v.total).toFixed(4)):null}]));}
export function mineFailures(evaluations=[]){const groups=new Map();for(const e of evaluations)for(const f of e.failures||[]){const key=FAILURE_SIGNATURES[f.dimension]||f.dimension,x=groups.get(key)||{signature:key,count:0,dimensions:new Set(),examples:[]};x.count++;x.dimensions.add(f.dimension);if(x.examples.length<3)x.examples.push({caseId:e.caseId||null,detail:f.detail});groups.set(key,x);}return[...groups.values()].map(x=>({...x,dimensions:[...x.dimensions]})).sort((a,b)=>b.count-a.count);}
