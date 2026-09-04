import { DOMAIN_ADAPTER_SCHEMA_VERSION, defineDomainAdapter } from "./domain-adapter.js";

const legacy = window.CancellationHeartsTutorAdapter;
if (!legacy) throw new Error("Cancellation Hearts domain adapter requires hearts-tutor-adapter.js");

export const CANCELLATION_HEARTS_DOMAIN_ID = "cancellation-hearts";
export const CANCELLATION_HEARTS_DOMAIN_ADAPTER_VERSION = 2;

const STEP_SKILLS = Object.freeze({
  objective:["hearts.objective_reasoning","causal_planning.state_transition"],
  control:["hearts.control_reasoning","causal_planning.control_requirements"],
  cards:["hearts.card_role_reasoning","causal_planning.state_transition"],
  next:["hearts.useful_void_reasoning","causal_planning.state_transition"],
  preserve:["hearts.exit_preservation","causal_planning.preservation"]
});

function curatedProblems(){const candidates=[0,1].map((totalInteractions)=>legacy.selectExercise({selfLevel:"beginner",totalInteractions}));const seen=new Set();return candidates.filter((p)=>p&&p.id&&!seen.has(p.id)&&seen.add(p.id));}
function validCardCode(code){return /^(?:[2-9]|10|[JQKA])[CDSH]$/.test(String(code||""));}
function responseText(response){return String(response?.reasoning??response?.text??response?.choice??"").trim();}
function uiResponse(response){const text=responseText(response);return response?.choice?{choice:response.choice,text:""}:{text};}
function stepFrom(context){return context?.step||{id:context?.stepId||"objective"};}
function skillsFor(step){return STEP_SKILLS[step?.id]||["hearts.hand_reading"]}

function canonicalDiagnosis(problem,step,legacyResult={}){const d=legacyResult.diagnosis||{};const score=Math.max(0,Math.min(1,Number.isFinite(legacyResult.score)?legacyResult.score:.5));const gradeable=legacyResult.gradeable!==false;return Object.freeze({problemId:problem.id,stepId:step?.id||null,score,skills:Object.freeze([...(legacyResult.skills||skillsFor(step))]),flags:Object.freeze([...(legacyResult.flags||[])]),gradeable,evidence:Object.freeze({correct:d.correct||null,incorrect:d.incorrect||d.correction||null,observed:d.recognized||null,missing:d.missing||null,ambiguous:d.ambiguous||null,nextQuestion:d.nextQuestion||null})});}

function learnerCoaching(problem,diagnosis){const e=diagnosis.evidence||{};return Object.freeze({problemId:problem.id,move:diagnosis.gradeable?"evidence-feedback":"diagnostic-probe",scaffoldLevel:"minimal",retryRequired:!diagnosis.gradeable,acknowledgement:e.correct||e.observed||"I can evaluate the part of the answer you stated.",correction:e.incorrect||"",improvementNote:[e.missing,e.ambiguous].filter(Boolean).join(" "),prompt:e.nextQuestion||"Explain what in this hand supports your answer.",focus:diagnosis.stepId?Object.freeze({componentId:diagnosis.stepId,category:"reasoning",importance:"major",prompt:e.nextQuestion||"Explain your reasoning."}):null,strategyAdjustment:null});}

function legacyEvaluation(problem,response,context={}){const step=stepFrom(context);return legacy.evaluate(step,uiResponse(response),{...context,exercise:problem},context.profile||{})||{};}
function deterministicSummary(problem,response,context={}){const step=stepFrom(context);const result=legacyEvaluation(problem,response,context);return {step,result,diagnosis:canonicalDiagnosis(problem,step,result)};}

function diagnosisTemplate(diagnosis){const e=diagnosis.evidence||{};return [e.correct||e.observed,e.incorrect,e.missing,e.ambiguous,e.nextQuestion].filter(Boolean).join(" ");}

function labelsInText(text){const matches=String(text||"").match(/(?:10|[2-9JQKA])[♣♦♠♥]/g)||[];return [...new Set(matches)];}
function handLabels(problem){return new Set((problem.hand||[]).map((c)=>legacy.cardLabel(c)));}

