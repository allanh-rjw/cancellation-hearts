import { createAdaptiveTrainerCore } from "./adaptive-trainer-core.js";
import { cancellationHeartsDomainAdapter } from "./hearts-domain-adapter.js";

const STORAGE_KEY = "cancellationHearts.adaptiveTrainer.v1";
const SELF_LEVELS = Object.freeze({
  beginner:{label:"Beginner",description:"I know the rules, but I mostly think one trick at a time."},
  developing:{label:"Developing",description:"I understand ideas like voids, exits, and queen protection, but I do not consistently build a whole-hand plan."},
  advanced:{label:"Advanced",description:"I usually form a hand strategy and think several tricks ahead, but I want better sequencing, control, cancellation, targeting, and pivots."},
  expert:{label:"Expert",description:"I can usually construct and execute a full-hand plan and want difficult positions that expose subtle strategic weaknesses."}
});

function loadState(){
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
    if(parsed&&parsed.version===1)return parsed;
  } catch(e) {}
  return {version:1,selfLevel:null,examplesSeen:0,totalInteractions:0,events:[],lastNextExperience:null};
}
function saveState(state){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){}}
function boundedScore(x){return Math.max(0,Math.min(1,Number.isFinite(x)?x:0.5));}
function feedbackFromAssessment(assessment){
  const c=assessment.coaching||{};
  const parts=[];
  if(c.acknowledgement)parts.push(c.acknowledgement);
  if(c.correction)parts.push(c.correction);
  if(c.improvementNote)parts.push(c.improvementNote);
  if(c.prompt)parts.push(c.prompt);
  return [...new Set(parts.filter(Boolean))].join(" ");
}

class AdaptiveTrainerBrowserFacade {
  constructor(){
    this.runtime=createAdaptiveTrainerCore(cancellationHeartsDomainAdapter);
    this.state=loadState();
    this.profile=this.state;
    this.lastLearnerModel=null;
    this.lastAssessment=null;
  }

  selfAssess(level){
    this.state.selfLevel=SELF_LEVELS[level]?level:"developing";
    saveState(this.state);
    return this.profile;
  }

  shouldShowWorkedExample(){
    return this.state.selfLevel==="beginner" && this.state.examplesSeen<3;
  }

  recordWorkedExample(){this.state.examplesSeen++;saveState(this.state);}

  scaffoldMode(){
    // UI affordance only. Pedagogical diagnosis and intervention decisions are made by the canonical core.
    const beginner=this.state.selfLevel==="beginner";
    const developing=this.state.selfLevel==="developing";
    return {freeText:true,showFallback:beginner||developing,fallbackOpen:beginner&&this.state.totalInteractions<2,hintDepth:beginner?2:1,challenge:this.state.selfLevel==="expert"};
  }

  evaluate(step,response,context={}){
    const assessment=this.runtime.assessAttempt({
      problem:context.exercise,
      response,
      events:this.state.events,
      context:{
        ...context,
        step,
        profile:this.profile,
        diagnosticProbeDecision:{
          actionRelevance:"different-actions",
          informationValue:"high",
          cognitiveBurden:"low",
          causalStatus:"unresolved",
          freshEvidenceRequired:true,
          probeBudgetExhausted:false
        },
        interactionBurden:{
          sameTargetProbeCount:0,
          consecutiveTrainerQuestions:0,
          evidenceAlreadySupplied:false,
          learnerRequestedExplanation:false,
          cognitiveLoad:"low",
          diagnosticUncertainty:"high",
          recentDirectSupportCount:0,
          recentAnswerSupplyCount:0,
          reasoningPurpose:"diagnostic"
        }
      }
    });
    this.lastAssessment=assessment;
    this.lastLearnerModel=assessment.learnerModel;
    this.state.totalInteractions++;
    this.state.lastNextExperience=assessment.nextExperience;
    this.state.events.push({
      type:"attempt-assessed",
      at:new Date().toISOString(),
      problemId:assessment.problem.id,
      stepId:assessment.diagnosis.stepId,
      score:boundedScore(assessment.diagnosis.score),
      gradeable:assessment.diagnosis.gradeable,
      skills:[...(assessment.diagnosis.skills||[])],
      flags:[...(assessment.diagnosis.flags||[])],
      diagnosticProbeStatus:assessment.diagnosticProbeDecision?.status||null,
      interactionDecision:assessment.diagnosticInteractionDecision?.status||null
    });
    this.state.events=this.state.events.slice(-250);
    saveState(this.state);
    return {
      score:boundedScore(assessment.diagnosis.score),
      skills:[...(assessment.diagnosis.skills||[])],
      flags:[...(assessment.diagnosis.flags||[])],
      gradeable:assessment.diagnosis.gradeable,
      diagnosis:assessment.diagnosis,
      coaching:assessment.coaching,
      diagnosticInquiry:assessment.diagnosticInquiry,
      diagnosticProbeDecision:assessment.diagnosticProbeDecision,
      diagnosticInteractionDecision:assessment.diagnosticInteractionDecision,
      nextExperience:assessment.nextExperience,
      feedback:feedbackFromAssessment(assessment),
      scaffold:this.scaffoldMode()
    };
  }

  selectExercise(){
    const legacy=window.CancellationHeartsTutorAdapter;
    if(!legacy)throw new Error("Cancellation Hearts domain adapter is not loaded");
    return legacy.selectExercise(this.profile);
  }

  masterySummary(){
    const skills=this.lastLearnerModel?.skills||{};
    return Object.entries(skills).map(([skill,row])=>({skill,value:row.mastery,evidence:row.evidence})).sort((a,b)=>a.value-b.value);
  }

  reset(){localStorage.removeItem(STORAGE_KEY);this.state=loadState();this.profile=this.state;this.lastLearnerModel=null;this.lastAssessment=null;}
}

window.AdaptiveCoach={
  AdaptiveCoachCore:AdaptiveTrainerBrowserFacade,
  SELF_LEVELS,
  canonical:true,
  schemaVersion:3,
  status:"domain-neutral-orchestration-boundary",
  domainAdapterSchemaVersion:5
};
window.__canonicalAdaptiveTrainer={
  runtimeStatus:"domain-neutral-orchestration-boundary",
  coreSchemaVersion:3,
  domainAdapterSchemaVersion:5,
  domainId:cancellationHeartsDomainAdapter.domainId,
  adapterVersion:cancellationHeartsDomainAdapter.version
};
