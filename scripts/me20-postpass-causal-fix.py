from pathlib import Path

passing = Path('hearts-passing-reasoning.js')
text = passing.read_text()
old = "causal=/because|so that|so i|therefore|which means|then|after|now that/.test(text)"
new = "causal=/because|so\\b|therefore|which means|then|after|now that/.test(text)"
if old not in text:
    raise SystemExit('Expected post-pass causal matcher not found')
passing.write_text(text.replace(old,new,1))

cases = Path('simulation/cases.mjs')
text = cases.read_text()
anchor = " {id:'postpass-real-revision',problemId:'guided-useful-void',stepId:'postpass_pathway',text:'The incoming cards made spades more dangerous, so my first objective now is to stay off lead while I find a safer route to unload AS. I will preserve my low exits because I need them after the disposal succeeds.',expected:{status:'correct'}},\n"
addition = anchor + " {id:'postpass-direct-so-causal',problemId:'guided-useful-void',stepId:'postpass_pathway',text:'The incoming cards changed the hand shape, so my first objective is to stay off lead, shed the new liabilities, and preserve low exits.',expected:{status:'correct',noRedundantQuestion:true}},\n"
if anchor not in text:
    raise SystemExit('Expected post-pass regression insertion point not found')
cases.write_text(text.replace(anchor,addition,1))
