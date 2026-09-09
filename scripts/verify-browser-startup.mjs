import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { once } from 'node:events';
import net from 'node:net';

const root = process.cwd();
const mime = new Map([
  ['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],
  ['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.json','application/json; charset=utf-8']
]);
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
function chromeBinary(){const bins=[process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser'].filter(Boolean);return bins.find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0)??(()=>{throw new Error('Chrome/Chromium is required for browser startup verification');})();}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitForDebug(port){for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)return;}catch{}await sleep(100);}throw new Error('Chrome DevTools endpoint did not start');}
async function openTarget(port){const r=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'});if(!r.ok)throw new Error(`Unable to create Chrome target (${r.status})`);return r.json();}
async function inspectMode(port,baseUrl,mode){
  const target=await openTarget(port);const ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');
  let nextId=0;const pending=new Map();const exceptions=[];
  ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown'){exceptions.push(msg.params?.exceptionDetails?.text??'uncaught browser exception');}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`${baseUrl}/?learningMode=${mode}`});
  let snapshot=null;
  for(let i=0;i<80;i++){await sleep(100);const result=await send('Runtime.evaluate',{expression:`JSON.stringify({ready:document.readyState,setup:!!document.getElementById('setup'),setupHidden:document.getElementById('setup')?.classList.contains('hidden')??null,passwordGate:!!document.getElementById('passwordGate'),appHidden:document.getElementById('app')?.getAttribute('aria-hidden')??null,gateway:window.__cancellationHeartsLearningGateway??null,runtime:window.CancellationHeartsLearningRuntime?.status?.()??null})`,returnByValue:true});const value=result?.result?.value;if(value){snapshot=JSON.parse(value);if(snapshot.ready==='complete'&&snapshot.runtime)break;}}
  ws.close();
  if(!snapshot?.setup||snapshot.setupHidden)throw new Error(`${mode}: setup screen did not initialize`);
  if(snapshot.passwordGate)throw new Error(`${mode}: obsolete password gate is still present`);
  if(snapshot.appHidden==='true')throw new Error(`${mode}: application remains aria-hidden`);
  if(snapshot.gateway?.status==='initialization-failed')throw new Error(`${mode}: Learning Gateway bootstrap failed`);
  if(snapshot.gateway?.defaultMode!=='legacy')throw new Error(`${mode}: production default drifted from legacy`);
  if(snapshot.runtime?.mode!==mode)throw new Error(`${mode}: requested migration mode did not initialize`);
  if(exceptions.length)throw new Error(`${mode}: uncaught browser exception: ${exceptions.join(' | ')}`);
}
const server=createServer((req,res)=>{try{const requested=new URL(req.url,'http://localhost').pathname;const rel=requested==='/'?'index.html':decodeURIComponent(requested.slice(1));const clean=normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');const file=join(root,clean);if(!statSync(file).isFile())throw new Error('not file');res.writeHead(200,{'content-type':mime.get(extname(file))??'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end('not found');}});
server.listen(0,'127.0.0.1');await once(server,'listening');const appPort=server.address().port;const debugPort=await freePort();const profile=mkdtempSync(join(tmpdir(),'hearts-browser-startup-'));const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
try{await waitForDebug(debugPort);const baseUrl=`http://127.0.0.1:${appPort}`;for(const mode of ['legacy','parity'])await inspectMode(debugPort,baseUrl,mode);console.log('browser-startup: legacy + parity OK; no app-local password gate');}finally{chrome.kill('SIGTERM');if(chrome.exitCode===null)await once(chrome,'exit');server.close();rmSync(profile,{recursive:true,force:true});}
