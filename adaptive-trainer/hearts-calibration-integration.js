import {createCalibrationCore} from './calibration-core.js';
import {cancellationHeartsDomainAdapter} from './hearts-domain-adapter.js';

export const cancellationHeartsCalibrationCore=createCalibrationCore(cancellationHeartsDomainAdapter);

if(typeof window!=='undefined'){
  window.CancellationHeartsCalibrationCore=cancellationHeartsCalibrationCore;
  window.__cancellationHeartsCalibration={
    schemaVersion:cancellationHeartsCalibrationCore.schemaVersion,
    domainId:cancellationHeartsCalibrationCore.domainId,
    source:'adaptive-trainer/calibration-core.js',
    domainAdapterVersion:cancellationHeartsDomainAdapter.version,
    safeguards:cancellationHeartsCalibrationCore.buildDescriptiveSnapshot([]).safeguards
  };
}
