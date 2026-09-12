import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { once } from 'node:events';

const root=process.cwd();
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8']]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=message=>{throw new Error(message);};

function chromeBinary(){
  const bins=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);
  return bins.find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??fail('Chrome/Chromium is required for gameplay simulation');
}
async function waitForDebugPort(profile,chrome,stderr){
  const file=join(profile,'DevToolsActivePort');
  for(let i=0;i<150;i++){
    if(existsSync(file)){
      const port=Number(readFileSync(file,'utf8').split(/\r?\n/)[0]);
      if(Number.isInteger(port)&&port>0)return port;
    }
    if(chrome.exitCode!==null)fail(`Chrome exited before DevTools started: ${stderr().slice(-1000)}`);
    await sleep(100);
  }
  fail(`Chrome DevTools endpoint did not start: ${stderr().slice(-1000)}`);
}
async function openTarget(port){
  const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});
  if(!r.ok)fail(`Unable to create Chrome target (${r.status})`);
  return r.json();
}
async function browserSession(port,label){
  const target=await openTarget(port);
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await Promise.race([once(ws,'open'),sleep(5000).then(()=>fail(`${label}: DevTools websocket did not open`))]);
  let nextId=0;
  const pending=new Map();
  const exceptions=[];
  function failPending(error){for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(error);}pending.clear();}
  ws.addEventListener('close',()=>failPending(new Error(`${label}: DevTools target closed unexpectedly`)));
  ws.addEventListener('error',()=>failPending(new Error(`${label}: DevTools websocket failed`)));
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(String(event.data));
    if(msg.id&&pending.has(msg.id)){
      const {resolve,reject,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);
      msg.error?reject(new Error(msg.error.message)):resolve(msg.result);
    }else if(msg.method==='Runtime.exceptionThrown'){
      exceptions.push(msg.params?.exceptionDetails?.exception?.description??msg.params?.exceptionDetails?.text??'uncaught browser exception');
    }
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${label}: DevTools command timed out: ${method}`));},8000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result?.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
    return result?.result?.value;
  };
  await send('Runtime.enable');await send('Page.enable');
  return{ws,exceptions,send,evaluate};
}
async function waitFor(evaluate,expression,label,{tries=120,delay=50}={}){
  for(let i=0;i<tries;i++){
    const value=await evaluate(expression);
    if(value)return value;
    await sleep(delay);
  }
  fail(`${label}: condition did not become ready`);
}

function stateChecks(snapshot,label){
  if(snapshot.players!==8)fail(`${label}: expected 8 players, found ${snapshot.players}`);
  if(snapshot.handSizes.some(n=>n<0||n>13))fail(`${label}: invalid hand size ${snapshot.handSizes.join(',')}`);
  if(snapshot.uniqueHandIds!==snapshot.totalHandCards)fail(`${label}: duplicate card id exists across live hands`);
  if(snapshot.roundPoints.some(n=>n<0||n>52))fail(`${label}: invalid round points ${snapshot.roundPoints.join(',')}`);
  if(snapshot.carryoverPoints<0||snapshot.carryoverPoints>52)fail(`${label}: invalid carryover ${snapshot.carryoverPoints}`);
  if(snapshot.mode==='standard'&&snapshot.partnerIndex!==null)fail(`${label}: standard game unexpectedly has a moon partner`);
  if(snapshot.mode==='practice'&&snapshot.practiceType==='two'&&snapshot.partnerIndex===null)fail(`${label}: two-player practice did not assign a partner`);
  if(snapshot.mode==='practice'&&snapshot.practiceType==='two'&&snapshot.partnerName!=='Partner')fail(`${label}: two-player practice partner is not named Partner`);
}
function validateCompletedHands(histories,label){
  for(const [index,row] of histories.entries()){
    const sum=Object.values(row).reduce((a,b)=>a+Number(b||0),0);
    if(![52,156,728].includes(sum))fail(`${label}: completed hand ${index+1} score delta sum ${sum}; expected 52, 156, or 728`);
  }
}

async function runScenario(port,baseUrl,scenario){
  const label=`${scenario.mode}:${scenario.practiceType??'-'}:${scenario.difficulty}:seed-${scenario.seed}:${scenario.width}x${scenario.height}`;
  const {ws,exceptions,send,evaluate}=await browserSession(port,label);
  const collisions=[];
  const openingObservations=[];
  const snapshots=[];
  let maxStagnantMs=0;
  try{
    await send('Emulation.setDeviceMetricsOverride',{width:scenario.width,height:scenario.height,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:`${baseUrl}/?learningMode=legacy`});
    await waitFor(evaluate,`document.readyState==='complete'&&!!document.getElementById('newGameBtn')&&typeof state!=='undefined'`,`${label} startup`);
    await evaluate(`(()=>{
      let s=${scenario.seed>>>0};
      Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
      const mode=document.getElementById('gameMode');mode.value=${JSON.stringify(scenario.mode)};mode.dispatchEvent(new Event('change',{bubbles:true}));
      if(${JSON.stringify(scenario.mode)}==='practice'){
        document.getElementById('practiceType').value=${JSON.stringify(scenario.practiceType??'solo')};
        document.getElementById('practiceStrength').value=${JSON.stringify(scenario.strength??'strong')};
      }else{
        document.getElementById('targetScore').value='200';
      }
      document.getElementById('difficulty').value=${JSON.stringify(scenario.difficulty)};
      const speed=document.getElementById('playSpeed');
      const turbo=document.createElement('option');turbo.value='300';turbo.textContent='QA turbo';speed.appendChild(turbo);speed.value='300';speed.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('newGameBtn').click();
      state.target=999;
      return true;
    })()`);
    await waitFor(evaluate,`document.getElementById('game')&&!document.getElementById('game').classList.contains('hidden')`,`${label} game start`);
    if(scenario.openCoach)await evaluate(`document.getElementById('coachBtn')?.click()`);

    const maxMs=scenario.mode==='standard'?18000:12000;
    const started=Date.now();
    let lastSignature='';
    let lastChange=Date.now();
    let done=false;
    while(!done){
      if(Date.now()-started>maxMs)fail(`${label}: simulation timed out`);
      const raw=await evaluate(`(()=>{
        const visible=el=>!!el&&!el.classList.contains('hidden')&&el.getClientRects().length>0;
        const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        const actionCollisions=[];
        for(const id of ['nextTrickBtn','nextRoundBtn']){
          const button=document.getElementById(id);if(!visible(button))continue;
          const br=button.getBoundingClientRect();
          for(const card of document.querySelectorAll('.seat .seat-played-card .card')){
            if(!visible(card))continue;const cr=card.getBoundingClientRect();const area=overlap(br,cr);
            if(area>0){const seat=card.closest('.seat');actionCollisions.push({button:id,seat:[...seat.classList].find(x=>/^seat-\\d+$/.test(x))??'unknown',area:Math.round(area),buttonRect:{x:Math.round(br.x),y:Math.round(br.y),w:Math.round(br.width),h:Math.round(br.height)},cardRect:{x:Math.round(cr.x),y:Math.round(cr.y),w:Math.round(cr.width),h:Math.round(cr.height)}});}
          }
        }
        const opening=state.trickNumber===0?{dealer:state.dealer,currentPlayer:state.currentPlayer,leader:state.leader,openingLeadSuit:state.openingLeadSuit,openingAutoPlayers:[...(state.openingAutoPlayers??[])],trick:(state.trick??[]).map(x=>({player:x.player,rank:x.card?.rank,suit:x.card?.suit,cancelled:!!x.cancelled}))}:null;
        let action='wait';
        if(state.phase==='passing'){
          while(state.selected.size<3){const card=document.querySelector('#humanHand .card.playable');if(!card)break;card.click();}
          const confirm=document.getElementById('confirmPassBtn');if(state.selected.size===3&&confirm&&!confirm.disabled){confirm.click();action='confirm-pass';}
        }else if(state.phase==='playing'&&state.currentPlayer===0){
          const card=document.querySelector('#humanHand .card.playable');if(card){card.click();action='human-play';}
        }else{
          const nextTrick=document.getElementById('nextTrickBtn');
          const nextRound=document.getElementById('nextRoundBtn');
          if(visible(nextTrick)){nextTrick.click();action='next-trick';}
          else if(visible(nextRound)&&state.scoreHistory.length<${scenario.targetHands??1}){nextRound.click();action='next-round';}
        }
        const handIds=state.players.flatMap(p=>p.hand.map(c=>c.id));
        const snap={
          action,actionCollisions,opening,
          mode:state.mode,practiceType:state.practiceType,practiceStrength:state.practiceStrength,
          players:state.players.length,phase:state.phase,currentPlayer:state.currentPlayer,leader:state.leader,dealer:state.dealer,
          trickNumber:state.trickNumber,trickLength:state.trick.length,handSizes:state.players.map(p=>p.hand.length),
          totalHandCards:handIds.length,uniqueHandIds:new Set(handIds).size,
          roundPoints:state.players.map(p=>p.roundPoints),scores:state.players.map(p=>p.score),scoreHistory:state.scoreHistory,
          scoreHistoryLength:state.scoreHistory.length,gameOver:state.gameOver,practiceEnded:state.practiceEnded,
          partnerIndex:state.partnerIndex,partnerName:state.partnerIndex==null?null:state.players[state.partnerIndex]?.name??null,
          carryoverPoints:state.carryoverPoints,status:document.getElementById('status')?.textContent??'',
          centerActionVisible:visible(document.getElementById('nextTrickBtn'))||visible(document.getElementById('nextRoundBtn'))
        };
        return JSON.stringify(snap);
      })()`);
      const snapshot=JSON.parse(raw);
      snapshots.push(snapshot);
      stateChecks(snapshot,label);
      if(snapshot.opening&&snapshot.opening.openingAutoPlayers.length)openingObservations.push(snapshot.opening);
      for(const c of snapshot.actionCollisions)collisions.push(c);
      const signature=JSON.stringify([snapshot.phase,snapshot.currentPlayer,snapshot.trickNumber,snapshot.trickLength,snapshot.handSizes,snapshot.scoreHistoryLength,snapshot.practiceEnded,snapshot.gameOver,snapshot.status,snapshot.action]);
      if(signature!==lastSignature){lastSignature=signature;lastChange=Date.now();}
      else maxStagnantMs=Math.max(maxStagnantMs,Date.now()-lastChange);
      if(Date.now()-lastChange>2500)fail(`${label}: no game-state progress for >2.5s; phase=${snapshot.phase}, player=${snapshot.currentPlayer}, trick=${snapshot.trickNumber}, status=${snapshot.status}`);
      if(exceptions.length)fail(`${label}: browser exception: ${exceptions.join(' | ')}`);
      if(scenario.mode==='standard')done=snapshot.scoreHistoryLength>=scenario.targetHands||snapshot.gameOver;
      else done=snapshot.practiceEnded||snapshot.scoreHistoryLength>=1||snapshot.gameOver;
      if(!done)await sleep(4);
    }
    const final=snapshots.at(-1);
    validateCompletedHands(final.scoreHistory,label);
    if(scenario.mode==='standard'&&!final.gameOver&&final.scoreHistoryLength<scenario.targetHands)fail(`${label}: did not complete requested hands`);
    return{
      label,mode:scenario.mode,practiceType:scenario.practiceType??null,strength:scenario.strength??null,difficulty:scenario.difficulty,seed:scenario.seed,
      viewport:`${scenario.width}x${scenario.height}`,openCoach:!!scenario.openCoach,
      completedHands:final.scoreHistoryLength,practiceEnded:final.practiceEnded,gameOver:final.gameOver,finalStatus:final.status,
      collisionCount:collisions.length,collisions:collisions.slice(0,8),openingSamples:openingObservations.slice(0,3),maxStagnantMs
    };
  }finally{ws.close();}
}

const server=createServer((req,res)=>{
  try{
    const requested=new URL(req.url,'http://localhost').pathname;
    if(requested.startsWith('/v1/domains/')){res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({status:'error',error:{code:'authorization-denied',retryable:false}}));return;}
    const rel=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));
    const clean=normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
    const file=join(root,clean);if(!statSync(file).isFile())throw new Error('not file');
    res.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(file));
  }catch{res.writeHead(404);res.end('not found');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const appPort=server.address().port;
const profile=mkdtempSync(join(tmpdir(),'hearts-gameplay-sim-'));
let chromeError='';
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});

const baseSeed=20260912;
const seeds=[baseSeed+11,baseSeed+23,baseSeed+47,baseSeed+89];
const scenarios=[];
for(const difficulty of ['easy','medium','hard','expert'])for(const seed of seeds)scenarios.push({mode:'standard',difficulty,seed,width:1440,height:900,targetHands:2});
for(const practiceType of ['solo','two'])for(const strength of ['ridiculous','strong','solid','marginal'])for(const seed of seeds.slice(0,3))scenarios.push({mode:'practice',practiceType,strength,difficulty:'expert',seed,width:1440,height:900,targetHands:1});
scenarios.push({mode:'standard',difficulty:'expert',seed:baseSeed+701,width:1024,height:768,targetHands:2});
scenarios.push({mode:'standard',difficulty:'expert',seed:baseSeed+702,width:1024,height:768,targetHands:2,openCoach:true});
scenarios.push({mode:'practice',practiceType:'solo',strength:'strong',difficulty:'expert',seed:baseSeed+703,width:1024,height:768,targetHands:1,openCoach:true});

const results=[];
try{
  const debugPort=await waitForDebugPort(profile,chrome,()=>chromeError);
  const baseUrl=`http://127.0.0.1:${appPort}`;
  for(const scenario of scenarios){
    const result=await runScenario(debugPort,baseUrl,scenario);
    results.push(result);
    console.log(`${result.label}: hands=${result.completedHands}, practiceEnded=${result.practiceEnded}, collisions=${result.collisionCount}, maxStagnantMs=${result.maxStagnantMs}`);
  }
  const collisions=results.filter(r=>r.collisionCount>0);
  const report={generatedAt:new Date().toISOString(),scenarioCount:results.length,standardScenarios:results.filter(r=>r.mode==='standard').length,practiceScenarios:results.filter(r=>r.mode==='practice').length,collisionScenarios:collisions.length,results};
  mkdirSync(join(root,'simulation','results'),{recursive:true});
  writeFileSync(join(root,'simulation','results','gameplay-latest.json'),JSON.stringify(report,null,2));
  const lines=['# Cancellation Hearts gameplay simulation','',`Scenarios: ${report.scenarioCount}`,`Standard: ${report.standardScenarios}`,`Practice: ${report.practiceScenarios}`,`Scenarios with center-action/card collisions: ${report.collisionScenarios}`,'','## Findings'];
  if(collisions.length){
    lines.push('',`- ${collisions.length} scenario(s) had a played card overlap a visible Next Trick/Next Round action.`,...collisions.slice(0,10).map(r=>`  - ${r.label}: ${r.collisionCount} overlap observation(s); first=${JSON.stringify(r.collisions[0])}`));
  }else lines.push('','- No played-card overlap with visible center actions was observed.');
  const ended=results.filter(r=>r.mode==='practice'&&r.practiceEnded).length;
  lines.push('',`- Practice mode ended early in ${ended}/${results.filter(r=>r.mode==='practice').length} scenarios, which is expected when the moon attempt is broken.`);
  writeFileSync(join(root,'simulation','results','gameplay-latest.md'),lines.join('\n')+'\n');
  console.log(`gameplay-simulation: ${report.scenarioCount} scenarios complete; center-action collision scenarios=${report.collisionScenarios}`);
  if(collisions.length)process.exitCode=2;
}finally{
  chrome.kill('SIGTERM');if(chrome.exitCode===null)await once(chrome,'exit');server.close();
}
