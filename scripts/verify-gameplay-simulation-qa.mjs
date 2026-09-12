import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root=process.cwd();
const sourcePath=join(root,'scripts','verify-gameplay-simulation.mjs');
let source=readFileSync(sourcePath,'utf8');

const humanPlayNeedle="          const card=document.querySelector('#humanHand .card.playable');if(card){card.click();action='human-play';}";
if(!source.includes(humanPlayNeedle)) throw new Error('Human-play simulation hook changed');
source=source.replace(humanPlayNeedle,`          if(state.mode==='practice'){\n            const legal=legalCards(0);\n            const rec=rankHumanLegalCards(legal)[0];\n            const chosen=rec?.card||legal[0];\n            if(chosen){\n              if(state.trick.length===0&&typeof moonLeadForecast==='function'){\n                const best=Math.max(...legal.map(c=>moonLeadForecast(0,c).score));\n                const chosenForecast=moonLeadForecast(0,chosen).score;\n                window.__qaMoonLeadMaxGap=Math.max(window.__qaMoonLeadMaxGap||0,best-chosenForecast);\n              }\n              playCard(0,chosen);action='human-play-coach';\n            }\n          }else{\n            const card=document.querySelector('#humanHand .card.playable');if(card){card.click();action='human-play';}\n          }`);

const timeoutNeedle="    const maxMs=scenario.mode==='standard'?18000:12000;";
if(!source.includes(timeoutNeedle)) throw new Error('Scenario timeout hook changed');
source=source.replace(timeoutNeedle,"    const maxMs=scenario.mode==='standard'?(scenario.targetHands>2?65000:18000):12000;");

const standardSeedsNeedle="const seeds=[baseSeed+11,baseSeed+23,baseSeed+47,baseSeed+89];";
if(!source.includes(standardSeedsNeedle)) throw new Error('Standard seed matrix hook changed');
source=source.replace(standardSeedsNeedle,"const seeds=[baseSeed+11,baseSeed+23,baseSeed+47,baseSeed+89,baseSeed+307,baseSeed+353,baseSeed+401,baseSeed+449];");

const practiceMatrixNeedle="for(const practiceType of ['solo','two'])for(const strength of ['ridiculous','strong','solid','marginal'])for(const seed of seeds.slice(0,3))scenarios.push({mode:'practice',practiceType,strength,difficulty:'expert',seed,width:1440,height:900,targetHands:1});";
if(!source.includes(practiceMatrixNeedle)) throw new Error('Practice calibration matrix hook changed');
source=source.replace(practiceMatrixNeedle,`const calibrationSeeds=[baseSeed+11,baseSeed+23,baseSeed+47,baseSeed+89,baseSeed+131,baseSeed+173,baseSeed+211,baseSeed+257,baseSeed+307,baseSeed+353,baseSeed+401,baseSeed+449,baseSeed+503,baseSeed+557,baseSeed+613,baseSeed+673];\nfor(const practiceType of ['solo','two'])for(const strength of ['ridiculous','strong','solid','marginal'])for(const seed of calibrationSeeds)scenarios.push({mode:'practice',practiceType,strength,difficulty:'expert',seed,width:1440,height:900,targetHands:1,calibration:true});`);

const scenarioNeedle="scenarios.push({mode:'practice',practiceType:'solo',strength:'strong',difficulty:'expert',seed:baseSeed+703,width:1024,height:768,targetHands:1,openCoach:true});";
if(!source.includes(scenarioNeedle)) throw new Error('Scenario matrix hook changed');
source=source.replace(scenarioNeedle,`${scenarioNeedle}\nscenarios.push({mode:'practice',practiceType:'solo',strength:'ridiculous',difficulty:'expert',seed:baseSeed+711,width:1440,height:900,targetHands:1,forcedOutcome:'solo-success'});\nscenarios.push({mode:'practice',practiceType:'two',strength:'ridiculous',difficulty:'expert',seed:baseSeed+712,width:1440,height:900,targetHands:1,forcedOutcome:'two-success'});\nscenarios.push({mode:'standard',difficulty:'expert',seed:baseSeed+801,width:1440,height:900,targetHands:8});`);

