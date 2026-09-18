import assert from 'node:assert/strict';
import {beliefSnapshot,cardLocation,createBelief,locationDiagnostic,recordPass,recordPlay} from './opponent-belief-state.mjs';

const card=(id,suit,rank)=>({id,suit,rank});
const close=(actual,expected,epsilon=1e-12)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
const ownHand=[card(0,'S','Q'),card(1,'S','5'),card(2,'C','2'),card(3,'C','7'),card(4,'D','3'),card(5,'D','A'),card(6,'H','2'),card(7,'H','9'),card(8,'C','K'),card(9,'D','6'),card(10,'H','J'),card(11,'S','8'),card(12,'C','4')];
const outgoing=[ownHand[0],ownHand[8],ownHand[10]];
const incoming=[card(60,'S','A'),card(61,'H','7'),card(62,'D','Q')];

function run(){
  const belief=createBelief({observerSeat:2,ownHand});
  recordPass(belief,{outgoing,incoming,recipientSeat:4,sourceSeat:0});
  const afterPass=cardLocation(belief,'S','Q');
  assert.deepEqual(afterPass.knownHolders,[4]);
  assert.equal(afterPass.unknownCopies,1);
  close(Object.values(afterPass.seatProbabilities).reduce((a,b)=>a+b,0),1);
  close(Object.values(afterPass.expectedCopiesBySeat).reduce((a,b)=>a+b,0),1);
  assert.equal(cardLocation(belief,'S','A').own,1);
  recordPlay(belief,{seat:6,card:card(70,'C','9'),ledSuit:'S'});
  recordPlay(belief,{seat:5,card:card(71,'H','5'),ledSuit:'C'});
  recordPlay(belief,{seat:4,card:outgoing[0],ledSuit:'S'});
  recordPlay(belief,{seat:2,card:incoming[0],ledSuit:'S'});
  const snapshot=beliefSnapshot(belief);
  const queen=snapshot.dangerousLocations.SQ;
  assert.equal(snapshot.passEvidence.outgoing.length,3);
  assert.equal(snapshot.passEvidence.incoming.length,3);
  assert.equal(snapshot.passEvidence.outgoing[0].seat,4);
  assert.equal(snapshot.passEvidence.incoming[0].seat,0);
  assert.deepEqual(snapshot.knownVoids[6],['S']);
  assert.deepEqual(snapshot.knownVoids[5],['C']);
  assert.deepEqual(queen.played,[4]);
  assert.deepEqual(queen.knownHolders,[]);
  assert.equal(queen.unknownCopies,1);
  assert.ok(!queen.possibleSeats.includes(2));
  assert.ok(!queen.possibleSeats.includes(6));
  assert.ok(queen.possibleSeats.length>1);
  assert.equal(queen.seatProbabilities[2],undefined);
  assert.equal(queen.seatProbabilities[6],undefined);
  close(Object.values(queen.seatProbabilities).reduce((a,b)=>a+b,0),1);
  close(Object.values(queen.expectedCopiesBySeat).reduce((a,b)=>a+b,0),queen.unknownCopies);
  const diagnostic=locationDiagnostic(queen,[7]);
  close(diagnostic.probabilitySum,1);
  close(diagnostic.expectedCopySum,1);
  assert.ok(diagnostic.meanTrueSeatProbability>0);
  assert.equal(diagnostic.impossibleTruthCount,0);
  assert.equal(snapshot.remainingBySuit.S,24);
  assert.equal(snapshot.unseenToObserverBySuit.H,22);
  assert.equal(snapshot.ownCards.length,12);
  return {snapshot,diagnostic};
}

assert.deepEqual(run(),run());
console.log('opponent-belief-state: deterministic probability and diagnostic checks passed');
