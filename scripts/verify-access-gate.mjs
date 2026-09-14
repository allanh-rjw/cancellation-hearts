import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { once } from 'node:events';

const root=process.cwd();
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8']]);
let authorized=false;
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function chromeBinary(){const bins=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);return bins.find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??(()=>{throw new Error('Chrome/Chromium is required');})();}
async function waitForDebugPort(profile,chrome,stderr){const file=join(profile,'DevToolsActivePort');for(let i=0;i<150;i++){if(existsSync(file)){const port=Number(readFileSync(file,'utf8').split(/\r?\n/)[0]);if(Number.isInteger(port)&&port>0)return port;}if(chrome.exitCode!==null)throw new Error(`Chrome exited before DevTools started: ${stderr().slice(-1000)}`);await sleep(100);}throw new Error('Chrome DevTools endpoint did not start');}
async function openTarget(port){const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});if(!r.ok)throw new Error(`Unable to create Chrome target (${r.status})`);return r.json();}
async function browserSession(port){const target=await openTarget(port);const ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');let nextId=0;const pending=new Map();ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id&&pending.has(msg.id)){const {resolve,reject,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result);}});const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`DevTools command timed out: ${method}`));},6000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result?.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result?.result?.value;};await send('Runtime.enable');await send('Page.enable');return{ws,send,evaluate};}
async function waitFor(evaluate,expression,label){for(let i=0;i<100;i++){const value=await evaluate(expression);if(value)return value;await sleep(100);}throw new Error(`${label}: condition did not become ready`);}

const server=createServer((req,res)=>{try{
  const requested=new URL(req.url,'http://localhost').pathname;
  if(requested==='/v1/domains/cancellation-hearts/access-preflight'){
    if(!authorized){res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({status:'error',error:{code:'authorization-denied',retryable:false}}));return;}
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({domainId:'cancellation-hearts',packVersion:'0.1.0',operation:'access-preflight',requestId:'gate-test',correlationId:'gate-test',disposition:'completed',output:{authorized:true},provenanceRefs:['gate-test'],learning:{snapshotVersion:1,evidenceIds:[]}}));return;
  }
  if(requested.startsWith('/v1/domains/')){res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({status:'error',error:{code:'authorization-denied',retryable:false}}));return;}
  const rel=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));const clean=normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');const file=join(root,clean);if(!statSync(file).isFile())throw new Error('not file');res.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(file));
}catch{res.writeHead(404);res.end('not found');}});

server.listen(0,'127.0.0.1');await once(server,'listening');const appPort=server.address().port;const baseUrl=`http://127.0.0.1:${appPort}`;const profile=mkdtempSync(join(tmpdir(),'hearts-access-gate-'));let chromeError='';const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});
try{
  const debugPort=await waitForDebugPort(profile,chrome,()=>chromeError);
  {
    const {ws,send,evaluate}=await browserSession(debugPort);await send('Page.navigate',{url:baseUrl});
    await waitFor(evaluate,`document.documentElement.dataset.ulsAccess==='denied'`,'revoked learner');
    const snapshot=JSON.parse(await evaluate(`JSON.stringify({gate:document.documentElement.dataset.ulsAccess,overlay:document.getElementById('ulsAccessGate')?.textContent??'',hidden:document.getElementById('app')?.getAttribute('aria-hidden'),inert:document.getElementById('app')?.inert})`));
    if(snapshot.gate!=='denied'||snapshot.hidden!=='true'||snapshot.inert!==true)throw new Error(`revoked learner: app did not fail closed ${JSON.stringify(snapshot)}`);
    if(!snapshot.overlay.includes('access is not active'))throw new Error(`revoked learner: denial message missing ${snapshot.overlay}`);
    ws.close();
  }
  authorized=true;
  {
    const {ws,send,evaluate}=await browserSession(debugPort);await send('Page.navigate',{url:baseUrl});
    await waitFor(evaluate,`document.documentElement.dataset.ulsAccess==='active'`,'active learner');
    const snapshot=JSON.parse(await evaluate(`JSON.stringify({gate:document.documentElement.dataset.ulsAccess,overlay:!!document.getElementById('ulsAccessGate'),hidden:document.getElementById('app')?.getAttribute('aria-hidden'),inert:document.getElementById('app')?.inert})`));
    if(snapshot.gate!=='active'||snapshot.overlay||snapshot.hidden==='true'||snapshot.inert===true)throw new Error(`active learner: app did not unlock ${JSON.stringify(snapshot)}`);
    ws.close();
  }
  console.log('access-gate: revoked learner fails closed; active learner unlocks');
}finally{chrome.kill('SIGTERM');if(chrome.exitCode===null)await once(chrome,'exit');server.close();}
