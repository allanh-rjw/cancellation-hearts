from pathlib import Path

diagnosis = Path('hearts-feedback-diagnosis.js')
text = diagnosis.read_text()
old = "const preservesProtection=has(t,/(2♠|protect.*q♠|q♠.*protect)/);\n      const mentionsLow=has(t,/(5♣|6♦|6♥|7♥|low club|low diamond|low heart|low card)/);"
new = "const preservesProtection=has(t,/(2♠|2 of spades|protect.*(?:q♠|queen of spades)|(?:q♠|queen of spades).*protect)/);\n      const mentionsLow=has(t,/(5♣|5 of clubs|6♦|6 of diamonds|6♥|6 of hearts|7♥|7 of hearts|low club|low diamond|low heart|low card|low exit)/);"
if old not in text:
    raise SystemExit('Expected queen-protection preserve diagnosis not found')
text = text.replace(old, new, 1)
old = "const namesLow=has(t,/(4♦|4♥|2♠|low card|low diamond|low heart)/);"
new = "const namesLow=has(t,/(4♦|4 of diamonds|4♥|4 of hearts|2♠|2 of spades|low card|low diamond|low heart|low exit)/);"
if old not in text:
    raise SystemExit('Expected useful-void preserve diagnosis not found')
diagnosis.write_text(text.replace(old, new, 1))

cases = Path('simulation/cases.mjs')
text = cases.read_text()
anchor = " {id:'targeting-conditional',problemId:'guided-useful-void',stepId:'target',text:'I would target a player only if they had demonstrated a void or exposed high cards and the score justified the risk; otherwise I would leave them alone.',expected:{status:'correct',grounded:true}}\n"
addition = " {id:'preserve-queen-protection-unicode',problemId:'guided-queen-protection',stepId:'preserve',text:'I want to preserve 2♠ because it protects Q♠ through another spade round, plus a separate low exit such as 5♣ so I can surrender the lead later.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n {id:'preserve-queen-protection-card-names',problemId:'guided-queen-protection',stepId:'preserve',text:'I want to preserve 2 of spades because it protects the queen of spades through another spade round, plus a separate low exit such as 5 of clubs so I can surrender the lead later.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n" + anchor
if anchor not in text:
    raise SystemExit('Expected regression insertion point not found')
cases.write_text(text.replace(anchor, addition, 1))
