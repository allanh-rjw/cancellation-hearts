export const COURSE_GOAL_STATE_SCHEMA_VERSION = 1;
export const COURSE_GOAL_STATE_POLICY = "at4.1-suspended-goal-return-to-target-v1";
export const COURSE_GOAL_EXCURSION_TYPES = Object.freeze([
  "prerequisite-repair",
  "clarification",
  "contrast-case",
  "simulation",
  "representation-change"
]);
export const COURSE_GOAL_MAX_EXCURSION_DEPTH = 2;

export class CourseGoalStateValidationError extends Error {
  constructor(message) {
    super(`Invalid course goal state: ${message}`);
    this.name = "CourseGoalStateValidationError";
  }
}

const isText = (value) => typeof value === "string" && value.trim().length > 0;
const copy = (value) => value == null ? value : structuredClone(value);

function normalizeGoal(goal, label = "goal") {
  if (!goal || typeof goal !== "object" || Array.isArray(goal) || !isText(goal.goalId)) {
    throw new CourseGoalStateValidationError(`${label}.goalId is required`);
  }
  return Object.freeze({
    goalId: goal.goalId,
    problemId: isText(goal.problemId) ? goal.problemId : null,
    targetId: isText(goal.targetId) ? goal.targetId : null,
    targetKind: isText(goal.targetKind) ? goal.targetKind : null,
    sourceAttemptId: isText(goal.sourceAttemptId) ? goal.sourceAttemptId : null,
    startedAtUtc: isText(goal.startedAtUtc) ? goal.startedAtUtc : null,
    metadata: goal.metadata && typeof goal.metadata === "object" && !Array.isArray(goal.metadata) ? copy(goal.metadata) : {}
  });
}

function normalizeReturnCondition(condition) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    throw new CourseGoalStateValidationError("every excursion requires an explicit returnCondition");
  }
  if (!["evidence-observed", "attempt-complete", "learner-signal"].includes(condition.kind)) {
    throw new CourseGoalStateValidationError(`unsupported returnCondition kind ${condition.kind ?? "(missing)"}`);
  }
  if (condition.kind === "evidence-observed" && !isText(condition.evidenceType)) {
    throw new CourseGoalStateValidationError("evidence-observed returnCondition requires evidenceType");
  }
  if (condition.kind === "learner-signal" && !isText(condition.signalId)) {
    throw new CourseGoalStateValidationError("learner-signal returnCondition requires signalId");
  }
  return Object.freeze({
    kind: condition.kind,
    evidenceType: isText(condition.evidenceType) ? condition.evidenceType : null,
    requiredOutcome: isText(condition.requiredOutcome) ? condition.requiredOutcome : null,
    signalId: isText(condition.signalId) ? condition.signalId : null
  });
}

export function validateCourseGoalState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new CourseGoalStateValidationError("state must be an object");
  if (state.schemaVersion !== COURSE_GOAL_STATE_SCHEMA_VERSION || state.policy !== COURSE_GOAL_STATE_POLICY) throw new CourseGoalStateValidationError("schema or policy mismatch");
  normalizeGoal(state.activeGoal, "activeGoal");
  if (!Array.isArray(state.suspendedGoals) || !Array.isArray(state.excursionEvidence) || !Array.isArray(state.returnHistory)) throw new CourseGoalStateValidationError("state collections are required");
  if (!Number.isInteger(state.excursionDepth) || state.excursionDepth !== state.suspendedGoals.length) throw new CourseGoalStateValidationError("excursionDepth must equal suspendedGoals length");
  if (state.excursionDepth < 0 || state.excursionDepth > COURSE_GOAL_MAX_EXCURSION_DEPTH) throw new CourseGoalStateValidationError("excursionDepth exceeds the bounded maximum");
  for (const frame of state.suspendedGoals) {
    normalizeGoal(frame.goal, "suspendedGoal");
    if (!isText(frame.suspendedFromAttemptId)) throw new CourseGoalStateValidationError("suspended frame must preserve suspendedFromAttemptId");
  }
  if (state.excursionDepth === 0) {
    if (state.status !== "active" || state.excursionGoal != null || state.excursionType != null || state.returnCondition != null) throw new CourseGoalStateValidationError("non-excursion state cannot retain excursion fields");
  } else {
    if (state.status !== "excursion") throw new CourseGoalStateValidationError("excursion depth requires excursion status");
    if (!COURSE_GOAL_EXCURSION_TYPES.includes(state.excursionType)) throw new CourseGoalStateValidationError("invalid excursionType");
    const eg = normalizeGoal(state.excursionGoal, "excursionGoal");
    if (eg.goalId !== state.activeGoal.goalId) throw new CourseGoalStateValidationError("activeGoal must be the current excursionGoal");
    normalizeReturnCondition(state.returnCondition);
  }
  return Object.freeze(state);
}

