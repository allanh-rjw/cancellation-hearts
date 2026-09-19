// Proves the last remaining async-gap hazard the wrap-chain audit found is
// structurally closed: learning-gateway-runtime.js used to fetch its
// learning-gateway-client.mjs dependency via `await import(...)` inside its
// own async IIFE, creating a window where window.playCard and the 8 wrapped
// coach renderers were not yet installed - the same bug class Phase 1 fixed
// for the opening-trick rule modules, just one file later in the chain. It
// and access-gate.js are now real ES modules with a static top-level
// `import`, which the spec guarantees resolves fully before either module's
// own top-level code runs at all - no gap left to race.
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gatewaySource=readFileSync(new URL('../learning-gateway-runtime.js',import.meta.url),'utf8');
const accessSource=readFileSync(new URL('../access-gate.js',import.meta.url),'utf8');

function assert(ok,message){if(!ok)throw new Error(message);}

for(const [name,source] of [['learning-gateway-runtime.js',gatewaySource],['access-gate.js',accessSource]]){
  assert(/^\s*import\s.+from\s+['"]\.\/learning-gateway-client\.mjs['"]/m.test(source),`${name} must import learning-gateway-client.mjs via a static top-level import`);
  assert(!/await\s+import\(/.test(source),`${name} must not use a dynamic import() - that's the async gap this test guards against`);
}

for(const tag of [
  '<script type="module" src="learning-gateway-runtime.js',
  '<script type="module" src="access-gate.js'
])assert(html.includes(tag),`index.html must load this as a real ES module: ${tag}`);

// app.js and the gameplay-*.js files are deliberately NOT modules (see the
// app-layer rebuild plan: modularizing them was evaluated and declined as
// architectural cleanup with no further safety benefit once Phase 1+2's
// named-engine refactor made their load order deterministic). Guard against
// that scope silently creeping back in either direction.
for(const plain of [
  'app.js','gameplay-standard-fixes.js','gameplay-opponent-lookahead.js','gameplay-moon-fixes.js',
  'gameplay-moon-calibration.js','gameplay-rule-invariants.js','gameplay-opening-enforcement.js','gameplay-next-trick-flow.js'
]){
  const match=html.match(new RegExp(`<script[^>]*src="${plain}\\?`));
  assert(match,`index.html is missing a script tag for ${plain}`);
  assert(!match[0].includes('type="module"'),`${plain} should stay a classic script, not a module - see the rebuild plan's scope decision`);
}

console.log('gateway-module-loading: learning-gateway-runtime.js and access-gate.js load as real modules with static imports; gameplay files stay classic scripts as scoped');
