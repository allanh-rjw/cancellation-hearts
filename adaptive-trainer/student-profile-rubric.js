export const STUDENT_PROFILE_RUBRIC_VERSION=1;
export const STUDENT_PROFILE_DIMENSIONS=Object.freeze(['understanding','consistency','independence','transfer']);
export const STUDENT_PROFILE_SCORE_MAX=16;

const PRIMARY_KINDS=new Set(['independent-correct','independent-incorrect','assisted-correct','assisted-incorrect']);

function evidencePayloads(events,constructId){return (events||[]).filter(e=>e?.type==='learner-evidence-created'&&e.payload?.constructId===constructId).map(e=>e.payload);}
function primaryEvidence(events,constructId){return evidencePayloads(events,constructId).filter(e=>PRIMARY_KINDS.has(e.kind));}
function transferEvidence(events,constructId){return evidencePayloads(events,constructId).filter(e=>e.kind==='transfer-success'||e.kind==='transfer-failure');}
function positive(e){return e.kind==='independent-correct'||e.kind==='assisted-correct'||e.kind==='transfer-success';}
function negative(e){return e.kind==='independent-incorrect'||e.kind==='assisted-incorrect'||e.kind==='transfer-failure';}
function distinctProblems(records){return new Set(records.map(e=>e.problemVersionId).filter(Boolean)).size;}
function weightedShare(records){const total=records.reduce((s,e)=>s+(Number(e.strength)||1),0);if(!total)return 0.5;return records.reduce((s,e)=>s+(positive(e)?(Number(e.strength)||1):0),0)/total;}

function understandingRating(records){
  if(records.length<2)return null;
  const pos=records.filter(positive),neg=records.filter(negative),p=weightedShare(records);
  if(p>=0.72&&pos.length>=2&&pos.length>=neg.length*2)return 4;
  if(p<=0.4&&neg.length>=2)return 1;
  if(pos.length>neg.length)return 3;
  if(neg.length>pos.length)return 1;
  return 2;
}
function consistencyRating(records){
  if(records.length<3||distinctProblems(records)<2)return null;
  const pos=records.filter(positive).length,neg=records.filter(negative).length,directional=pos+neg,share=directional?pos/directional:0;
  if(pos>=3&&share>=0.8)return 4;
  if(pos>=2&&share>=0.6)return 3;
  return 1;
}
function independenceRating(records){
  const pos=records.filter(positive),ind=pos.filter(e=>e.kind==='independent-correct').length,assisted=pos.filter(e=>e.kind==='assisted-correct').length;
  if(!pos.length)return null;
  if(ind===0&&assisted>0)return 1;
  if(ind<2)return null;
  if(ind>=3&&ind>=assisted)return 4;
  return 3;
}
function transferRating(records){
  const pos=records.filter(e=>e.kind==='transfer-success').length;
  if(!pos)return null;
  if(pos>=2)return 4;
  return 3;
}

export function scoreLabel(score,labels={low:'Beginner',middle:'Developing',high:'Advanced',top:'Expert'}){
  if(!Number.isFinite(score))return null;
  if(score>=15)return labels.top;
  if(score>=12)return labels.high;
  if(score>=8)return labels.middle;
  return labels.low;
}

export function buildSkillRubricSummary({constructId,events=[],label=constructId,labels}={}){
  const primary=primaryEvidence(events,constructId),transfer=transferEvidence(events,constructId);
  const ratings=Object.freeze({
    understanding:understandingRating(primary),
    consistency:consistencyRating(primary),
    independence:independenceRating(primary),
    transfer:transferRating(transfer)
  });
  const values=Object.values(ratings),scoredCount=values.filter(Number.isFinite).length;
  const score=scoredCount===4?values.reduce((a,b)=>a+b,0):null;
  return Object.freeze({
    schemaVersion:STUDENT_PROFILE_RUBRIC_VERSION,
    constructId,label,ratings,score,scoreMaximum:STUDENT_PROFILE_SCORE_MAX,
    barPercent:score===null?null:Math.round(score/STUDENT_PROFILE_SCORE_MAX*100),
    performanceLabel:primary.length===0?'Not yet assessed':score===null?'More evidence needed':scoreLabel(score,labels),
    evidence:{primaryAttempts:primary.length,distinctProblems:distinctProblems(primary),independentSuccesses:primary.filter(e=>e.kind==='independent-correct').length,assistedSuccesses:primary.filter(e=>e.kind==='assisted-correct').length,transferSuccesses:transfer.filter(e=>e.kind==='transfer-success').length,transferFailures:transfer.filter(e=>e.kind==='transfer-failure').length}
  });
}

export function buildAggregateRubricSummary({constructIds=[],events=[],labels}={}){
  const skills=constructIds.map(id=>buildSkillRubricSummary({constructId:id,events,labels}));
  const assessed=skills.filter(s=>s.performanceLabel!=='Not yet assessed');
  const scored=skills.filter(s=>Number.isFinite(s.score));
  if(!assessed.length)return Object.freeze({performanceLabel:'Not yet assessed',score:null,scoreMaximum:16,barPercent:null,skills});
  if(scored.length<constructIds.length)return Object.freeze({performanceLabel:'More evidence needed',score:null,scoreMaximum:16,barPercent:null,skills});
  const score=scored.reduce((sum,s)=>sum+s.score,0)/scored.length;
  return Object.freeze({performanceLabel:scoreLabel(score,labels),score,scoreMaximum:16,barPercent:Math.round(score/16*100),skills});
}

if(typeof window!=='undefined')window.AdaptiveStudentProfileRubric={STUDENT_PROFILE_RUBRIC_VERSION,STUDENT_PROFILE_DIMENSIONS,STUDENT_PROFILE_SCORE_MAX,scoreLabel,buildSkillRubricSummary,buildAggregateRubricSummary};