export function createCourseGoalState({ activeGoal, now = null } = {}) {
  return validateCourseGoalState({schemaVersion:COURSE_GOAL_STATE_SCHEMA_VERSION,policy:COURSE_GOAL_STATE_POLICY,status:"active",activeGoal:normalizeGoal(activeGoal,"activeGoal"),suspendedGoals:[],excursionGoal:null,excursionType:null,returnCondition:null,excursionDepth:0,excursionEvidence:[],returnHistory:[],updatedAtUtc:isText(now)?now:null});
}

export function suspendCourseGoal({ state, excursionGoal, excursionType, returnCondition, sourceAttemptId, now = null } = {}) {
  const current=validateCourseGoalState(copy(state));
  if(!COURSE_GOAL_EXCURSION_TYPES.includes(excursionType)) throw new CourseGoalStateValidationError(`unsupported excursionType ${excursionType}`);
  if(!isText(sourceAttemptId)) throw new CourseGoalStateValidationError("sourceAttemptId is required so the original learner attempt is preserved");
  if(current.excursionDepth>=COURSE_GOAL_MAX_EXCURSION_DEPTH) throw new CourseGoalStateValidationError(`excursion depth is bounded at ${COURSE_GOAL_MAX_EXCURSION_DEPTH}`);
  const condition=normalizeReturnCondition(returnCondition); const nextGoal=normalizeGoal(excursionGoal,"excursionGoal");
  const frame=Object.freeze({goal:copy(current.activeGoal),priorExcursionGoal:copy(current.excursionGoal),priorExcursionType:current.excursionType,priorReturnCondition:copy(current.returnCondition),suspendedFromAttemptId:sourceAttemptId,suspendedAtUtc:isText(now)?now:null});
  return validateCourseGoalState({...copy(current),status:"excursion",activeGoal:nextGoal,suspendedGoals:[...current.suspendedGoals.map(copy),frame],excursionGoal:nextGoal,excursionType,returnCondition:condition,excursionDepth:current.excursionDepth+1,updatedAtUtc:isText(now)?now:current.updatedAtUtc});
}

export function recordCourseExcursionEvidence({state,evidenceId,evidenceType,outcome="observed",sourceAttemptId=null,signalId=null,observedAtUtc=null}={}) {
  const current=validateCourseGoalState(copy(state));
  if(current.excursionDepth===0) throw new CourseGoalStateValidationError("no active excursion");
  if(!isText(evidenceId)||!isText(evidenceType)) throw new CourseGoalStateValidationError("evidenceId and evidenceType are required");
  const withheld=current.suspendedGoals.map((frame)=>frame.goal.goalId);
  const record=Object.freeze({evidenceId,evidenceType,outcome:isText(outcome)?outcome:"observed",sourceAttemptId:isText(sourceAttemptId)?sourceAttemptId:null,signalId:isText(signalId)?signalId:null,observedAtUtc:isText(observedAtUtc)?observedAtUtc:null,excursionGoalId:current.excursionGoal.goalId,excursionType:current.excursionType,excursionDepth:current.excursionDepth,countsTowardGoalIds:[current.excursionGoal.goalId],withheldFromGoalIds:[...new Set(withheld)]});
  return validateCourseGoalState({...copy(current),excursionEvidence:[...current.excursionEvidence.map(copy),record],updatedAtUtc:isText(observedAtUtc)?observedAtUtc:current.updatedAtUtc});
}