const gameStartNeedle="    if(scenario.openCoach)await evaluate(`document.getElementById('coachBtn')?.click()`);";
if(!source.includes(gameStartNeedle)) throw new Error('Forced outcome startup hook changed');
source=source.replace(gameStartNeedle,`${gameStartNeedle}\n    if(scenario.forcedOutcome){\n      await evaluate(\`(()=>{\n        state.players.forEach(p=>{p.roundPoints=0;p.score=0;});\n        state.scoreHistory=[];state.carryoverPoints=0;state.carryoverCards=[];\n        if(\${JSON.stringify(scenario.forcedOutcome)}==='solo-success'){\n          state.players[0].roundPoints=52;\n        }else{\n          state.players[0].roundPoints=26;\n          state.players[state.partnerIndex].roundPoints=26;\n        }\n        finishRound();\n        return true;\n      })()\`);\n    }`);

const snapshotNeedle="          scoreHistoryLength:state.scoreHistory.length,gameOver:state.gameOver,practiceEnded:state.practiceEnded,";
if(!source.includes(snapshotNeedle)) throw new Error('Practice outcome snapshot hook changed');
source=source.replace(snapshotNeedle,"          scoreHistoryLength:state.scoreHistory.length,gameOver:state.gameOver,practiceEnded:state.practiceEnded,practiceSuccess:state.practiceSuccess===true,qaMoonLeadMaxGap:Number(window.__qaMoonLeadMaxGap||0),");

const resultNeedle="      completedHands:final.scoreHistoryLength,practiceEnded:final.practiceEnded,gameOver:final.gameOver,finalStatus:final.status,";
if(!source.includes(resultNeedle)) throw new Error('Scenario result hook changed');
source=source.replace(resultNeedle,"      completedHands:final.scoreHistoryLength,practiceEnded:final.practiceEnded,practiceSuccess:final.practiceSuccess===true,calibration:scenario.calibration===true,forcedOutcome:scenario.forcedOutcome??null,gameOver:final.gameOver,finalPhase:final.phase,finalStatus:final.status,finalTrickNumber:final.trickNumber,finalRoundPoints:final.roundPoints,finalScores:final.scores,finalCenterActionVisible:final.centerActionVisible,qaMoonLeadMaxGap:final.qaMoonLeadMaxGap,");

