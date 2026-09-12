export const REGRESSION_CASES=Object.freeze([
 {id:'multi-part-listening',problemId:'guided-queen-protection',stepId:'objective',text:'I want to avoid allowing the 10h, Qh and Qs from becoming forced winners.',expected:{status:'correct',noRedundantQuestion:true,grounded:true}},
 {id:'terse-clubs',problemId:'guided-useful-void',stepId:'objective',text:'Clubs',expected:{requiresClarification:true,noReasoningMastery:true,grounded:true}},
 {id:'useful-void-liabilities',problemId:'guided-useful-void',stepId:'objective',text:'If the void allowed me a safe way to lose the As and the Jh, as well as any other potential forced winners',expected:{grounded:true,noStaleQueenCards:true}},
 {id:'stay-off-lead-terse',problemId:'guided-useful-void',stepId:'control',text:'Stay off lead',expected:{requiresClarification:true,noReasoningMastery:true,grounded:true}},
 {id:'passing-other-card-mentions',problemId:'guided-useful-void',stepId:'prepass_pathway',text:'I want to keep 3C and 4D as low exits while passing KC, 8C and AS so that I reduce liabilities now and then reassess the disposal route. Pass cards: KC, 8C, AS',expected:{status:'correct',grounded:true}},
 {id:'correct-conclusion-wrong-reason',problemId:'guided-useful-void',stepId:'objective',text:'Clubs is best because the shortest suit is always the best void.',expected:{mustNotAdvance:true,grounded:true}},
 {id:'later-part-first',problemId:'guided-queen-protection',stepId:'objective',text:'My objective is to prevent those cards from becoming forced winners later.',expected:{mustIdentifyMissing:true,grounded:true}},
 {id:'contradiction-control',problemId:'guided-queen-protection',stepId:'control',text:'I want to stay off lead, but my immediate objective is to take control now even though I do not have a follow-up.',expected:{mustNotAdvance:true,grounded:true}},
 {id:'defensible-alternative',problemId:'guided-queen-protection',stepId:'control',text:'I would normally stay off lead, but if Q clubs is already gone and 5 clubs is my last club, I would allow K diamonds to win so I can lead 5 clubs and create a disposal route.',expected:{mustNotReject:true,grounded:true}},
 {id:'moon-minimum-intervention',problemId:'guided-useful-void',stepId:'pivot',text:'If the moon threat becomes credible, I would make the smallest play needed to break it and then return to my original avoidance pathway.',expected:{status:'correct',grounded:true}},
 {id:'targeting-conditional',problemId:'guided-useful-void',stepId:'target',text:'I would target a player only if they had demonstrated a void or exposed high cards and the score justified the risk; otherwise I would leave them alone.',expected:{status:'correct',grounded:true}}
]);
export const ALTERNATIVE_PATHWAYS=Object.freeze([
 {id:'queen-default-off-lead',problemId:'guided-queen-protection',stepId:'control',classification:'strong',text:'I want to stay off lead early because other players leading gives me chances to shed Q clubs, 10 diamonds and high hearts while I preserve the low spades under Q spades.'},
 {id:'queen-conditional-club-route',problemId:'guided-queen-protection',stepId:'control',classification:'defensible',text:'If Q clubs has already left and 5 clubs is my last club, I would let K diamonds take control so I can lead 5 clubs, finish clubs, and create a later disposal route.'},
 {id:'queen-conditional-spade-round',problemId:'guided-queen-protection',stepId:'control',classification:'defensible',text:'If the queen of spades is still protected and higher spades are live, I can use K diamonds to gain control and then lead 2 spades to induce another spade round without exposing the queen yet.'},
 {id:'queen-control-without-followup',problemId:'guided-queen-protection',stepId:'control',classification:'weak',text:'I want K diamonds to win because taking control is always better than letting someone else lead.'},
 {id:'void-default-off-lead',problemId:'guided-useful-void',stepId:'control',classification:'strong',text:'I want to stay off lead while other players help me lose clubs, because the club void only matters if it later gives A spades a safe disposal route.'},
 {id:'void-conditional-control',problemId:'guided-useful-void',stepId:'control',classification:'defensible',text:'If winning the lead lets me immediately lead a club and shorten the suit toward a useful void, I am willing to take control for that specific follow-up.'}
]);
export const PASSING_SCENARIOS=Object.freeze([
 {id:'pass-high-cards-sensible',kind:'passing',description:'High-card shedding serves the pathway rather than merely reducing ranks.'},
 {id:'pass-damages-protection',kind:'passing',description:'Passing a protection card should be questioned when Q♠ remains exposed.'},
 {id:'useful-void',kind:'passing',description:'Creating a void is valuable only when it has a disposal job.'},
 {id:'shortest-not-useful',kind:'passing',description:'Shortest suit alone is insufficient justification.'},
 {id:'postpass-total-revision',kind:'passing',description:'Incoming cards can invalidate the original pathway.'},
 {id:'postpass-minimal-revision',kind:'passing',description:'Incoming cards can leave the original pathway mostly intact.'}
]);
export const ADVANCED_SCENARIOS=Object.freeze([
 {id:'moon-evidence-before-action',stepId:'threat',description:'Require evidence before treating a moon as credible.'},
 {id:'moon-minimum-intervention',stepId:'pivot',description:'Break the moon with the least costly intervention.'},
 {id:'observe-before-target',stepId:'observe',description:'Seek demonstrated constraints before targeting.'},
 {id:'conditional-targeting',stepId:'target',description:'Target only when vulnerability and score payoff justify it.'},
 {id:'cancellation-safety',stepId:'target',description:'Cancellation can change who actually wins a loaded trick.'},
 {id:'carryover-jackpot',stepId:'threat',description:'Carried penalties can make intervention timing more urgent.'}
]);