export function courseGoalReturnConditionStatus(state) {
  const current=validateCourseGoalState(copy(state)); if(current.excursionDepth===0)return Object.freeze({satisfied:false,matchingEvidenceIds:[]});
  const c=current.returnCondition; const evidence=current.excursionEvidence.filter((entry)=>entry.excursionGoalId===current.excursionGoal.goalId&&entry.excursionDepth===current.excursionDepth); let matches=[];
  if(c.kind==="evidence-observed") matches=evidence.filter((entry)=>entry.evidenceType===c.evidenceType&&(!c.requiredOutcome||entry.outcome===c.requiredOutcome));
  else if(c.kind==="attempt-complete") matches=evidence.filter((entry)=>entry.evidenceType==="attempt-complete"&&(!c.requiredOutcome||entry.outcome===c.requiredOutcome));
  else matches=evidence.filter((entry)=>entry.evidenceType==="learner-signal"&&entry.signalId===c.signalId);
  return Object.freeze({satisfied:matches.length>0,matchingEvidenceIds:matches.map((entry)=>entry.evidenceId)});
}

export function resumeCourseGoal({state,now=null}={}) {
  const current=validateCourseGoalState(copy(state)); if(current.excursionDepth===0)throw new CourseGoalStateValidationError("no suspended goal to resume");
  const returnStatus=courseGoalReturnConditionStatus(current); if(!returnStatus.satisfied)throw new CourseGoalStateValidationError("returnCondition is not satisfied");
  const frames=current.suspendedGoals.map(copy); const frame=frames.pop(); const restoredDepth=frames.length; const restoredGoal=normalizeGoal(frame.goal,"restoredGoal");
  const record=Object.freeze({returnedFromGoalId:current.excursionGoal.goalId,returnedToGoalId:restoredGoal.goalId,excursionType:current.excursionType,sourceAttemptId:frame.suspendedFromAttemptId,returnEvidenceIds:returnStatus.matchingEvidenceIds,returnedAtUtc:isText(now)?now:null});
  return validateCourseGoalState({...copy(current),status:restoredDepth>0?"excursion":"active",activeGoal:restoredGoal,suspendedGoals:frames,excursionGoal:restoredDepth>0?copy(frame.priorExcursionGoal):null,excursionType:restoredDepth>0?frame.priorExcursionType:null,returnCondition:restoredDepth>0?copy(frame.priorReturnCondition):null,excursionDepth:restoredDepth,returnHistory:[...current.returnHistory.map(copy),record],updatedAtUtc:isText(now)?now:current.updatedAtUtc});
}

export function reconcileCourseGoalState({state=null,transition=null,now=null}={}) {
  if(state==null&&transition==null)return null;
  if(!transition||transition.kind==="no-op")return state==null?null:validateCourseGoalState(copy(state));
  if(transition.kind==="initialize"){if(state!=null)throw new CourseGoalStateValidationError("initialize requires no prior goal state");return createCourseGoalState({activeGoal:transition.activeGoal,now});}
  if(state==null)throw new CourseGoalStateValidationError(`${transition.kind} requires an existing goal state`);
  if(transition.kind==="suspend")return suspendCourseGoal({state,...transition,now});
  if(transition.kind==="evidence")return recordCourseExcursionEvidence({state,...transition,observedAtUtc:transition.observedAtUtc??now});
  if(transition.kind==="resume")return resumeCourseGoal({state,now});
  throw new CourseGoalStateValidationError(`unsupported transition kind ${transition.kind}`);
}
