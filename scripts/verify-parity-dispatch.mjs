import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { once } from 'node:events';

const root=process.cwd();
const mime=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8']]);
const gatewayRequests=[];
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function chromeBinary(){const bins=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);return bins.find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??(()=>{throw new Error('Chrome/Chromium is required');})();}
async function waitForDebugPort(profile,chrome,stderr){const file=join(profile,'DevToolsActivePort');for(let i=0;i<150;i++){if(existsSync(file)){const port=Number(readFileSync(file,'utf8').split(/\r?\n/)[0]);if(Number.isInteger(port)&&port>0)return port;}if(chrome.exitCode!==null)throw new Error(`Chrome exited before DevTools started: ${stderr().slice(-1000)}`);await sleep(100);}throw new Error('Chrome DevTools endpoint did not start');}
async function openTarget(port){const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});if(!r.ok)throw new Error(`Unable to create Chrome target (${r.status})`);return r.json();}

const server=createServer((req,res)=>{try{
  const requested=new URL(req.url,'http://localhost').pathname;
  if(requested.startsWith('/v1/domains/')){
    gatewayRequests.push({method:req.method,path:requested});
    res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({code:'authorization-denied'}));
    return;
  }
  const rel=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));
  const clean=normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const file=join(root,clean);
  if(!statSync(file).isFile())throw new Error('not file');
  res.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});
  res.end(readFileSync(file));
}catch{res.writeHead(404);res.end('not found');}});

server.listen(0,'127.0.0.1');await once(server,'listening');
const appPort=server.address().port;
const profile=mkdtempSync(join(tmpdir(),'hearts-parity-dispatch-'));
let chromeError='';
const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
chrome.stderr.on('data',chunk=>{chromeError+=String(chunk);});

try{
  const debugPort=await waitForDebugPort(profile,chrome,()=>chromeError);
  const target=await openTarget(debugPort);
  const ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');
  let nextId=0;const pending=new Map();
  ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id&&pending.has(msg.id)){const {resolve,reject,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`DevTools command timed out: ${method}`));},6000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result?.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result?.result?.value;};
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url:`http://127.0.0.1:${appPort}/?learningMode=parity`});
  for(let i=0;i<100;i++){const mode=await evaluate(`window.CancellationHeartsLearningRuntime?.status?.().mode??null`);if(mode==='parity')break;await sleep(100);if(i===99)throw new Error('Parity runtime did not initialize');}
  await evaluate(`document.getElementById('newGameBtn').click()`);
  for(let i=0;i<40&&gatewayRequests.length===0;i++)await sleep(100);
  if(gatewayRequests.length===0)throw new Error('Parity mode started a game but dispatched zero Learning Gateway requests');
  const operations=[...new Set(gatewayRequests.map(row=>row.path.split('/').pop()))];
  if(!operations.includes('assess-hand'))throw new Error(`Parity dispatch did not include assess-hand; observed: ${operations.join(', ')}`);
  console.log(`parity-dispatch: ${gatewayRequests.length} Gateway request(s); operations=${operations.join(',')}`);
  ws.close();
}finally{
  chrome.kill('SIGTERM');
  if(chrome.exitCode===null)await once(chrome,'exit');
  server.close();
}
