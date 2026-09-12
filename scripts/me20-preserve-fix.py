from pathlib import Path

coaching = Path('tutor-situational-coaching.js')
text = coaching.read_text()
anchor = """      if(step.id==='cards'&&/2♠|9♠/.test(t)&&!explicitReason){
        d.correct='2♠ and 9♠ are relevant because they sit underneath Q♠.';
        d.ambiguous='I do not yet know which one you intend to preserve longer and why.';
        d.nextQuestion='What job does 2♠ have that makes it more valuable to keep while Q♠ is still in your hand?';
        result.gradeable=false;
      }
"""
addition = anchor + """      if(step.id==='preserve'&&/(?:2♠|2 of spades)/.test(t)&&/(?:5♣|5 of clubs|low exit|separate low)/.test(t)&&explicitReason){
        d.correct='You identified both kinds of cards that need to be preserved: 2♠ as protection under Q♠ and a separate low exit for surrendering the lead later.';
        delete d.ambiguous;
        delete d.nextQuestion;
        result.gradeable=true;
      }
"""
if anchor not in text:
    raise SystemExit('Expected queen-protection cards block not found')
text = text.replace(anchor, addition, 1)
old = "if(step.id==='preserve'&&/4♦|4♥/.test(t)){"
new = "if(step.id==='preserve'&&/(?:4♦|4♥|4 of diamonds|4 of hearts)/.test(t)){"
if old not in text:
    raise SystemExit('Expected useful-void preserve matcher not found')
coaching.write_text(text.replace(old, new, 1))

cases = Path('simulation/cases.mjs')
text = cases.read_text()
anchor = " {id:'targeting-conditional',problemId:'guided-useful-void',stepId:'target',text:'I would target a player only if they had demonstrated a void or exposed high cards and the score justified the risk; otherwise I would leave them alone.',expected:{status:'correct',grounded:true}}\n"
addition = " {id:'preserve-queen-protection-unicode',problemId:'guided-queen-protection',stepId:'preserve',text:'I want to preserve 2♠ because it protects Q♠ through another spade round, plus a separate low exit such as 5♣ so I can surrender the lead later.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n {id:'preserve-queen-protection-card-names',problemId:'guided-queen-protection',stepId:'preserve',text:'I want to preserve 2 of spades because it protects the queen of spades through another spade round, plus a separate low exit such as 5 of clubs so I can surrender the lead later.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n" + anchor
if anchor not in text:
    raise SystemExit('Expected regression insertion point not found')
cases.write_text(text.replace(anchor, addition, 1))
