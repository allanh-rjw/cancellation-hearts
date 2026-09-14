(async function installHeartsAccessGate(){
  const CHECK_INTERVAL_MS=30_000;
  const app=document.getElementById('app');
  const root=document.documentElement;
  let checking=null;
  let intervalId=null;

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

  async function verify(){
    if(checking)return checking;
    checking=(async()=>{
      lock('checking');
      try{
        const api=await import('./learning-gateway-client.mjs');
        const client=api.createLearningGatewayClient({baseUrl:configuredBaseUrl()});
        await client.preflight();
        unlock();
        return true;
      }catch(error){
        lock('denied',error);
        return false;
      }finally{
        checking=null;
      }
    })();
    return checking;
  }

  window.CancellationHeartsAccessGate=Object.freeze({verify,status:()=>root.dataset.ulsAccess||'unchecked'});
  lock('checking');
  await verify();
  intervalId=setInterval(()=>{void verify();},CHECK_INTERVAL_MS);
  window.addEventListener('focus',()=>{void verify();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void verify();});
  window.addEventListener('pagehide',()=>{if(intervalId)clearInterval(intervalId);},{once:true});
})().catch(()=>{
  document.documentElement.dataset.ulsAccess='denied';
  const app=document.getElementById('app');
  if(app){app.inert=true;app.setAttribute('aria-hidden','true');}
});
