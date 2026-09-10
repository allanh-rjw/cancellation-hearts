import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { once } from 'node:events';

const root=process.cwd();
const indexHtml=readFileSync(join(root,'index.html'),'utf8');
for(const asset of ['style.css','app.js','learning-gateway-runtime.js','causal-loader.js']){
  if(!indexHtml.includes(`${asset}?v=`)) throw new Error(`Browser asset is not cache-versioned: ${asset}`);
}
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8']]);
function chromeBinary(){const bins=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);return bins.find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??(()=>{throw new Error('Chrome/Chromium is required for browser startup verification');})();}
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
async function inspectOrdinaryMode(port,baseUrl,mode){
  const {ws,exceptions,send,evaluate}=await browserSession(port,mode);
  await send('Page.navigate',{url:`${baseUrl}/?learningMode=${mode}`});
  const raw=await waitFor(evaluate,`(()=>{const r=window.CancellationHeartsLearningRuntime?.status?.();if(document.readyState!=='complete'||!r)return '';return JSON.stringify({setup:!!document.getElementById('setup'),setupHidden:document.getElementById('setup')?.classList.contains('hidden')??null,passwordGate:!!document.getElementById('passwordGate'),appHidden:document.getElementById('app')?.getAttribute('aria-hidden')??null,gateway:window.__cancellationHeartsLearningGateway??null,runtime:r});})()`,`${mode} startup`);
  const snapshot=JSON.parse(raw);
  if(!snapshot.setup||snapshot.setupHidden)throw new Error(`${mode}: setup screen did not initialize`);
  if(snapshot.passwordGate)throw new Error(`${mode}: obsolete password gate is still present`);
  if(snapshot.appHidden==='true')throw new Error(`${mode}: application remains aria-hidden`);
  if(snapshot.gateway?.status==='initialization-failed')throw new Error(`${mode}: Learning Gateway bootstrap failed`);
  if(snapshot.gateway?.defaultMode!=='legacy')throw new Error(`${mode}: production default drifted from legacy`);
  if(snapshot.runtime?.mode!==mode)throw new Error(`${mode}: requested migration mode did not initialize`);
  if(exceptions.length)throw new Error(`${mode}: uncaught browser exception before game start: ${exceptions.join(' | ')}`);
  await evaluate(`document.getElementById('newGameBtn').click()`);
  await sleep(3200);
  const started=JSON.parse(await evaluate(`JSON.stringify({setupHidden:document.getElementById('setup')?.classList.contains('hidden')??null,gameHidden:document.getElementById('game')?.classList.contains('hidden')??null,players:typeof state!=='undefined'?state.players?.length:null,phase:typeof state!=='undefined'?state.phase:null,causal:window.__causalPlannerLoaded??null,tutorLoaded:window.__adaptiveTutorLoaded??null,tutorInitialized:window.CancellationHeartsTutor?.isInitialized?.()??null,coreCount:window.CancellationHeartsTutor?.coreConstructionCount?.()??null})`));
  if(started.setupHidden!==true)throw new Error(`${mode}: setup remained visible after Start New Game`);
  if(started.gameHidden!==false)throw new Error(`${mode}: game did not remain visible after Start New Game`);
  if(started.players!==8)throw new Error(`${mode}: game did not initialize eight players`);
  if(!['passing','playing'].includes(started.phase))throw new Error(`${mode}: unexpected post-start phase ${started.phase}`);
  if(started.tutorLoaded!==true)throw new Error(`${mode}: Tutor capability did not finish loading during post-start window`);
  if(started.tutorInitialized!==false||started.coreCount!==0)throw new Error(`${mode}: ordinary game startup initialized Tutor core`);
  if(exceptions.length)throw new Error(`${mode}: uncaught browser exception after game start: ${exceptions.join(' | ')}`);
  console.log(`${mode}: ordinary Start New Game stable; phase=${started.phase}; Tutor core count=0`);ws.close();
}
async function inspectTutorMode(port,baseUrl){
  const label='tutor';const {ws,exceptions,send,evaluate}=await browserSession(port,label);
  await send('Page.navigate',{url:`${baseUrl}/?learningMode=legacy`});
  await waitFor(evaluate,`window.__adaptiveTutorLoaded===true&&!!window.CancellationHeartsTutor&&!!document.querySelector('#gameMode option[value="tutor"]')`,label,{tries:150});
  const before=JSON.parse(await evaluate(`JSON.stringify({initialized:window.CancellationHeartsTutor.isInitialized(),count:window.CancellationHeartsTutor.coreConstructionCount(),tutorHidden:document.getElementById('tutorRoot')?.classList.contains('hidden')??null})`));
  if(before.initialized!==false||before.count!==0)throw new Error('tutor: core initialized before user entered Tutor mode');
  await evaluate(`(()=>{const mode=document.getElementById('gameMode');mode.value='tutor';mode.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('newGameBtn').click();return true;})()`);
  await sleep(1000);
  const after=JSON.parse(await evaluate(`JSON.stringify({initialized:window.CancellationHeartsTutor.isInitialized(),count:window.CancellationHeartsTutor.coreConstructionCount(),tutorHidden:document.getElementById('tutorRoot')?.classList.contains('hidden')??null,setupHidden:document.getElementById('setup')?.classList.contains('hidden')??null,diagnostic:window.CancellationHeartsTutor.core?.state?.diagnostic??null,bodyText:document.getElementById('tutorBody')?.textContent??''})`));
  if(after.initialized!==true||after.count!==1)throw new Error(`tutor: expected one real core construction, received ${after.count}`);
  if(after.tutorHidden!==false||after.setupHidden!==true)throw new Error('tutor: Tutor UI did not replace setup');
  if(after.diagnostic?.completed!==false)throw new Error('tutor: opening diagnostic did not start');
  if(!after.bodyText.includes('Opening diagnostic'))throw new Error('tutor: diagnostic UI is not visible');
  await evaluate(`window.CancellationHeartsTutor.start()`);await sleep(150);
  const repeated=JSON.parse(await evaluate(`JSON.stringify({count:window.CancellationHeartsTutor.coreConstructionCount(),initialized:window.CancellationHeartsTutor.isInitialized()})`));
  if(repeated.count!==1||repeated.initialized!==true)throw new Error('tutor: repeated start constructed another core');
  if(exceptions.length)throw new Error(`tutor: uncaught browser exception: ${exceptions.join(' | ')}`);
  console.log('tutor: real user entry initialized one core, opened diagnostic, repeated start remained idempotent');ws.close();
}
const server=createServer((req,res)=>{try{const requested=new URL(req.url,'http://localhost').pathname;if(requested.startsWith('/v1/domains/')){res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({code:'authorization-denied'}));return;}const rel=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));const clean=normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');const file=join(root,clean);if(!statSync(file).isFile())throw new Error('not file');res.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end('not found');}});
server.listen(0,'127.0.0.1');await once(server,'listening');const appPort=server.address().port;const profile=mkdtempSync(join(tmpdir(),'hearts-browser-startup-'));let chromeError='';const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});
try{const debugPort=await waitForDebugPort(profile,chrome,()=>chromeError);const baseUrl=`http://127.0.0.1:${appPort}`;for(const mode of ['legacy','parity'])await inspectOrdinaryMode(debugPort,baseUrl,mode);await inspectTutorMode(debugPort,baseUrl);console.log('browser-startup: legacy + parity ordinary gameplay stable; Tutor core is lazy and single-construction');}finally{chrome.kill('SIGTERM');if(chrome.exitCode===null)await once(chrome,'exit');server.close();}
