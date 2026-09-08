import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const loader=read('causal-loader.js');
const client=read('domain-pack-client.js');
const app=read('app.js');

assert(loader.includes("__cancellationHeartsIdentityBoundary='cloudflare-access'"),'production identity boundary must be Cloudflare Access');
assert(loader.includes("document.body.classList.remove('locked')"),'legacy body lock must be disabled after Cloudflare Access');
assert(loader.includes("getElementById('passwordGate')?.classList.add('hidden')"),'legacy password gate must be hidden in production');
assert(loader.includes("getElementById('app')?.setAttribute('aria-hidden','false')"),'Cloudflare-authenticated app must be exposed to assistive technology');
assert(!loader.includes('cancellationHeartsUnlocked'),'production bootstrap must not rely on the old sessionStorage password flag');

for(const field of ['learnerRef','accountId','email','roles','entitlements','entitlementSet']){
  assert(client.includes(`'${field}'`)||client.includes(`"${field}"`),`client must explicitly strip ${field}`);
}
assert(client.includes('identitySafeArgs(operation,args)'),'all evaluated decisions must pass through identity stripping');
assert(client.includes("credentials:'include'"),'same-origin authenticated requests must include Cloudflare Access cookies');
assert(client.includes("operation!=='evaluateDecision'"),'identity stripping must protect the evidence-producing request');

assert(app.includes('initializePasswordGate()'),'legacy gate may remain only as dormant migration/reference code');
assert(app.includes('APP_PASSWORD'),'legacy password remains detectable so CI can prove it is not the production boundary');

console.log('Cancellation Hearts Cloudflare Access identity boundary gate passed.');
