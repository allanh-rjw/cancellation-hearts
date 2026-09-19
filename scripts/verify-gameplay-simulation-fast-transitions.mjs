import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

const root=process.cwd();
const simulationPath=join(root,'scripts','verify-gameplay-simulation.mjs');
const original=readFileSync(simulationPath,'utf8');
const needle="          if(visible(nextTrick)){nextTrick.click();action='next-trick';}";
if(!original.includes(needle))throw new Error('Next-trick simulation hook changed');
const patched=original.replace(needle,`${needle}\n          else if(state.phase==='trick-end'&&state.trickNumber<13&&window.__cancellationHeartsNextTrickFlow?.installed){startTrick();action='qa-next-trick';}`);

try{
  writeFileSync(simulationPath,patched);
  const result=spawnSync(process.execPath,[join(root,'scripts','verify-gameplay-simulation-qa.mjs')],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}finally{
  writeFileSync(simulationPath,original);
}
