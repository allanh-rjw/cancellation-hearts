import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const root=process.cwd();
const original=readFileSync(join(root,'scripts','diagnose-standard-opponent-ai.mjs'),'utf8');
const sourceList="['app.js','gameplay-standard-fixes.js','gameplay-moon-fixes.js','gameplay-moon-calibration.js']";
const expanded="['app.js','gameplay-standard-fixes.js','gameplay-opponent-lookahead.js','gameplay-moon-fixes.js','gameplay-moon-calibration.js']";
const outputHook="else console.log(JSON.stringify(summarize(hands),null,2));";
const detailedOutput="else console.log(JSON.stringify({summary:summarize(hands),hands:hands.map(({seed,offset,currentSeats,plays,points})=>({seed,offset,currentSeats,plays,points}))},null,2));";
if(!original.includes(sourceList)||!original.includes(outputHook))throw new Error('diagnostic integration hook changed');

function variant(enabled){
  let source=original.replace(sourceList,expanded).replace(outputHook,detailedOutput);
  if(enabled)return source;
  const browser="await evaluate(diagnosticRuntime);await executeDiagnostic(evaluate);";
  const browserReplacement="await evaluate('window.__opponentLookahead.enabled=false');await evaluate(diagnosticRuntime);await executeDiagnostic(evaluate);";
  if(!source.includes(browser))throw new Error('browser diagnostic hook changed');
  source=source.replace(browser,browserReplacement);
  const dom="window.eval(`${sources.join('\\n')}\\n${diagnosticRuntime}`);";
  const domReplacement="window.eval(`${sources.join('\\n')}\\nwindow.__opponentLookahead.enabled=false;\\n${diagnosticRuntime}`);";
  if(!source.includes(dom))throw new Error('DOM diagnostic hook changed');
  return source.replace(dom,domReplacement);
}
function run(enabled,label){
  const file=join(tmpdir(),`hearts-${label}-${process.pid}.mjs`);
  writeFileSync(file,variant(enabled));
  try{
    const result=spawnSync(process.execPath,[file,'--deals=12','--cycle=passing','--seed-base=2026091840'],{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`${label} diagnostic failed: ${result.stderr||result.stdout}`);
    const start=result.stdout.indexOf('{'),end=result.stdout.lastIndexOf('}');
    if(start<0||end<start)throw new Error(`${label} diagnostic did not emit JSON`);
    return JSON.parse(result.stdout.slice(start,end+1));
  }finally{try{unlinkSync(file);}catch{}}
}

const prompt3=run(false,'prompt3');
const prompt4=run(true,'prompt4');
const a=prompt3.summary.aggregate.current,b=prompt4.summary.aggregate.current;
let changedHands=0,changedPlays=0;
for(let i=0;i<prompt4.hands.length;i++){
  const before=prompt3.hands[i],after=prompt4.hands[i];
  if(before.seed!==after.seed||before.offset!==after.offset||JSON.stringify(before.currentSeats)!==JSON.stringify(after.currentSeats))throw new Error('paired diagnostic deal alignment changed');
  let changed=false;
  for(let j=0;j<after.plays.length;j++)if(before.plays[j]!==after.plays[j]){changed=true;changedPlays++;}
  if(changed)changedHands++;
}
const summary={
  hands:prompt4.summary.hands,changedHands,changedPlays,
  prompt3:{points:a.points,avoidableLoadedCaptures:a.avoidableLoadedCaptures,unnecessaryLeadAcquisitions:a.unnecessaryLeadAcquisitions,earlyExitsSpent:a.earlyExitsSpent},
  prompt4:{points:b.points,avoidableLoadedCaptures:b.avoidableLoadedCaptures,unnecessaryLeadAcquisitions:b.unnecessaryLeadAcquisitions,earlyExitsSpent:b.earlyExitsSpent}
};
if(changedPlays===0)throw new Error(`lookahead did not alter a real seeded decision: ${JSON.stringify(summary)}`);
if(b.points>a.points+26)throw new Error(`lookahead point regression exceeded one 26-point swing: ${JSON.stringify(summary)}`);
if(b.avoidableLoadedCaptures>a.avoidableLoadedCaptures+4)throw new Error(`lookahead loaded-capture regression exceeded guardrail: ${JSON.stringify(summary)}`);
console.log(`opponent-lookahead-paired: ${JSON.stringify(summary)}`);
