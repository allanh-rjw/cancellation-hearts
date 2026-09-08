(function installCancellationHeartsDomainPackClient(global){
  'use strict';

  const DEFAULT_PATH='/v1/domains/cancellation-hearts';
  const OPERATIONS=[
    'assessHand','recommendStrategy','compareStrategies','recommendPass','recommendPlay',
    'detectPivot','analyzeOpponent','analyzeGameState','evaluateDecision','analyzePostHand',
    'analyzePostGame','generateCounterfactual','generateActivity','getInstructionalAnnotations'
  ];
  const FORBIDDEN_IDENTITY_FIELDS=['learnerRef','accountId','email','roles','entitlements','entitlementSet'];

  function endpoint(){
    const configured=global.__CANCELLATION_HEARTS_CONFIG__?.domainEndpoint;
    if(configured) return String(configured).replace(/\/$/,'');
    return DEFAULT_PATH;
  }

  function identitySafeArgs(operation,args){
    if(operation!=='evaluateDecision'||!args[0]||typeof args[0]!=='object'||Array.isArray(args[0]))return args;
    const input={...args[0]};
    for(const field of FORBIDDEN_IDENTITY_FIELDS)delete input[field];
    return [input,...args.slice(1)];
  }

  async function request(operation,args){
    if(!OPERATIONS.includes(operation)) throw new Error(`Unsupported Domain Pack operation: ${operation}`);
    const response=await fetch(`${endpoint()}/${operation}`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      credentials:'include',
      body:JSON.stringify({args:identitySafeArgs(operation,args)})
    });
    let body=null;
    try{ body=await response.json(); }catch(_error){}
    if(!response.ok){
      const message=body?.error||body?.message||`Domain Pack request failed (${response.status})`;
      const error=new Error(message); error.status=response.status; error.operation=operation; error.code=body?.code; throw error;
    }
    return body?.result===undefined?body:body.result;
  }

  const client={ endpoint, request };
  for(const operation of OPERATIONS) client[operation]=(...args)=>request(operation,args);
  client.capabilities=async()=>{
    const response=await fetch(`${endpoint()}/capabilities`,{credentials:'include'});
    if(!response.ok) throw new Error(`Domain Pack capabilities unavailable (${response.status})`);
    return response.json();
  };

  global.CancellationHeartsDomainPackClient=Object.freeze(client);
})(window);
