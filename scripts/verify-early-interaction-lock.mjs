// Proves the opening-move/play-legality race is closed: #app starts inert in
// the static HTML itself (before any script runs), so no click - however
// early - can start a game before gameplay rule modules and access
// verification have both completed. This is the direct regression test for
// the bug class described in the app-layer rebuild plan, Phase 1: multiple
// files used to silently reassign the same globals (startFirstTrick,
// playCard) via a mix of static tags and access-gate.js dynamically
// injecting the canonical rule module, racing an unguarded newGameBtn click.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { once } from 'node:events';

const root=process.cwd();
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8']]);
function chromeBinary(){const bins=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);return bins.find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??(()=>{throw new Error('Chrome/Chromium is required for this verification');})();}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitForDebugPort(profile,chrome,stderr){const file=join(profile,'DevToolsActivePort');for(let i=0;i<150;i++){if(existsSync(file)){const port=Number(readFileSync(file,'utf8').split(/\r?\n/)[0]);if(Number.isInteger(port)&&port>0)return port;}if(chrome.exitCode!==null)throw new Error(`Chrome exited before DevTools started: ${stderr().slice(-1000)}`);await sleep(100);}throw new Error(`Chrome DevTools endpoint did not start: ${stderr().slice(-1000)}`);}
async function openTarget(port){const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});if(!r.ok)throw new Error(`Unable to create Chrome target (${r.status})`);return r.json();}
async function browserSession(port,label){
  const target=await openTarget(port);const ws=new WebSocket(target.webSocketDebuggerUrl);await Promise.race([once(ws,'open'),sleep(5000).then(()=>{throw new Error(`${label}: DevTools websocket did not open`);})]);
  let nextId=0;const pending=new Map();const exceptions=[];
  function failPending(error){for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(error);}pending.clear();}
  ws.addEventListener('close',()=>failPending(new Error(`${label}: DevTools target closed unexpectedly`)));
  ws.addEventListener('error',()=>failPending(new Error(`${label}: DevTools websocket failed`)));
  ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id&&pending.has(msg.id)){const {resolve,reject,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown'){exceptions.push(msg.params?.exceptionDetails?.exception?.description??msg.params?.exceptionDetails?.text??'uncaught browser exception');}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${label}: DevTools command timed out: ${method}`));},6000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result?.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result?.result?.value;};
  await send('Runtime.enable');await send('Page.enable');
  return{ws,exceptions,send,evaluate};
}
async function waitFor(evaluate,expression,label,{tries=100,delay=100}={}){for(let i=0;i<tries;i++){const value=await evaluate(expression);if(value)return value;await sleep(delay);}throw new Error(`${label}: condition did not become ready`);}

// Injected at document-creation time, before ANY of index.html's own scripts
// run - the earliest a real user's click could structurally land. Watches
// for #newGameBtn to exist (it's parsed early, well before the gameplay
// scripts at the bottom of <body> even start fetching) and fires a click on
// it the instant it appears, recording whether #app was inert at that moment
// and whether the click actually started a game.
const earlyClickProbe=`
  window.__earlyClick=null;
  const attempt=()=>{
    const btn=document.getElementById('newGameBtn');
    const app=document.getElementById('app');
    if(!btn||!app)return false;
    const wasInert=app.inert;
    btn.click();
    window.__earlyClick={wasInert,phaseRightAfter:typeof state!=='undefined'?state.phase:'no-state-yet',ulsAccessAtClick:document.documentElement.dataset.ulsAccess||'unchecked'};
    return true;
  };
  if(!attempt()){
    const observer=new MutationObserver(()=>{if(attempt())observer.disconnect();});
    observer.observe(document.documentElement||document,{childList:true,subtree:true});
  }
`;

function assert(ok,message){if(!ok)throw new Error(message);}

const server=createServer((req,res)=>{try{const requested=new URL(req.url,'http://localhost').pathname;if(requested==='/v1/domains/cancellation-hearts/access-preflight'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({domainId:'cancellation-hearts',packVersion:'0.1.0',operation:'access-preflight',requestId:'race-lock',correlationId:'race-lock',disposition:'completed',output:{authorized:true},provenanceRefs:['early-interaction-lock'],learning:{snapshotVersion:1,evidenceIds:[]}}));return;}if(requested.startsWith('/v1/domains/')){res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({status:'error',error:{code:'authorization-denied',retryable:false}}));return;}const rel=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));const clean=normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');const file=join(root,clean);if(!statSync(file).isFile())throw new Error('not file');res.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end('not found');}});
server.listen(0,'127.0.0.1');await once(server,'listening');const appPort=server.address().port;const profile=mkdtempSync(join(tmpdir(),'hearts-early-click-'));let chromeError='';const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});
try{
  const debugPort=await waitForDebugPort(profile,chrome,()=>chromeError);const baseUrl=`http://127.0.0.1:${appPort}`;
  const {ws,exceptions,send,evaluate}=await browserSession(debugPort,'early-interaction-lock');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:earlyClickProbe});
  await send('Page.navigate',{url:`${baseUrl}/`});

  const earlyClick=await waitFor(evaluate,'window.__earlyClick?JSON.stringify(window.__earlyClick):""','earliest-possible click');
  const parsed=JSON.parse(earlyClick);
  assert(parsed.wasInert===true,`#app must be inert at the earliest possible click - was ${parsed.wasInert}. If this fails, the race window described in the rebuild plan Phase 1 is open again.`);
  assert(parsed.phaseRightAfter==='no-state-yet'||parsed.phaseRightAfter==='idle',`earliest-possible click must not start a game while inert - observed phase ${parsed.phaseRightAfter}`);

  // Now wait for real access verification and gameplay module installation to
  // complete (the legitimate, unlocked path), then click for real.
  // unlock() now also waits for causal-loader.js's Tutor stack to settle
  // (Phase 6), so this needs the same margin as the tutor-specific waits.
  await waitFor(evaluate,`document.documentElement?.dataset?.ulsAccess==='active'&&window.__cancellationHeartsRuleInvariants?.installed===true&&window.__cancellationHeartsOpeningEnforcement?.installed===true`,'unlock + canonical rules installed',{tries:150});
  const inertAfterUnlock=await evaluate(`document.getElementById('app').inert`);
  assert(inertAfterUnlock===false,'app must no longer be inert once access unlocks');
  await evaluate(`document.getElementById('newGameBtn').click()`);
  await sleep(1500);

  const started=JSON.parse(await evaluate(`JSON.stringify({phase:typeof state!=='undefined'?state.phase:null,players:typeof state!=='undefined'?state.players?.length:null,resolvedViaCanonical:typeof state!=='undefined'?Number.isInteger(state.openingLeaderSeat):null})`));
  assert(['passing','playing'].includes(started.phase),`post-unlock click must start a game - phase was ${started.phase}`);
  assert(started.players===8,`post-unlock game must have eight players - got ${started.players}`);
  // Round 1's pass offset is +1 (not a hold), so most seeds land in 'passing'
  // first; the opening leader is only resolved once trick play begins. When
  // it does resolve, it must go through the canonical resolveOpeningLeader
  // path (which sets state.openingLeaderSeat) - never the old, unguarded
  // firstTwoClubsHolderLeftOfDealer fallback alone.
  if(started.phase==='playing')assert(started.resolvedViaCanonical===true,'opening leader must be resolved via the canonical resolveOpeningLeader path (state.openingLeaderSeat set)');
  if(exceptions.length)throw new Error(`uncaught browser exception: ${exceptions.join(' | ')}`);

  console.log('early-interaction-lock: earliest-possible click was blocked by #app being inert; unlock enables interaction; post-unlock game resolves via the canonical opening authority');
  ws.close();
}finally{chrome.kill('SIGTERM');if(chrome.exitCode===null)await once(chrome,'exit');server.close();}
