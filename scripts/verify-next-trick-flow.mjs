import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../gameplay-next-trick-flow.js',import.meta.url),'utf8');

function classList(initial=[]){
  const values=new Set(initial);
  return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),values};
}
const nextTrickBtn={classList:classList(['hidden']),onclick(){context.startTrick();}};
const coachPanel={classList:classList(['hidden'])};
const coachBtn={onclick(){coachPanel.classList.remove('hidden');}};
const closeCoachBtn={onclick(){coachPanel.classList.add('hidden');}};
const elements={nextTrickBtn,coachPanel,coachBtn,closeCoachBtn};
let nextTimerId=1;
const timers=new Map();
let startTrickCalls=0;

const context={
  console,window:{},
  state:{phase:'playing',trickNumber:3,gameOver:false,practiceEnded:false},
  $(id){return elements[id];},
  finishTrick(){context.state.trickNumber++;context.state.phase='trick-end';nextTrickBtn.classList.remove('hidden');},
  startTrick(){startTrickCalls++;context.state.phase='playing';nextTrickBtn.classList.add('hidden');},
  setTimeout(fn,delay){const id=nextTimerId++;timers.set(id,{fn,delay});return id;},
  clearTimeout(id){timers.delete(id);}
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'gameplay-next-trick-flow.js'});

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const onlyTimer=()=>[...timers.values()][0];
const runTimers=()=>{for(const [id,timer] of [...timers]){timers.delete(id);timer.fn();}};
const reset=({coachOpen=false,trickNumber=3}={})=>{
  timers.clear();startTrickCalls=0;
  context.state={phase:'playing',trickNumber,gameOver:false,practiceEnded:false};
  nextTrickBtn.classList.add('hidden');
  coachPanel.classList[coachOpen?'remove':'add']('hidden');
};

assert(context.window.__cancellationHeartsNextTrickFlow?.installed,'next-trick controller did not install');
assert(context.window.__cancellationHeartsNextTrickFlow.AUTO_ADVANCE_MS===3000,'auto advance delay is not 3 seconds');

// Coach closed: hide the button and advance after exactly three seconds.
reset();
context.finishTrick();
assert(nextTrickBtn.classList.contains('hidden'),'Next trick button is visible with coach closed');
assert(timers.size===1&&onlyTimer().delay===3000,'coach-closed transition did not schedule a 3-second advance');
runTimers();
assert(startTrickCalls===1,'coach-closed transition did not start the next trick');

// Coach open: show the button and do not schedule automatic advance.
reset({coachOpen:true});
context.finishTrick();
assert(!nextTrickBtn.classList.contains('hidden'),'Next trick button is hidden while coach is open');
assert(timers.size===0,'coach-open transition scheduled an automatic advance');

// Opening coach during the pause converts the pending auto-advance to manual.
reset();
context.finishTrick();
coachBtn.onclick();
assert(!nextTrickBtn.classList.contains('hidden'),'opening coach during trick-end did not reveal Next trick');
assert(timers.size===0,'opening coach did not cancel pending auto-advance');

// Closing coach during trick-end hides the button and starts a fresh 3-second timer.
reset({coachOpen:true});
context.finishTrick();
closeCoachBtn.onclick();
assert(nextTrickBtn.classList.contains('hidden'),'closing coach during trick-end left Next trick visible');
assert(timers.size===1&&onlyTimer().delay===3000,'closing coach did not schedule a fresh 3-second advance');

// Final trick never exposes or schedules another trick.
reset({trickNumber:12});
context.finishTrick();
assert(context.state.trickNumber===13,'final trick test did not reach trick 13');
assert(nextTrickBtn.classList.contains('hidden'),'Next trick button is visible after final trick');
assert(timers.size===0,'final trick scheduled an automatic next trick');

console.log('next-trick-flow: coach manual / no-coach 3-second auto-advance verified');
