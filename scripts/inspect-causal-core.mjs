import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const encoded=['patch.part01','patch.part02','patch.part03']
  .map(name=>readFileSync(new URL(`../causal/${name}`,import.meta.url),'utf8').replace(/\s+/g,''))
  .join('');
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
console.log(`CAUSAL_PATCH_SIZE:${source.length}`);
console.log(`CAUSAL_PATCH_HEAD\n${source.slice(0,12000)}\nEND_CAUSAL_PATCH_HEAD`);
