from pathlib import Path

# Production diagnosis: accept natural noun phrasing such as "disposal route".
path = Path('hearts-feedback-diagnosis.js')
text = path.read_text()
old = "const statesGoal=has(t,/(unload|dump|discard|shed|lose.*saf|void|place to|get rid|avoid.*win|prevent.*win)/);"
new = "const statesGoal=has(t,/(unload|dump|discard|shed|dispose|disposal|lose.*saf|void|place to|get rid|avoid.*win|prevent.*win)/);"
if old not in text:
    raise SystemExit('useful-void objective matcher not found')
path.write_text(text.replace(old,new,1))

# Simulation harness: intentionally weak strategic alternatives are not complete answers.
harness = Path('simulation/harness.mjs')
text = harness.read_text()
old = "level:c.level||'advanced',complete:true,expectedResponseClass:c.classification==='weak'?'clearly-incorrect':'strategically-defensible-alternative',expected:c.classification==='weak'?{mustNotAdvance:true}:{mustNotReject:true}"
new = "level:c.level||'advanced',complete:c.classification!=='weak',expectedResponseClass:c.classification==='weak'?'clearly-incorrect':'strategically-defensible-alternative',expected:c.classification==='weak'?{mustNotAdvance:true}:{mustNotReject:true}"
if old not in text:
    raise SystemExit('alternative-pathway completion metadata not found')
harness.write_text(text.replace(old,new,1))

# Minimized production regression for the noun-form objective wording used by good synthetic responses.
cases = Path('simulation/cases.mjs')
text = cases.read_text()
anchor = " {id:'queen-protection-cards-card-names',problemId:'guided-queen-protection',stepId:'cards',text:'2 of spades and 9 of spades protect the queen of spades, so I want to preserve 2 of spades longest while shedding queen of clubs and 10 of diamonds before they promote into winners.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n"
addition = anchor + " {id:'useful-void-objective-disposal-noun',problemId:'guided-useful-void',stepId:'objective',text:'I want to create a useful disposal route for the ace of spades because it can become a forced winner, while preserving low exits so I can surrender control afterward.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n"
if anchor not in text:
    raise SystemExit('regression insertion point not found')
cases.write_text(text.replace(anchor,addition,1))
