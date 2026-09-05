import {createAssessmentCore} from './assessment-core.js';
import {cancellationHeartsDomainAdapter} from './hearts-domain-adapter.js';

export const cancellationHeartsAssessmentCore=createAssessmentCore(cancellationHeartsDomainAdapter);

if(typeof window!=='undefined'){
  window.CancellationHeartsAssessmentCore=cancellationHeartsAssessmentCore;
  window.__cancellationHeartsAssessment={
    schemaVersion:cancellationHeartsAssessmentCore.schemaVersion,
    domainId:cancellationHeartsAssessmentCore.domainId,
    blueprintId:'hearts-opening-diagnostic-v1',
    source:'adaptive-trainer/assessment-core.js',
    domainAdapterVersion:cancellationHeartsDomainAdapter.version
  };
}
