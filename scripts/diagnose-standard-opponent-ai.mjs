import {createServer} from 'node:http';
import {spawn, spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {extname, join, normalize} from 'node:path';
import {once} from 'node:events';

const root=process.cwd();
const verify=process.argv.includes('--verify');
const dealsArg=process.argv.find(x=>x.startsWith('--deals='));
const pairedDeals=dealsArg?Number(dealsArg.split('=')[1]):verify?2:12;
const cycleArg=process.argv.find(x=>x.startsWith('--cycle='))?.split('=')[1]??'full';
const seedBaseArg=process.argv.find(x=>x.startsWith('--seed-base='));
const seedBase=seedBaseArg?Number(seedBaseArg.split('=')[1]):2026091800;
if(!Number.isInteger(pairedDeals)||pairedDeals<1) throw new Error('--deals must be a positive integer');
if(!['full','hold','passing'].includes(cycleArg))throw new Error('--cycle must be full, hold, or passing');
if(!Number.isInteger(seedBase))throw new Error('--seed-base must be an integer');

const PASS_CYCLE=[1,-1,2,-2,3,-3,4,0];
const ACTIVE_OFFSETS=cycleArg==='hold'?[0]:cycleArg==='passing'?PASS_CYCLE.slice(0,7):PASS_CYCLE;
const mime=new Map([['.html','text/html'],['.js','text/javascript'],['.css','text/css']]);
const fail=message=>{throw new Error(message);};

function chromeBinary(){
  return [process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser']
    .filter(Boolean).find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??null;
}
async function waitForPort(profile,chrome,stderr){
  const file=join(profile,'DevToolsActivePort');
  for(let i=0;i<150;i++){
    if(existsSync(file)) return Number(readFileSync(file,'utf8').split(/\r?\n/)[0]);
    if(chrome.exitCode!==null) fail(`Chrome exited before DevTools started: ${stderr().slice(-1000)}`);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  fail('Chrome DevTools endpoint did not start');
}
async function browserSession(port){
  const target=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await once(ws,'open');
  let nextId=0;
  const pending=new Map();
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(!message.id||!pending.has(message.id)) return;
    const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
    message.error?reject(new Error(message.error.message)):resolve(message.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);
    return response.result.value;
  };
  await send('Runtime.enable');await send('Page.enable');
  return {ws,send,evaluate};
}

const server=createServer((request,response)=>{
  try{
    const requested=new URL(request.url,'http://localhost').pathname;
    if(requested==='/v1/domains/cancellation-hearts/access-preflight'){
      response.writeHead(200,{'content-type':'application/json'});
      response.end(JSON.stringify({output:{authorized:true}}));return;
    }
    const relative=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));
    const clean=normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
    const file=join(root,clean);
    if(!statSync(file).isFile()) throw new Error('not a file');
    response.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});
    response.end(readFileSync(file));
  }catch{response.writeHead(404);response.end('not found');}
});

