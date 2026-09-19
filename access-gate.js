import {createLearningGatewayClient} from './learning-gateway-client.mjs';

(async function installHeartsAccessGate(){
  // Gameplay rule modules load as static <script> tags earlier in index.html
  // and must already be installed by the time this synchronous prefix runs -
  // access-gate.js is purely an access-verification concern and must never
  // load or wait on gameplay code again (see the app-layer rebuild plan,
  // Phase 1: this used to dynamically inject those scripts here, racing
  // against learning-gateway-runtime.js's own async playCard wrapper).
  if(!window.__cancellationHeartsRuleInvariants?.installed||
     !window.__cancellationHeartsOpeningEnforcement?.installed||
     !window.__cancellationHeartsNextTrickFlow?.installed){
    throw new Error('access-gate.js loaded before gameplay rule modules installed - check index.html script order.');
  }
  const CHECK_INTERVAL_MS=60*60_000;
  const STALE_AFTER_MS=60*60_000;
  const app=document.getElementById('app');
  const root=document.documentElement;
  let checking=null;
  let intervalId=null;
  let lastVerifiedAt=0;
  let hasAuthorizedSession=false;

  function configuredBaseUrl(){
    const explicit=typeof window.CANCELLATION_HEARTS_GATEWAY_BASE_URL==='string'?window.CANCELLATION_HEARTS_GATEWAY_BASE_URL.trim():'';
    const meta=document.querySelector('meta[name="uls-learning-gateway-base-url"]')?.content?.trim()||'';
    return (explicit||meta).replace(/\/$/,'');
  }

  function ensureOverlay(){
    let overlay=document.getElementById('ulsAccessGate');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='ulsAccessGate';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    Object.assign(overlay.style,{
      position:'fixed',inset:'0',zIndex:'100000',display:'grid',placeItems:'center',
      padding:'24px',background:'Canvas',color:'CanvasText',fontFamily:'system-ui,sans-serif'
    });
    const card=document.createElement('div');
    card.id='ulsAccessGateCard';
    Object.assign(card.style,{maxWidth:'560px',padding:'28px',border:'1px solid currentColor',borderRadius:'12px',textAlign:'center'});
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
  }

  function message(title,detail){
    const overlay=ensureOverlay();
    const card=overlay.querySelector('#ulsAccessGateCard');
    card.replaceChildren();
    const heading=document.createElement('h2');heading.textContent=title;
    const body=document.createElement('p');body.textContent=detail;
    card.append(heading,body);
  }

  function lock(status,error){
    root.dataset.ulsAccess=status;
    if(app){app.inert=true;app.setAttribute('aria-hidden','true');}
    if(status==='checking'){
      message('Verifying access','Confirming your Cancellation Hearts entitlement…');
      return;
    }
    const code=error?.code||'gateway-unavailable';
    if(code==='authorization-denied'){
      message('Cancellation Hearts access is not active','Your access to Cancellation Hearts has been revoked or is no longer active.');
      return;
    }
    if(code==='authentication-required'){
      message('Authentication required','Your sign-in session is no longer valid. Reload the page and sign in again.');
      return;
    }
    message('Unable to verify access','Cancellation Hearts is temporarily unavailable because access could not be verified.');
  }

  function unlock(){
    root.dataset.ulsAccess='active';
    if(app){app.inert=false;app.removeAttribute('aria-hidden');}
    document.getElementById('ulsAccessGate')?.remove();
  }

  function accessFailure(error){
    return error?.code==='authorization-denied'||error?.code==='authentication-required';
  }

  async function verify({blocking=false}={}){
    if(checking)return checking;
    checking=(async()=>{
      if(blocking||!hasAuthorizedSession)lock('checking');
      try{
        const client=createLearningGatewayClient({baseUrl:configuredBaseUrl()});
        await client.preflight();
        hasAuthorizedSession=true;
        lastVerifiedAt=Date.now();
        unlock();
        return true;
      }catch(error){
        if(!hasAuthorizedSession||accessFailure(error)){
          hasAuthorizedSession=false;
          lock('denied',error);
        }
        return false;
      }finally{
        checking=null;
      }
    })();
    return checking;
  }

  function verifyIfStale(){
    if(Date.now()-lastVerifiedAt<STALE_AFTER_MS)return;
    void verify();
  }

  window.CancellationHeartsAccessGate=Object.freeze({
    verify:()=>verify(),
    status:()=>root.dataset.ulsAccess||'unchecked',
    lastVerifiedAt:()=>lastVerifiedAt
  });
  lock('checking');
  await verify({blocking:true});
  intervalId=setInterval(()=>{void verify();},CHECK_INTERVAL_MS);
  window.addEventListener('focus',verifyIfStale);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')verifyIfStale();});
  window.addEventListener('pagehide',()=>{if(intervalId)clearInterval(intervalId);},{once:true});
})().catch(()=>{
  document.documentElement.dataset.ulsAccess='denied';
  const app=document.getElementById('app');
  if(app){app.inert=true;app.setAttribute('aria-hidden','true');}
});
