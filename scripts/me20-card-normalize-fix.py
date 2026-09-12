from pathlib import Path

path = Path('hearts-feedback-diagnosis.js')
text = path.read_text()
old = """  function normalize(text){
    return String(text||'').toLowerCase()
"""
new = """  function normalize(text){
    const ranks={ace:'a',king:'k',queen:'q',jack:'j'},suits={clubs:'♣',diamonds:'♦',spades:'♠',hearts:'♥'};
    return String(text||'').toLowerCase()
      .replace(/\\b(ace|king|queen|jack|10|[2-9]) of (clubs|diamonds|spades|hearts)\\b/g,(_,rank,suit)=>(ranks[rank]||rank)+suits[suit])
"""
if old not in text:
    raise SystemExit('normalize anchor not found')
path.write_text(text.replace(old,new,1))

cases = Path('simulation/cases.mjs')
text = cases.read_text()
anchor = " {id:'targeting-conditional',problemId:'guided-useful-void',stepId:'target',text:'I would target a player only if they had demonstrated a void or exposed high cards and the score justified the risk; otherwise I would leave them alone.',expected:{status:'correct',grounded:true}}\n"
addition = " {id:'queen-protection-cards-card-names',problemId:'guided-queen-protection',stepId:'cards',text:'2 of spades and 9 of spades protect the queen of spades, so I want to preserve 2 of spades longest while shedding queen of clubs and 10 of diamonds before they promote into winners.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},\n" + anchor
if anchor not in text:
    raise SystemExit('regression insertion point not found')
cases.write_text(text.replace(anchor,addition,1))