const diagnosticRuntime=String.raw`
(()=>{
  const seeded=seed=>{let value=seed>>>0;return()=>((value=Math.imul(value,1664525)+1013904223>>>0)/4294967296);};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const label=card=>card.rank+card.suit;
  const policyFor=(seat,currentSeats)=>currentSeats.has(seat)?'current':'legacy';
  playCardSound=()=>{};

  function legacyChoose(i){
    const legal=legalCards(i),player=state.players[i],profile=difficultyProfile(),saved=standardMoonThreat;
    standardMoonThreat=(collectors,concentrated,repeatedControl)=>collectors.length<=2&&
      (concentrated>=profile.moonThreshold||repeatedControl>=2||state.trickNumber>=2);
    const ranked=legal.map(card=>({card,score:evaluateCard(i,card,player.persona)+practiceDefenseAdjustment(i,card)+
      futureHandScore(i,card)+scoreAwareAdjustment(i,card)+advancedInferenceAdjustment(i,card)}))
      .sort((a,b)=>b.score-a.score);
    standardMoonThreat=saved;
    return ranked[0].card;
  }
  function legacyPass(player){
    const counts=Object.fromEntries(SUITS.map(suit=>[suit,player.hand.filter(card=>card.suit===suit).length]));
    return [...player.hand].sort((a,b)=>passScore(b,player.persona,counts,player)-passScore(a,player.persona,counts,player)).slice(0,3);
  }
  function reset(seed,offset,currentSeats){
    Math.random=seeded(seed);
    state.mode='standard';state.difficulty='expert';state.target=999999;state.round=1;state.passOffset=offset;
    state.players=Array.from({length:8},(_,i)=>({name:'P'+i,persona:PERSONAS[i%PERSONAS.length],score:i*3,roundPoints:0,hand:[],tricks:[]}));
    Object.assign(state,{dealer:seed%8,currentPlayer:0,leader:0,trick:[],trickNumber:0,heartsBroken:false,phase:'passing',
      gameOver:false,carryoverPoints:0,carryoverCards:[],openingAutoPlayers:new Set(),openingLeadSuit:null,opponentPlans:{},
      opponentDiagnostics:null,actionLog:[],opponentHistory:{},selected:new Set(),
      learningProfile:{version:1,games:0,hands:0,persona:{},defenseBoost:0,targetingBoost:0,passingBoost:0}});
    const deck=shuffle(makeDeck());
    for(let i=0;i<deck.length;i++)state.players[i%8].hand.push(deck[i]);
    state.players.forEach(player=>sortHand(player.hand));
    const dealt=state.players.map(player=>clone(player.hand));
    state.__diagnosticPass={passes:[],provisional:{}};
    if(offset){
      for(const i of currentSeats)state.__diagnosticPass.provisional[i]=strategyAssessment(humanHandMetrics(i),i).strategy;
      const passes=state.players.map((player,i)=>{
        Math.random=seeded(seed^(0x51f15e+i*0x9e37));
        return policyFor(i,currentSeats)==='current'?choosePassCards(player):legacyPass(player);
      });
      state.__diagnosticPass.passes=passes.map(cards=>clone(cards));
      for(let i=0;i<8;i++)for(const card of passes[i])state.players[i].hand.splice(state.players[i].hand.findIndex(x=>x.id===card.id),1);
      for(let i=0;i<8;i++)state.players[(i+offset+8)%8].hand.push(...passes[i]);
      state.players.forEach(player=>sortHand(player.hand));
      state.opponentPlans={};
    }
    return dealt;
  }
  function projectedOutcome(i,card){
    const fake=[...state.trick.map(x=>({...x})),{player:i,card,cancelled:false}];resolveFakeCancellation(fake);
    const led=currentLedSuit()||card.suit,eligible=fake.filter(x=>x.card.suit===led&&!x.cancelled);
    return {winner:eligible.length?eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b).player:null,
      points:state.carryoverPoints+fake.reduce((sum,x)=>sum+cardPoints(x.card),0)};
  }
  function observeDecision(i,card,currentSeats,metrics,traces){
    const policy=policyFor(i,currentSeats),legal=legalCards(i),chosen=projectedOutcome(i,card);
    const alternatives=legal.map(candidate=>({card:candidate,...projectedOutcome(i,candidate)}));
    const plan=policy==='current'?opponentStrategyPlan(i):null;
    const row=metrics[policy];row.decisions++;
    if(plan){
      row.phases[plan.phase]=(row.phases[plan.phase]||0)+1;
      row.strategies[plan.strategy]=(row.strategies[plan.strategy]||0)+1;
      const strategyRow=row.byStrategy[plan.strategy]??={decisions:0,avoidableLoadedCaptures:0,unnecessaryLeadAcquisitions:0};
      strategyRow.decisions++;
    }
    const loaded=chosen.points>0;
    if(loaded&&chosen.winner===i&&alternatives.some(x=>x.winner!==i)){
      row.avoidableLoadedCaptures++;
      if(plan)row.byStrategy[plan.strategy].avoidableLoadedCaptures++;
      traces.push({category:'tactical',policy,seat:i,trick:state.trickNumber+1,play:label(card),strategy:plan?.strategy??null,
        phase:plan?.phase??null,objective:plan?.pathway?.objective??null,reason:'captured a loaded trick when a legal card avoided it'});
    }
    if(loaded&&chosen.winner===i&&alternatives.every(x=>x.winner===i)){
      row.unavoidableLoadedCaptures++;
      traces.push({category:'unavoidable',policy,seat:i,trick:state.trickNumber+1,play:label(card),strategy:plan?.strategy??null,
        reason:'every legal card captured the loaded trick'});
    }
    if(!loaded&&chosen.winner===i&&alternatives.some(x=>x.winner!==i)){
      row.unnecessaryLeadAcquisitions++;
      if(plan)row.byStrategy[plan.strategy].unnecessaryLeadAcquisitions++;
      traces.push({category:'pathway',policy,seat:i,trick:state.trickNumber+1,play:label(card),strategy:plan?.strategy??null,
        phase:plan?.phase??null,objective:plan?.pathway?.objective??null,reason:'acquired a point-free lead despite a legal losing play'});
    }
    const safeHigher=alternatives.some(x=>x.winner!==i&&RANK_VALUE[x.card.rank]>RANK_VALUE[card.rank]);
    if(chosen.winner!==i&&RANK_VALUE[card.rank]<=6&&safeHigher){
      row.earlyExitsSpent++;
      traces.push({category:'pathway',policy,seat:i,trick:state.trickNumber+1,play:label(card),strategy:plan?.strategy??null,
        phase:plan?.phase??null,objective:plan?.pathway?.objective??null,reason:'spent a low exit while a higher legal card also lost'});
    }
    if(state.trick.some(x=>x.card.suit===card.suit&&x.card.rank===card.rank)){
      const led=currentLedSuit(),eligible=state.trick.filter(x=>x.card.suit===led&&!x.cancelled);
      const before=eligible.length?eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b).player:null;
      if(chosen.winner!==before)row.cancellationPromotions++;
    }
    if(plan?.strategy==='targeting'&&loaded){
      const target=plan.target;
      if(alternatives.some(x=>x.winner===target)){
        row.targetingAttempts++;
        if(chosen.winner===target)row.targetingHits++;
        else traces.push({category:'pathway',policy,seat:i,trick:state.trickNumber+1,play:label(card),strategy:plan.strategy,
          phase:plan.phase,objective:plan.pathway?.objective??null,reason:'missed a legal opportunity to place points on the intended target'});
      }
    }
  }
  function emptyMetrics(){
    return {decisions:0,points:0,selectionFailures:0,selectionFailuresByStrategy:{},avoidableLoadedCaptures:0,unavoidableLoadedCaptures:0,unnecessaryLeadAcquisitions:0,earlyExitsSpent:0,
      cancellationPromotions:0,targetingAttempts:0,targetingHits:0,voidPlans:0,voidsCompleted:0,entryCardsPreserved:0,
      exitCardsPreserved:0,dangerousWinnersRetained:0,moonAttempts:0,pivots:0,pathwayTransitions:0,passPenaltyPoints:0,
      passHighCards:0,receivedPenaltyPoints:0,postPassStrategyChanges:0,aggressiveToAvoidance:0,phases:{},strategies:{},byStrategy:{}};
  }
  function postHand(initialHands,currentSeats,metrics,traces){
    for(let i=0;i<8;i++){
      const policy=policyFor(i,currentSeats),row=metrics[policy],plan=state.opponentPlans[i];
      row.points+=state.players[i].roundPoints;
      if(policy==='current'&&plan){
        row.voidPlans++;
        const suit=plan.voidCandidate;
        if(state.actionLog.some((action,index)=>action.player===i&&action.card.suit===suit&&
          !state.actionLog.slice(index+1).some(later=>later.player===i&&later.card.suit===suit)))row.voidsCompleted++;
        row.pivots+=plan.pivots.length;
        row.pathwayTransitions+=plan.transitions?.length||0;
        if(['soloMoon','twoMoon'].includes(plan.originalStrategy))row.moonAttempts++;
        const strategyRow=row.byStrategy[plan.originalStrategy]??={decisions:0,avoidableLoadedCaptures:0,unnecessaryLeadAcquisitions:0};
        strategyRow.hands=(strategyRow.hands??0)+1;strategyRow.points=(strategyRow.points??0)+state.players[i].roundPoints;
      }
      const entries=initialHands[i].filter(card=>RANK_VALUE[card.rank]>=11);
      const exits=initialHands[i].filter(card=>RANK_VALUE[card.rank]<=6&&card.suit!=='H');
      const lastFour=state.actionLog.filter(action=>action.player===i).slice(-4).map(action=>action.card.id);
      row.entryCardsPreserved+=entries.filter(card=>lastFour.includes(card.id)).length;
      row.exitCardsPreserved+=exits.filter(card=>lastFour.includes(card.id)).length;
      const retained=state.actionLog.filter(action=>action.player===i).slice(-3).filter(action=>RANK_VALUE[action.card.rank]>=11).length;
      row.dangerousWinnersRetained+=retained;
      if(plan&&!plan.voidCandidate)traces.push({category:'selection',policy,seat:i,reason:'strategy lacked an intended void'});
    }
  }
  function runHand(seed,offset,currentSeatList,traceEnabled=true){
    const currentSeats=new Set(currentSeatList),metrics={current:emptyMetrics(),legacy:emptyMetrics()},traces=[];
    const dealt=reset(seed,offset,currentSeats),initialHands=state.players.map(player=>clone(player.hand));
    if(traceEnabled)state.opponentDiagnostics={enabled:true,shadowPolicy:'greedy',rows:[]};
    const strategyEvidence=Object.fromEntries([...currentSeats].map(i=>{const plan=opponentStrategyPlan(i),m=humanHandMetrics(i);return [i,{strategy:plan.strategy,
      evidence:plan.evidence,facts:plan.facts,control:m.control,hearts:m.hearts.length,pairs:m.pairs.length,voidCandidate:m.voidCandidate,exits:m.exits.length}];}));
    for(const [seat,evidence] of Object.entries(strategyEvidence)){
      if(evidence.evidence?.length)continue;
      metrics.current.selectionFailures++;
      metrics.current.selectionFailuresByStrategy[evidence.strategy]=(metrics.current.selectionFailuresByStrategy[evidence.strategy]||0)+1;
      traces.push({category:'selection',policy:'current',seat:Number(seat),strategy:evidence.strategy,reason:'selected strategy had no recorded evidence'});
    }
    if(offset)for(let i=0;i<8;i++){
      const policy=policyFor(i,currentSeats),row=metrics[policy],passed=state.__diagnosticPass.passes[i]||[];
      row.passPenaltyPoints+=passed.reduce((sum,card)=>sum+cardPoints(card),0);
      row.passHighCards+=passed.filter(card=>RANK_VALUE[card.rank]>=11).length;
      const source=(i-offset+8)%8;
      row.receivedPenaltyPoints+=(state.__diagnosticPass.passes[source]||[]).reduce((sum,card)=>sum+cardPoints(card),0);
      if(policy==='current'){
        const before=state.__diagnosticPass.provisional[i],after=strategyEvidence[i]?.strategy;
        if(before!==after)row.postPassStrategyChanges++;
        if(before&&before!=='avoidance'&&after==='avoidance')row.aggressiveToAvoidance++;
      }
    }
    state.phase='playing';state.leader=firstTwoClubsHolderLeftOfDealer();state.currentPlayer=state.leader;state.openingLeadSuit='C';
    for(let trick=0;trick<13;trick++){
      while(state.trick.length<8){
        const i=state.currentPlayer,policy=policyFor(i,currentSeats);
        Math.random=seeded(seed^((trick+1)*0x45d9f3b)^(state.trick.length*0x9e3779b)^(i*0x27d4eb2));
        const card=policy==='current'?chooseAiCard(i):legacyChoose(i);
        observeDecision(i,card,currentSeats,metrics,traces);playCard(i,card);
      }
      if(trick<12)startTrick();
    }
    postHand(initialHands,currentSeats,metrics,traces);
    const initialStrategies=Object.fromEntries(Object.entries(state.opponentPlans).map(([i,p])=>[i,p.originalStrategy]));
    const decisionTraces=clone(state.opponentDiagnostics?.rows||[]),plays=state.actionLog.map(x=>x.card.id);
    return {seed,offset,currentSeats:currentSeatList,metrics,traces,decisionTraces,plays,
      points:state.players.map(p=>p.roundPoints),initialStrategies,strategyEvidence,dealt};
  }
  window.__opponentDiagnostic={runHand};
})()`;