export const cancellationHeartsDomainAdapter=defineDomainAdapter({
  schemaVersion:DOMAIN_ADAPTER_SCHEMA_VERSION,
  domainId:CANCELLATION_HEARTS_DOMAIN_ID,
  version:CANCELLATION_HEARTS_DOMAIN_ADAPTER_VERSION,
  label:"Cancellation Hearts",
  capabilities:{assessment:false,calibration:false,trainingRuntime:true},
  bindings:{
    knowledgeGraph:"hearts-strategy-concepts",
    problemFamilyRegistry:"hearts-curated-and-transfer-hands",
    expertModelProvider:"hearts-expert-hand-model",
    truthVerifier:"hearts-hand-and-rule-verifier",
    responseInterpreter:"hearts-structured-response-diagnosis + optional logged LLM interpretation",
    representationProvider:"hearts-card-hand-ui",
    languageProvider:"adaptive-trainer teaching policy + hearts coaching resources",
    diagnosticInquiryProvider:"adaptive-trainer diagnostic inquiry",
    runtimeTruthEvaluator:"hearts-deterministic-hand-evaluator",
    runtimeReasoningGraphProvider:"hearts-pathway-reasoning-graph",
    runtimeCoachingResourceProvider:"hearts-situation-specific-coaching-resources"
  },

  listProblems(){return curatedProblems();},
  problemForId(problemId){return curatedProblems().find((p)=>p.id===problemId)||null;},
  verifyProblem(problem){const valid=Boolean(problem&&problem.id&&Array.isArray(problem.hand)&&problem.hand.length===13&&problem.hand.every(validCardCode));return Object.freeze({status:valid?"verified":"rejected",problemId:problem?.id||null,verifier:"cancellation-hearts-domain-adapter-v2"});},

  assessAttempt({problem,response,context={}}){const summary=deterministicSummary(problem,response,context);const diagnosis=summary.diagnosis;return Object.freeze({diagnosis:Object.freeze({problemId:problem.id,stepId:diagnosis.stepId,score:diagnosis.score,skills:diagnosis.skills,flags:diagnosis.flags,gradeable:diagnosis.gradeable,answerAssessment:Object.freeze({status:!diagnosis.gradeable?"unresolved":diagnosis.score>=.78?"correct":diagnosis.score>=.5?"partially-correct":"incorrect"}),reasoningAssessment:Object.freeze({status:!diagnosis.gradeable?"insufficient-evidence":diagnosis.score>=.82?"expert-like":diagnosis.score>=.58?"mostly-sound-with-answer-error":"faulty"}),reasoningStructureAssessment:Object.freeze({requestScope:"targeted",stages:Object.freeze([{id:diagnosis.stepId||"attempt",status:!diagnosis.gradeable?"not-demonstrated":diagnosis.score>=.58?"sound":"divergent"}])}),evidence:diagnosis.evidence}),coaching:learnerCoaching(problem,diagnosis),legacyResult:summary.result});},
  buildDiagnosticInquiry(){return null;},
  buildLearnerModel(){return Object.freeze({schemaVersion:1,skills:{}});},
  selectNextExperience({problem,diagnosis}){return Object.freeze({type:diagnosis.gradeable===false?"diagnostic-clarification":diagnosis.score>=.82?"scaffold-fade":diagnosis.score<.5?"guided-repair":"continue-pathway",problemId:problem.id,stepId:diagnosis.stepId});},

  runtimeProblemState(problem){const expert=legacy.expertModel(problem);return {domainId:CANCELLATION_HEARTS_DOMAIN_ID,problemId:problem.id,problemVersionId:`${problem.id}:v1`,problemFingerprint:`${problem.id}:${(problem.hand||[]).join("-")}`,familyId:problem.source==="random"?"hearts-transfer-hand":"hearts-curated-hand",familyVersion:1,constructIds:["hearts.hand_reading","causal_planning.state_transition","causal_planning.control_requirements","causal_planning.preservation"],presentation:{title:problem.title,hand:[...(problem.hand||[])],strategy:expert?.strategy||null},truthReference:{expertModelId:`${problem.id}:expert-v1`},metadata:{source:problem.source||"curated"}};},

  evaluateResponseDeterministically({problem,response,context={}}){const {step,result,diagnosis}=deterministicSummary(problem,response,context);const text=responseText(response);const hasText=Boolean(text);const gradeable=diagnosis.gradeable&&hasText;const status=!hasText?"incorrect":gradeable&&diagnosis.score>=.78?"correct":"incorrect";const findings=[...(diagnosis.flags||[])];if(!hasText)findings.push("empty-response");if(!gradeable&&hasText)findings.push("reasoning-not-established");if(diagnosis.evidence?.correct)findings.push("explicit-correct-evidence");if(diagnosis.evidence?.incorrect)findings.push("explicit-incorrect-evidence");return {truthVersion:"cancellation-hearts-rules-and-expert-model-v2",status,score:{value:diagnosis.score,max:1},findings:[...new Set(findings)],canonicalAnswer:{stepId:step.id,expertStrategy:legacy.expertModel(problem)?.strategy||null},requiresReasoningInterpretation:!gradeable&&hasText,metadata:{stepId:step.id,gradeable,skills:skillsFor(step),domainDiagnosis:diagnosis.evidence,legacyScore:result.score??null}};},

  reasoningInterpretationContext({problem,response,deterministicEvaluation,context={}}){return {domainId:CANCELLATION_HEARTS_DOMAIN_ID,problemId:problem.id,hand:[...(problem.hand||[])],stepId:stepFrom(context).id,response:responseText(response),deterministicFindings:[...(deterministicEvaluation.findings||[])],instruction:"Interpret only the learner's stated reasoning. Do not infer unstated motives. Return ambiguity when the reason cannot be established."};},

  diagnosticEvidenceFromInterpretation({problem,deterministicEvaluation,interpretation=null,context={}}){const step=stepFrom(context),meta=deterministicEvaluation.metadata||{},domain=meta.domainDiagnosis||{};if(interpretation?.status==="uninterpreted")return {status:"insufficient",diagnosticPolicyVersion:"hearts-deterministic-first-v2",targetConstructIds:skillsFor(step),misconceptionHypotheses:[],inferenceEligible:false,exclusionReasons:["reasoning-uninterpreted"],metadata:{stepId:step.id,domainEvidence:domain}};const incorrect=Boolean(domain.incorrect);return {status:incorrect?"supported":"uncertain",diagnosticPolicyVersion:"hearts-deterministic-first-v2",earliestDivergenceId:incorrect?step.id:null,targetConstructIds:skillsFor(step),misconceptionHypotheses:incorrect?(meta.gradeable?[{id:`hearts.${step.id}.misconception`,probability:.8,evidenceCodes:["explicit-domain-contradiction"]}]:[]):[],confidence:meta.gradeable?.85:.5,inferenceEligible:meta.gradeable===true,exclusionReasons:meta.gradeable===true?[]:["reasoning-not-established"],metadata:{stepId:step.id,domainEvidence:domain}};},

  coachingResources({problem,deterministicEvaluation,interpretation,diagnosticEvidence,context={}}){const step=stepFrom(context),domain=deterministicEvaluation.metadata?.domainDiagnosis||{};const explicit=[domain.correct||domain.observed,domain.incorrect,domain.missing,domain.ambiguous,domain.nextQuestion].filter(Boolean).join(" ");const clarification=[domain.correct||domain.observed,domain.ambiguous||"I can evaluate the conclusion you stated, but I do not yet know why you chose it.",domain.nextQuestion||"What in this hand made you choose that answer?"].filter(Boolean).join(" ");return {templates:{"clarify-reasoning":clarification,"advance":explicit||"That answer and the reasoning you gave are supported by this hand.","highlight-cue":explicit||"Recheck the earliest part of your plan that does not fit this hand.","classify-problem":explicit||"Identify the specific card problem you are trying to solve before choosing the next move.","demonstrate-step":explicit||"Focus on one concrete card relationship in this hand, then try again.","worked-example":explicit||"Review the expert pathway for this hand, then try a fresh hand."},probes:{[step.id]:[domain.nextQuestion||"What in this hand supports your answer?"]},metadata:{hand:[...(problem.hand||[])],stepId:step.id,interpretationStatus:interpretation?.status||null,diagnosticStatus:diagnosticEvidence.status}};},

  groundCoachOutput({problem,text}){const allowed=handLabels(problem),mentioned=labelsInText(text),invalid=mentioned.filter((label)=>!allowed.has(label));return {grounded:invalid.length===0,findings:invalid.length?[`mentions-cards-not-in-hand:${invalid.join(",")}`]:["all-mentioned-cards-occur-in-active-hand"]};}
});
