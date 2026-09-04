(function(){
  const STORAGE_KEY='adaptiveCoachProfile.v1';
  const DEFAULT_SKILLS={
    hand_reading:0.5, objective_reasoning:0.5, control_reasoning:0.5,
    entry_selection:0.5, exit_preservation:0.5, useful_void_reasoning:0.5,
    queen_structure:0.5, effective_winner_reasoning:0.5,
    cancellation_forecasting:0.5, moon_recognition:0.5,
    scoreboard_strategy:0.5, pivot_timing:0.5,
    causal_planning_state_transition:0.5,
    causal_planning_preservation:0.5,
    causal_planning_control_requirements:0.5,
    causal_planning_contingency_revision:0.5
  };
  const SELF_LEVELS={
    beginner:{label:'Beginner',scaffold:0.9,description:'I know the rules, but I mostly think one trick at a time.'},
    developing:{label:'Developing',scaffold:0.68,description:'I understand ideas like voids, exits, and queen protection, but I do not consistently build a whole-hand plan.'},
    advanced:{label:'Advanced',scaffold:0.4,description:'I usually form a hand strategy and think several tricks ahead, but I want better sequencing, control, cancellation, targeting, and pivots.'},
    expert:{label:'Expert',scaffold:0.18,description:'I can usually construct and execute a full-hand plan and want difficult positions that expose subtle strategic weaknesses.'}
  };
  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(x&&x.version===1) return x;
    }catch(e){}
    return {version:1,selfLevel:null,scaffold:0.68,examplesSeen:0,totalInteractions:0,skills:{...DEFAULT_SKILLS},evidence:{},history:[]};
  }
  function save(p){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(p));}catch(e){}}
  function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
  function arr(x){if(!x)return[];return Array.isArray(x)?x.filter(Boolean):[x];}

  /*
    Domain-neutral feedback contract.
    Domain adapters should report evidence, not pretend to know the learner's mind.

    diagnosis.correct / recognized   = claims we can support from the response
    diagnosis.incorrect / correction = claims we can deterministically reject
    diagnosis.missing                = information needed but not supplied
    diagnosis.ambiguous              = reasoning that is not clear enough to grade
    diagnosis.nextQuestion           = one concrete follow-up question

    If reasoning is ambiguous, the core asks before grading that reasoning and does not
    update mastery from the ambiguous portion. This is the deterministic/LLM boundary:
    rules and explicit card references are verified deterministically; uncertain language
    may be interpreted, but uncertainty must remain visible rather than being promoted to fact.
  */
  function normalizeDiagnosis(result){
    const d=result&&result.diagnosis||{};
    return {
      correct:arr(d.correct||d.recognized),
      incorrect:arr(d.incorrect||d.correction),
      missing:arr(d.missing),
      ambiguous:arr(d.ambiguous),
      nextQuestion:d.nextQuestion||''
    };
  }

  function composeFeedback(result){
    if(!result) return 'Tell me what you are trying to accomplish and what you would want to happen next.';
    const d=normalizeDiagnosis(result);
    const parts=[];
    if(d.correct.length) parts.push('What you got right: '+d.correct.join(' '));
    if(d.incorrect.length) parts.push('What needs correction: '+d.incorrect.join(' '));
    if(d.missing.length) parts.push('What is still missing: '+d.missing.join(' '));
    if(d.ambiguous.length) parts.push('What I still need to understand: '+d.ambiguous.join(' '));
    if(d.nextQuestion) parts.push('Next question: '+d.nextQuestion);
    if(parts.length) return parts.join(' ');
    return result.feedback||'Tell me what you are trying to accomplish and what you would want to happen next.';
  }

  function evidenceState(result){
    const d=normalizeDiagnosis(result);
    if(d.ambiguous.length) return 'ambiguous';
    if(d.incorrect.length) return 'incorrect';
    if(d.missing.length&&d.correct.length) return 'incomplete';
    if(d.correct.length) return 'supported';
    return result&&result.gradeable===false?'ambiguous':'limited';
  }

  class AdaptiveCoachCore{
    constructor(adapter){this.adapter=adapter;this.profile=load();}
    selfAssess(level){
      const cfg=SELF_LEVELS[level]||SELF_LEVELS.developing;
      this.profile.selfLevel=level;this.profile.scaffold=cfg.scaffold;
      if(this.profile.totalInteractions===0){
        const bias={beginner:-0.14,developing:-0.04,advanced:0.08,expert:0.16}[level]||0;
        Object.keys(this.profile.skills).forEach(k=>this.profile.skills[k]=clamp(this.profile.skills[k]+bias));
      }
      save(this.profile);return this.profile;
    }
    shouldShowWorkedExample(){
      if(this.profile.selfLevel!=='beginner') return false;
      return this.profile.examplesSeen<3||this.profile.scaffold>0.78;
    }
    recordWorkedExample(){this.profile.examplesSeen++;save(this.profile);}
    scaffoldMode(skillKeys=[]){
      const vals=skillKeys.map(k=>this.profile.skills[k]).filter(Number.isFinite);
      const mastery=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0.5;
      const need=clamp((1-mastery)*0.65+this.profile.scaffold*0.55);
      return {need,freeText:true,showFallback:need>0.28,fallbackOpen:need>0.78,hintDepth:need>0.75?3:need>0.48?2:1,challenge:need<0.35};
    }
    evaluate(step,response,context){
      const result=this.adapter.evaluate(step,response,context,this.profile)||{};
      const state=evidenceState(result);
      this.profile.totalInteractions++;
      const quality=clamp(result.score??0.5);
      const keys=result.skills||[];
      const gradeable=result.gradeable!==false&&state!=='ambiguous';
      if(gradeable){
        keys.forEach(k=>{
          const old=this.profile.skills[k]??0.5;
          const alpha=(this.profile.evidence[k]||0)<3?0.28:0.14;
          this.profile.skills[k]=clamp(old*(1-alpha)+quality*alpha);
          this.profile.evidence[k]=(this.profile.evidence[k]||0)+1;
        });
        const avg=keys.length?keys.reduce((s,k)=>s+(this.profile.skills[k]||0.5),0)/keys.length:0.5;
        if(quality>0.82&&avg>0.68)this.profile.scaffold=clamp(this.profile.scaffold-0.025);
        if(quality<0.42)this.profile.scaffold=clamp(this.profile.scaffold+0.035);
      }
      this.profile.history.push({at:Date.now(),step:step.id,score:quality,skills:keys,flags:result.flags||[],evidenceState:state,gradeable});
      this.profile.history=this.profile.history.slice(-150);save(this.profile);
      return {...result,evidenceState:state,gradeable,feedback:composeFeedback(result),scaffold:this.scaffoldMode(keys)};
    }
    selectExercise(){return this.adapter.selectExercise(this.profile);}
    masterySummary(){return Object.entries(this.profile.skills).sort((a,b)=>a[1]-b[1]).map(([skill,value])=>({skill,value,evidence:this.profile.evidence[skill]||0}));}
    reset(){localStorage.removeItem(STORAGE_KEY);this.profile=load();}
  }
  window.AdaptiveCoach={AdaptiveCoachCore,SELF_LEVELS,composeFeedback,normalizeDiagnosis,evidenceState};
})();