function merge(target,source){
  for(const [key,value] of Object.entries(source)){
    if(typeof value==='number')target[key]=(target[key]??0)+value;
    else if(value&&typeof value==='object')merge(target[key]??={},value);
  }
}
function confidence95(values){
  const mean=values.reduce((sum,x)=>sum+x,0)/values.length;
  if(values.length<2)return [mean,mean];
  const variance=values.reduce((sum,x)=>sum+(x-mean)**2,0)/(values.length-1);
  const margin=1.96*Math.sqrt(variance/values.length);
  return [mean-margin,mean+margin];
}
function firstDifference(a,b,path='summary'){
  if(Object.is(a,b))return null;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path,a,b};
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    const difference=firstDifference(a[key],b[key],`${path}.${key}`);
    if(difference)return difference;
  }
  return null;
}
function summarizeDecisionTraces(hands){
  const traces=hands.flatMap(hand=>hand.decisionTraces.map(row=>({...row,offset:hand.offset})));
  const summarize=rows=>({decisions:rows.length,disagreements:rows.filter(x=>!x.agreement).length,
    agreementRate:rows.length?rows.filter(x=>x.agreement).length/rows.length:1,
    currentImmediateRisk:rows.reduce((sum,x)=>sum+x.selected.immediateRisk,0),
    shadowImmediateRisk:rows.reduce((sum,x)=>sum+x.shadow.immediateRisk,0),
    currentSafeExitLosses:rows.filter(x=>!x.selected.preservesSafeExit).length,
    shadowSafeExitLosses:rows.filter(x=>!x.shadow.preservesSafeExit).length,
    currentCancellationExposure:rows.filter(x=>x.selected.cancellation==='exposure').length,
    shadowCancellationExposure:rows.filter(x=>x.shadow.cancellation==='exposure').length,
    currentCarriedPenaltyExposure:rows.reduce((sum,x)=>sum+x.selected.carriedPenaltyExposure,0),
    shadowCarriedPenaltyExposure:rows.reduce((sum,x)=>sum+x.shadow.carriedPenaltyExposure,0)});
  const grouped=key=>Object.fromEntries([...new Set(traces.map(key))].map(value=>[value,summarize(traces.filter(row=>key(row)===value))]));
  return {overall:summarize(traces),byTrick:grouped(x=>x.trick),byPersona:grouped(x=>x.persona),
    byStrategy:grouped(x=>x.strategy??'none'),byPassDirection:grouped(x=>x.offset),bySeat:grouped(x=>x.seat)};
}
function summarize(hands){
  const aggregate={current:{},legacy:{}},handAdvantages=[],traces=[];
  for(const hand of hands){
    merge(aggregate.current,hand.metrics.current);merge(aggregate.legacy,hand.metrics.legacy);
    handAdvantages.push(hand.metrics.legacy.points-hand.metrics.current.points);
    traces.push(...hand.traces.map(trace=>({...trace,seed:hand.seed,offset:hand.offset})));
  }
  const pairedAdvantages=[];
  for(let i=0;i<handAdvantages.length;i+=2)pairedAdvantages.push((handAdvantages[i]+handAdvantages[i+1])/2);
  const mean=pairedAdvantages.reduce((sum,x)=>sum+x,0)/pairedAdvantages.length;
  const categories=['selection','pathway','tactical','unavoidable'];
  const byOffset={};
  for(const offset of [...new Set(hands.map(hand=>hand.offset))]){
    const rows=hands.filter(hand=>hand.offset===offset),values=[];
    for(let i=0;i<rows.length;i+=2)values.push(((rows[i].metrics.legacy.points-rows[i].metrics.current.points)+
      (rows[i+1].metrics.legacy.points-rows[i+1].metrics.current.points))/2);
    byOffset[offset]={pairedSamples:values.length,meanPointAdvantagePerTeamHand:values.reduce((sum,x)=>sum+x,0)/values.length,confidence95:confidence95(values)};
  }
  return {pairedDeals,cycle:cycleArg,seedBase,passingOffsets:ACTIVE_OFFSETS,hands:hands.length,aggregate,
    comparison:{meanPointAdvantagePerTeamHand:mean,confidence95:confidence95(pairedAdvantages),pairedSamples:pairedAdvantages.length,
      currentLoadedCaptureReduction:aggregate.legacy.avoidableLoadedCaptures?
        1-aggregate.current.avoidableLoadedCaptures/aggregate.legacy.avoidableLoadedCaptures:null},
    shadowDiagnostics:summarizeDecisionTraces(hands),
    failureCategories:Object.fromEntries(categories.map(category=>[category,traces.filter(x=>x.category===category).length])),
    byOffset,strategyEvidenceSamples:hands.slice(0,4).map(({seed,offset,strategyEvidence})=>({seed,offset,strategyEvidence})),
    representativeFailures:categories.flatMap(category=>traces.filter(x=>x.category===category).slice(0,8))};
}