const temp=join(tmpdir(),`verify-gameplay-simulation-qa-${process.pid}.mjs`);
writeFileSync(temp,source);
let status=1;
try{
  const result=spawnSync(process.execPath,[temp],{cwd:root,stdio:'inherit'});
  if(result.error) throw result.error;
  status=result.status??1;

  const reportPath=join(root,'simulation','results','gameplay-latest.json');
  if(existsSync(reportPath)){
    const report=JSON.parse(readFileSync(reportPath,'utf8'));
    const collided=report.results.filter(r=>r.collisionCount>0);
    if(collided.length){
      console.log('\nQA collision detail:');
      for(const r of collided){
        console.log(`- ${r.label}: ${r.collisionCount}; first=${JSON.stringify(r.collisions?.[0]??null)}`);
      }
    }

    const longCycle=report.results.find(r=>r.mode==='standard'&&r.completedHands===8);
    console.log(`\nQA full pass cycle: ${longCycle?`completed ${longCycle.completedHands}/8 hands; status=${longCycle.finalStatus}`:'not completed'}`);

    const forced=report.results.filter(r=>r.forcedOutcome);
    let forcedFailure=false;
    for(const r of forced){
      const terminal=r.practiceSuccess&&r.practiceEnded&&r.gameOver&&r.finalPhase==='practice-end'&&!r.finalCenterActionVisible&&r.completedHands===1;
      const scoring=r.forcedOutcome==='solo-success'
        ? r.finalScores?.[0]===0&&r.finalScores?.slice(1).every(x=>x===104)
        : r.finalScores?.filter(x=>x===0).length===2&&r.finalScores?.filter(x=>x===26).length===6;
      console.log(`\nQA forced ${r.forcedOutcome}: terminal=${terminal}; scoring=${scoring}; status=${r.finalStatus}`);
      if(!terminal||!scoring) forcedFailure=true;
    }

    const practice=report.results.filter(r=>r.mode==='practice'&&!r.forcedOutcome);
    const calibration=practice.filter(r=>r.calibration);
    const successful=practice.filter(r=>r.practiceSuccess);
    const nonTerminal=successful.filter(r=>!r.practiceEnded||!r.gameOver);
    const brokenEarly=practice.filter(r=>r.practiceEnded&&!r.practiceSuccess&&r.completedHands===0);
    const completedMiss=practice.filter(r=>r.practiceEnded&&!r.practiceSuccess&&r.completedHands>0);
    const leadMismatch=practice.filter(r=>(r.qaMoonLeadMaxGap||0)>20);
    console.log(`\nQA practice outcomes: objective-success=${successful.length}/${practice.length}; broken-early=${brokenEarly.length}/${practice.length}; completed-objective-miss=${completedMiss.length}; successful-but-nonterminal=${nonTerminal.length}; material-lead-forecast-mismatches=${leadMismatch.length}`);

    const groups=new Map();
    const rates=new Map();
    for(const r of calibration){
      const key=`${r.practiceType}:${r.strength}`;
      const rows=groups.get(key)??[]; rows.push(r); groups.set(key,rows);
    }
    console.log('\nQA practice calibration (16-seed cohorts only):');
    for(const [key,rows] of [...groups.entries()].sort()){
      const breaks=rows.filter(r=>r.practiceEnded&&!r.practiceSuccess&&r.completedHands===0&&Number.isFinite(r.finalTrickNumber));
      const avg=breaks.length?breaks.reduce((n,r)=>n+r.finalTrickNumber,0)/breaks.length:null;
      const points=rows.map(r=>r.finalRoundPoints?.[0]??0);
      const avgHumanPoints=points.length?points.reduce((a,b)=>a+b,0)/points.length:0;
      const successCount=rows.filter(r=>r.practiceSuccess).length;
      const rate=successCount/rows.length;
      rates.set(key,rate);
      const maxLeadGap=Math.max(0,...rows.map(r=>r.qaMoonLeadMaxGap||0));
      console.log(`- ${key}: success=${successCount}/${rows.length} (${(rate*100).toFixed(1)}%); completed-miss=${rows.filter(r=>!r.practiceSuccess&&r.completedHands>0).length}; avg-break-after-trick=${avg==null?'n/a':avg.toFixed(1)}; avg-human-penalty-points=${avgHumanPoints.toFixed(1)}; max-lead-forecast-gap=${maxLeadGap.toFixed(1)}`);
    }

    // Calibration is a product behavior, not a vanity metric. CI must reject a
    // ladder where an easier label performs worse than the next harder one.
    const strengthOrder=['ridiculous','strong','solid','marginal'];
    let calibrationFailure=false;
    for(const mode of ['solo','two']){
      const ordered=strengthOrder.map(s=>rates.get(`${mode}:${s}`));
      if(ordered.some(x=>x==null)){
        console.log(`QA calibration gate: missing ${mode} cohort.`);
        calibrationFailure=true;
        continue;
      }
      for(let i=0;i<ordered.length-1;i++){
        if(ordered[i]<ordered[i+1]){
          console.log(`QA calibration gate: ${mode}:${strengthOrder[i]} ${(ordered[i]*100).toFixed(1)}% < ${strengthOrder[i+1]} ${(ordered[i+1]*100).toFixed(1)}%.`);
          calibrationFailure=true;
        }
      }
      if(ordered[0]-ordered[3]<0.50){
        console.log(`QA calibration gate: ${mode} ladder separation is only ${((ordered[0]-ordered[3])*100).toFixed(1)} points; require >=50.`);
        calibrationFailure=true;
      }
    }

    if(nonTerminal.length||forcedFailure||leadMismatch.length||calibrationFailure) status=status||3;
  }
  process.exitCode=status;
}finally{
  try{unlinkSync(temp);}catch{}
}
