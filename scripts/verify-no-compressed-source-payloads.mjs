// Guards against the reappearance of a compressed/base64 source-replacement
// deployment channel (the retired apply-strategic-deploy.yml pattern): a
// `deploy/` directory of chunked blobs decoded straight into tracked source
// files by CI, bypassing normal PR review. See git history: "Deploy strategic
// coach build". This deliberately does NOT flag chunked assets loaded at
// runtime by the app itself (e.g. causal/patch.part*) — that's a separate,
// tracked concern (see the app rebuild plan, Phase 4), not a CI source-overwrite
// mechanism.
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();

if(existsSync(join(root,'deploy'))){
  throw new Error('Found a deploy/ directory. The compressed/base64 CI source-overwrite pipeline was retired — ship source changes as normal reviewable diffs, not chunked payloads assembled by a workflow.');
}

const workflowDir=join(root,'.github','workflows');
for(const entry of readdirSync(workflowDir)){
  if(!entry.endsWith('.yml')&&!entry.endsWith('.yaml'))continue;
  const text=readFileSync(join(workflowDir,entry),'utf8');
  const hasDecode=/base64\s+-d/.test(text)&&/gunzip/.test(text);
  const hasPush=/git\s+push/.test(text);
  if(hasDecode&&hasPush){
    throw new Error(`${entry} decodes a base64/gzip payload and pushes to the repo — this is the compressed source-replacement pattern that was retired. If a legitimate new use case needs this, get explicit review rather than reintroducing it silently.`);
  }
}

console.log('verify-no-compressed-source-payloads: no chunked payload files or decode-and-push workflow steps found');
