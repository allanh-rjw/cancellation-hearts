import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const encoded=['patch.part01','patch.part02','patch.part03']
  .map(name=>readFileSync(new URL(`../causal/${name}`,import.meta.url),'utf8').replace(/\s+/g,''))
  .join('');
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
for(const needle of ['class AdaptiveCoachCore','AdaptiveCoachCore','constructor(adapter)']){
  const index=source.indexOf(needle);
  if(index<0)continue;
  console.log(`CAUSAL_CORE_SNIPPET:${needle}\n${source.slice(Math.max(0,index-800),index+5000)}\nEND_CAUSAL_CORE_SNIPPET`);
  break;
}
