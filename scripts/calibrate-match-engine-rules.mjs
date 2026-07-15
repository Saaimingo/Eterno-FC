import {
  adjustRoleAssignment,
  adjustTacticalPlan,
  createPrototypeMatchInput,
  simulateMatch,
} from "../app/match-engine/index.ts";

const requestedPairs = Number(process.argv[2] ?? 1_000);
if (!Number.isInteger(requestedPairs) || requestedPairs < 1 || requestedPairs > 10_000) {
  throw new Error("Informe uma quantidade inteira entre 1 e 10000 pares de partidas.");
}

const sample = {
  goals: 0,
  possessions: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  offsides: 0,
  corners: 0,
  penalties: 0,
  penaltyGoals: 0,
  rebounds: 0,
  attackingRebounds: 0,
  stoppageSeconds: 0,
  calmFouls: 0,
  strictFouls: 0,
  calmCards: 0,
  strictCards: 0,
  cautiousOffsides: 0,
  aggressiveOffsides: 0,
  dismissalBoundaryViolations: 0,
  causalViolations: 0,
};

function eventCount(result, type) {
  return result.events.filter((event) => event.type === type).length;
}

function withReferee(input, changes) {
  return {
    ...input,
    context: {
      ...input.context,
      referee: { ...input.context.referee, ...changes },
    },
  };
}

function offsidePlan(team, receiverId, aggressive) {
  const tactical = adjustTacticalPlan(team, aggressive
    ? { risk: 86, tempo: 82, passingStyle: "direct", defensiveLine: 78 }
    : { risk: 24, tempo: 34, passingStyle: "short", defensiveLine: 30 });
  return adjustRoleAssignment(tactical, receiverId, aggressive
    ? { role: "poacher", instructions: { movement: "get_forward", risk: 85 } }
    : { role: "mobile_forward", instructions: { movement: "hold", risk: 25 } });
}

for (let index = 0; index < requestedPairs; index += 1) {
  const input = createPrototypeMatchInput(`rules-calibration-${index}`);
  const baseline = simulateMatch(input);
  const statistics = [baseline.statistics.home, baseline.statistics.away];
  sample.goals += baseline.finalState.score[0] + baseline.finalState.score[1];
  sample.possessions += statistics.reduce((sum, team) => sum + team.possessions, 0);
  sample.fouls += statistics.reduce((sum, team) => sum + team.foulsCommitted, 0);
  sample.yellowCards += statistics.reduce((sum, team) => sum + team.yellowCards, 0);
  sample.redCards += statistics.reduce((sum, team) => sum + team.redCards, 0);
  sample.offsides += statistics.reduce((sum, team) => sum + team.offsides, 0);
  sample.corners += statistics.reduce((sum, team) => sum + team.corners, 0);
  sample.penalties += statistics.reduce((sum, team) => sum + team.penalties, 0);
  sample.rebounds += baseline.events.filter((event) => event.type === "rebound").length;
  sample.attackingRebounds += baseline.events.filter((event) => event.type === "rebound" && event.outcome === "attacker_recovered").length;
  sample.stoppageSeconds += baseline.events.filter((event) => event.type === "stoppage_time")
    .reduce((sum, event) => sum + Number(event.audit?.details?.addedSeconds ?? 0), 0);

  for (const penalty of baseline.events.filter((event) => event.type === "penalty_kick")) {
    const shot = baseline.events.find((event) => event.type === "shot" && event.causes.includes(penalty.eventId));
    if (shot && baseline.events.some((event) => event.type === "goal" && event.causes.includes(shot.eventId))) {
      sample.penaltyGoals += 1;
    }
  }

  const calm = simulateMatch(withReferee(input, { strictness: 28, cardTendency: 25 }));
  const strict = simulateMatch(withReferee(input, { strictness: 78, cardTendency: 78 }));
  sample.calmFouls += eventCount(calm, "foul");
  sample.strictFouls += eventCount(strict, "foul");
  sample.calmCards += eventCount(calm, "yellow_card") + eventCount(calm, "red_card");
  sample.strictCards += eventCount(strict, "yellow_card") + eventCount(strict, "red_card");

  const striker = input.home.players.find((player) => player.position === "ST");
  if (!striker) throw new Error("Atacante ausente na calibração de impedimento.");
  const cautious = simulateMatch({
    ...input,
    home: offsidePlan(input.home, striker.id, false),
    away: adjustTacticalPlan(input.away, { defensiveLine: 25 }),
  });
  const aggressive = simulateMatch({
    ...input,
    home: offsidePlan(input.home, striker.id, true),
    away: adjustTacticalPlan(input.away, { defensiveLine: 82 }),
  });
  sample.cautiousOffsides += cautious.statistics.home.offsides;
  sample.aggressiveOffsides += aggressive.statistics.home.offsides;

  for (const dismissal of baseline.events.filter((event) => event.type === "red_card")) {
    const laterAction = baseline.events.some((event) => event.sequence > dismissal.sequence
      && (event.actorId === dismissal.actorId
        || event.targetId === dismissal.actorId
        || event.opponentIds.includes(dismissal.actorId)));
    if (laterAction) sample.dismissalBoundaryViolations += 1;
  }
  for (const event of baseline.events) {
    const causeTypes = event.causes.map((cause) => baseline.events.find((candidate) => candidate.eventId === cause)?.type);
    if (event.type === "offside" && !causeTypes.includes("pass_attempt")) sample.causalViolations += 1;
    if (event.type === "rebound" && !causeTypes.includes("save")) sample.causalViolations += 1;
    if (event.type === "penalty_kick"
      && !causeTypes.some((type) => ["foul", "yellow_card", "red_card"].includes(type))) {
      sample.causalViolations += 1;
    }
  }
}