async function executeDiagnostic(evaluate){
  const run=async()=>{
    const hands=[];
    for(let deal=0;deal<pairedDeals;deal++)for(const offset of cycleArg==='passing'?[ACTIVE_OFFSETS[deal%ACTIVE_OFFSETS.length]]:ACTIVE_OFFSETS){
      const seed=seedBase+deal*31+PASS_CYCLE.indexOf(offset);
      const seats=Array.from({length:8},(_,i)=>i).filter(i=>(i+deal)%2===0);
      for(const currentSeats of [seats,Array.from({length:8},(_,i)=>i).filter(i=>!seats.includes(i))]){
        hands.push(await evaluate(`window.__opponentDiagnostic.runHand(${seed},${offset},${JSON.stringify(currentSeats)})`));
      }
    }
    return hands;
  };
  const hands=await run();
  if(verify){
    const repeated=await run();
    const deals=rows=>rows.map(({seed,offset,currentSeats,dealt})=>({seed,offset,currentSeats,dealt}));
    if(JSON.stringify(deals(hands))!==JSON.stringify(deals(repeated)))fail('diagnostic deals are not deterministic');
    if(hands.some(hand=>hand.points.reduce((sum,x)=>sum+x,0)!==52))fail('a diagnostic hand did not account for 52 points');
    if(hands.some(hand=>hand.metrics.current.decisions!==52||hand.metrics.legacy.decisions!==52))fail('a diagnostic hand did not record 104 decisions');
    if(hands.some(hand=>hand.decisionTraces.length!==52))fail('a diagnostic hand did not trace every current-policy decision');
    const summaryDifference=firstDifference(summarizeDecisionTraces(hands),summarizeDecisionTraces(repeated));
    if(summaryDifference)fail(`shadow diagnostic summary is not deterministic: ${JSON.stringify(summaryDifference)}`);
    const sample=hands[0],withoutTrace=await evaluate(`window.__opponentDiagnostic.runHand(${sample.seed},${sample.offset},${JSON.stringify(sample.currentSeats)},false)`);
    if(JSON.stringify({points:sample.points,plays:sample.plays})!==JSON.stringify({points:withoutTrace.points,plays:withoutTrace.plays}))
      fail('shadow diagnostics changed gameplay or consumed production randomness');
    console.log(`standard-opponent-diagnostic: ${hands.length} deterministic hands passed`);
  }else console.log(JSON.stringify(summarize(hands),null,2));
}

