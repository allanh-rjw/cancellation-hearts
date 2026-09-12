from pathlib import Path

path = Path('simulation/generator.mjs')
text = path.read_text()
old = "case'postpass_pathway':return'The incoming cards changed the hand shape, so I am reassessing rather than blindly keeping the old plan. My first objective now is to stay off lead while I shed the new liabilities, and I will preserve my lowest exits for the phase after that.';"
new = "case'postpass_pathway':return'The incoming cards changed the hand shape, so my first objective is to stay off lead, shed the new liabilities, and preserve low exits.';"
if old not in text:
    raise SystemExit('Expected post-pass correct response not found')
path.write_text(text.replace(old,new,1))
