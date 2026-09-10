import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const encoded=['patch.part01','patch.part02','patch.part03']
  .map(name=>readFileSync(new URL(`../causal/${name}`,import.meta.url),'utf8').replace(/\s+/g,''))
  .join('');
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
console.log(`CAUSAL_PATCH_SIZE:${source.length}`);
for(const needle of ['AdaptiveCoachCore','AdaptiveCoach','CoachCore','class ']){
  let index=source.indexOf(needle);
  while(index>=0){
    console.log(`CAUSAL_SNIPPET:${needle}\n${source.slice(Math.max(0,index-600),index+3000)}\nEND_CAUSAL_SNIPPET`);
    index=source.indexOf(needle,index+needle.length);
    if(needle==='class ')break;
  }
}
