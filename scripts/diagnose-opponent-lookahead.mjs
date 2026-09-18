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

function variant(mode){
  let source=original.replace(sourceList,expanded).replace(outputHook,detailedOutput);
  if(mode==='prompt5')return source;
  const control=mode==='prompt3'?'window.__opponentLookahead.enabled=false':'window.__opponentLookahead.prompt5Enabled=false';
  const browser="await evaluate(diagnosticRuntime);await executeDiagnostic(evaluate);";
  const browserReplacement=`await evaluate('${control}');await evaluate(diagnosticRuntime);await executeDiagnostic(evaluate);`;
  if(!source.includes(browser))throw new Error('browser diagnostic hook changed');
  source=source.replace(browser,browserReplacement);
  const dom="window.eval(`${sources.join('\\n')}\\n${diagnosticRuntime}`);";
  const domReplacement=`window.eval(\`${'${sources.join(\'\\\\n\')}'}\\n${control};\\n${'${diagnosticRuntime}'}\`);`;
  if(!source.includes(dom))throw new Error('DOM diagnostic hook changed');
  return source.replace(dom,domReplacement);
}
function run(mode,label){
  const file=join(tmpdir(),`hearts-${label}-${process.pid}.mjs`);
  writeFileSync(file,variant(mode));
  try{
    const args=process.argv.length>2?process.argv.slice(2):['--deals=12','--cycle=full','--seed-base=2026091840'];
    const result=spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`${label} diagnostic failed: ${result.stderr||result.stdout}`);
    const start=result.stdout.indexOf('{'),end=result.stdout.lastIndexOf('}');
    if(start<0||end<start)throw new Error(`${label} diagnostic did not emit JSON`);
    return JSON.parse(result.stdout.slice(start,end+1));
  }finally{try{unlinkSync(file);}catch{}}
}
function compact(result){
  const row=result.summary.aggregate.current;
  return {points:row.points,avoidableLoadedCaptures:row.avoidableLoadedCaptures,
    unnecessaryLeadAcquisitions:row.unnecessaryLeadAcquisitions,earlyExitsSpent:row.earlyExitsSpent};
}
function changes(beforeSet,afterSet){
  let changedHands=0,changedPlays=0;
  for(let i=0;i<afterSet.hands.length;i++){
    const before=beforeSet.hands[i],after=afterSet.hands[i];
    if(before.seed!==after.seed||before.offset!==after.offset||JSON.stringify(before.currentSeats)!==JSON.stringify(after.currentSeats))throw new Error('paired diagnostic deal alignment changed');
    let changed=false;
    for(let j=0;j<after.plays.length;j++)if(before.plays[j]!==after.plays[j]){changed=true;changedPlays++;}
    if(changed)changedHands++;
  }
  return {changedHands,changedPlays};
}

const prompt3=run('prompt3','prompt3');
const prompt4=run('prompt4','prompt4');
const prompt5=run('prompt5','prompt5');
const p34=changes(prompt3,prompt4),p45=changes(prompt4,prompt5);
const a=compact(prompt3),b=compact(prompt4),c=compact(prompt5);
const summary={hands:prompt5.summary.hands,prompt3:a,prompt4:b,prompt5:c,prompt3To4:p34,prompt4To5:p45};

if(p34.changedPlays===0)throw new Error(`Prompt 4 did not alter a real seeded decision: ${JSON.stringify(summary)}`);
if(b.points>a.points+26)throw new Error(`Prompt 4 point regression exceeded one 26-point swing: ${JSON.stringify(summary)}`);
if(p45.changedPlays===0)throw new Error(`Prompt 5 did not alter a real seeded decision: ${JSON.stringify(summary)}`);
if(c.points>b.points+26)throw new Error(`Prompt 5 point regression exceeded one 26-point swing: ${JSON.stringify(summary)}`);
if(c.avoidableLoadedCaptures>b.avoidableLoadedCaptures+2)throw new Error(`Prompt 5 loaded-capture regression exceeded guardrail: ${JSON.stringify(summary)}`);
if(c.unnecessaryLeadAcquisitions>b.unnecessaryLeadAcquisitions)throw new Error(`Prompt 5 increased unnecessary lead acquisitions: ${JSON.stringify(summary)}`);
if(c.earlyExitsSpent>b.earlyExitsSpent)throw new Error(`Prompt 5 increased early exit spending: ${JSON.stringify(summary)}`);
console.log(`opponent-policy-paired: ${JSON.stringify(summary)}`);