const chromePath=chromeBinary();
if(chromePath){
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const profile=mkdtempSync(join(tmpdir(),'hearts-opponent-diagnostic-'));
  let chromeError='';
  const chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});
  try{
    const port=await waitForPort(profile,chrome,()=>chromeError);
    const {ws,send,evaluate}=await browserSession(port);
    await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.setTimeout=()=>0;window.clearTimeout=()=>{};'});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?learningMode=legacy`});
    for(let i=0;i<100;i++){
      if(await evaluate("document.readyState==='complete'&&typeof chooseAiCard==='function'"))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    await evaluate(diagnosticRuntime);await executeDiagnostic(evaluate);ws.close();
  }finally{chrome.kill('SIGTERM');server.close();}
}else{
  const modulePath=process.env.HEARTS_DOM_MODULE;
  if(!modulePath)fail('Chrome/Chromium is required (or set HEARTS_DOM_MODULE to happy-dom/lib/index.js)');
  const {Window}=await import(modulePath);
  const window=new Window({url:'http://localhost/?learningMode=legacy'});
  const html=readFileSync(join(root,'index.html'),'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
  window.document.write(html);window.setTimeout=()=>0;window.clearTimeout=()=>{};
  for(const dialog of window.document.querySelectorAll('dialog')){dialog.showModal=function(){};dialog.close=function(){};}
  const sources=['app.js','gameplay-standard-fixes.js','gameplay-moon-fixes.js','gameplay-moon-calibration.js']
    .map(file=>readFileSync(join(root,file),'utf8'));
  window.eval(`${sources.join('\n')}\n${diagnosticRuntime}`);
  await executeDiagnostic(expression=>Promise.resolve(window.eval(expression)));
}
