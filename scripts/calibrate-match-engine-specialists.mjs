import {
  adjustPlayerAttributes,
  adjustPlayerFeet,
  createPrototypeMatchInput,
  simulateMatch,
} from "../app/match-engine/index.ts";

const requestedPairs = Number(process.argv[2] ?? 1_000);
if (!Number.isInteger(requestedPairs) || requestedPairs < 1 || requestedPairs > 10_000) {
  throw new Error("Informe uma quantidade inteira entre 1 e 10000 pares de partidas.");
}

const sample = {
  baselineCrossAttempts: 0,
  baselineCrosses: 0,
  specialistCrossAttempts: 0,
  specialistCrosses: 0,
  baselineDribbleAttempts: 0,
  baselineDribbles: 0,
  specialistDribbleAttempts: 0,
  specialistDribbles: 0,
  baselineHeaders: 0,
  specialistHeaders: 0,
  baselineHomeGoals: 0,
  eliteKeeperHomeGoals: 0,
};

function countEvents(result, predicate) {
  return result.events.filter(predicate).length;
}

for (let index = 0; index < requestedPairs; index += 1) {
  const input = createPrototypeMatchInput(`specialist-calibration-${index}`);
  const baseline = simulateMatch(input);

  let crossingTeam = adjustPlayerAttributes(input.home, "aurora-p2", {
    crossing: 30,
    technique: 15,
    decisions: 12,
  });
  crossingTeam = adjustPlayerFeet(crossingTeam, "aurora-p2", {
    left: 980,
    right: 980,
    avoidsWeakFoot: false,
  });
  const crossingSpecialist = simulateMatch({ ...input, home: crossingTeam });

  const dribblingTeam = adjustPlayerAttributes(input.home, "aurora-p9", {
    dribbling: 30,
    technique: 15,
    acceleration: 15,
    agility: 15,
  });
  const dribblingSpecialist = simulateMatch({ ...input, home: dribblingTeam });

  const aerialTeam = adjustPlayerAttributes(input.home, "aurora-p11", {
    jumpingReach: 30,
    strength: 25,
    heading: 30,
    bravery: 20,
    offBall: 18,
  });
  const aerialSpecialist = simulateMatch({ ...input, home: aerialTeam });

  const goalkeepingTeam = adjustPlayerAttributes(input.away, "ferro-azul-p1", {
    reflexes: 20,
    oneOnOnes: 20,
    handling: 18,
    composure: 10,
  });
  const goalkeepingSpecialist = simulateMatch({ ...input, away: goalkeepingTeam });

  sample.baselineCrossAttempts += countEvents(baseline, (event) => event.actorId === "aurora-p2" && event.type === "cross_attempt");
  sample.baselineCrosses += countEvents(baseline, (event) => event.actorId === "aurora-p2" && event.type === "cross_completed");
  sample.specialistCrossAttempts += countEvents(crossingSpecialist, (event) => event.actorId === "aurora-p2" && event.type === "cross_attempt");
  sample.specialistCrosses += countEvents(crossingSpecialist, (event) => event.actorId === "aurora-p2" && event.type === "cross_completed");
  sample.baselineDribbleAttempts += countEvents(baseline, (event) => event.actorId === "aurora-p9" && event.type === "dribble_attempt");
  sample.baselineDribbles += countEvents(baseline, (event) => event.actorId === "aurora-p9" && event.type === "dribble_won");
  sample.specialistDribbleAttempts += countEvents(dribblingSpecialist, (event) => event.actorId === "aurora-p9" && event.type === "dribble_attempt");
  sample.specialistDribbles += countEvents(dribblingSpecialist, (event) => event.actorId === "aurora-p9" && event.type === "dribble_won");
  sample.baselineHeaders += countEvents(baseline, (event) => event.actorId === "aurora-p11" && event.type === "shot" && event.tags.includes("header"));
  sample.specialistHeaders += countEvents(aerialSpecialist, (event) => event.actorId === "aurora-p11" && event.type === "shot" && event.tags.includes("header"));
  sample.baselineHomeGoals += baseline.finalState.score[0];
  sample.eliteKeeperHomeGoals += goalkeepingSpecialist.finalState.score[0];
}

const baselineCrossRate = sample.baselineCrosses / sample.baselineCrossAttempts;
const specialistCrossRate = sample.specialistCrosses / sample.specialistCrossAttempts;
const baselineDribbleRate = sample.baselineDribbles / sample.baselineDribbleAttempts;
const specialistDribbleRate = sample.specialistDribbles / sample.specialistDribbleAttempts;

console.log(JSON.stringify({
  pairs: requestedPairs,
  crossingSpecialist: {
    baselineCompletion: Number(baselineCrossRate.toFixed(4)),
    specialistCompletion: Number(specialistCrossRate.toFixed(4)),
    delta: Number((specialistCrossRate - baselineCrossRate).toFixed(4)),
  },
  dribblingSpecialist: {
    baselineSuccess: Number(baselineDribbleRate.toFixed(4)),
    specialistSuccess: Number(specialistDribbleRate.toFixed(4)),
    delta: Number((specialistDribbleRate - baselineDribbleRate).toFixed(4)),
  },
  aerialSpecialist: {
    baselineHeadedShots: sample.baselineHeaders,
    specialistHeadedShots: sample.specialistHeaders,
    increase: Number((sample.specialistHeaders / sample.baselineHeaders - 1).toFixed(4)),
  },
  goalkeepingSpecialist: {
    baselineGoalsConceded: sample.baselineHomeGoals,
    specialistGoalsConceded: sample.eliteKeeperHomeGoals,
    reduction: Number((1 - sample.eliteKeeperHomeGoals / sample.baselineHomeGoals).toFixed(4)),
  },
}, null, 2));