const penaltyConversion = sample.penalties ? sample.penaltyGoals / sample.penalties : 0;
const attackingReboundShare = sample.rebounds ? sample.attackingRebounds / sample.rebounds : 0;

console.log(JSON.stringify({
  pairs: requestedPairs,
  averages: {
    goals: Number((sample.goals / requestedPairs).toFixed(4)),
    possessions: Number((sample.possessions / requestedPairs).toFixed(4)),
    fouls: Number((sample.fouls / requestedPairs).toFixed(4)),
    yellowCards: Number((sample.yellowCards / requestedPairs).toFixed(4)),
    redCards: Number((sample.redCards / requestedPairs).toFixed(4)),
    offsides: Number((sample.offsides / requestedPairs).toFixed(4)),
    corners: Number((sample.corners / requestedPairs).toFixed(4)),
    penalties: Number((sample.penalties / requestedPairs).toFixed(4)),
    rebounds: Number((sample.rebounds / requestedPairs).toFixed(4)),
    stoppageMinutes: Number((sample.stoppageSeconds / requestedPairs / 60).toFixed(4)),
  },
  refereeSensitivity: {
    calmFouls: sample.calmFouls,
    strictFouls: sample.strictFouls,
    foulIncrease: Number((sample.strictFouls / sample.calmFouls - 1).toFixed(4)),
    calmCards: sample.calmCards,
    strictCards: sample.strictCards,
    cardIncrease: Number((sample.strictCards / sample.calmCards - 1).toFixed(4)),
  },
  offsideSensitivity: {
    cautious: sample.cautiousOffsides,
    aggressive: sample.aggressiveOffsides,
    increase: Number((sample.aggressiveOffsides / sample.cautiousOffsides - 1).toFixed(4)),
  },
  resolutions: {
    penaltyConversion: Number(penaltyConversion.toFixed(4)),
    attackingReboundShare: Number(attackingReboundShare.toFixed(4)),
  },
  invariants: {
    dismissalBoundaryViolations: sample.dismissalBoundaryViolations,
    causalViolations: sample.causalViolations,
  },
}, null, 2));
