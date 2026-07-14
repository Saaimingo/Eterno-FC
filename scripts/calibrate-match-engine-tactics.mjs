import {
  adjustPlayerTraits,
  calculatePassProbability,
  createPrototypeMatchInput,
  scheduleMatchInterventions,
  simulateMatch,
} from "../app/match-engine/index.ts";

const requestedPairs = Number(process.argv[2] ?? 1_000);
if (!Number.isInteger(requestedPairs) || requestedPairs < 1 || requestedPairs > 10_000) {
  throw new Error("Informe uma quantidade inteira entre 1 e 10000 pares de partidas.");
}

const tacticalClockMs = 2_700_001;
const substitutionClockMs = 1_800_000;
const sample = {
  exactFuturePrefixes: 0,
  baselinePostChangeCrosses: 0,
  widePostChangeCrosses: 0,
  wideWins: 0,
  wideDraws: 0,
  wideLosses: 0,
  baselineTraitCrosses: 0,
  earlyCrossTraitCrosses: 0,
  substitutionBoundaryViolations: 0,
  substituteActions: 0,
};

for (let index = 0; index < requestedPairs; index += 1) {
  const input = createPrototypeMatchInput(`tactical-calibration-${index}`);
  const baseline = simulateMatch(input);
  const wideInput = scheduleMatchInterventions(input, [{
    id: `wide-${index}`,
    type: "tactical_change",
    teamId: input.home.id,
    clockMs: tacticalClockMs,
    changes: {
      mentality: "attacking",
      width: 100,
      attackingFocus: "flanks",
      tempo: 68,
      risk: 64,
    },
    assignmentChanges: [],
  }]);
  const wide = simulateMatch(wideInput);
  const baselinePrefix = baseline.events.filter((event) => event.clockMs < tacticalClockMs);
  const widePrefix = wide.events.filter((event) => event.clockMs < tacticalClockMs);
  if (JSON.stringify(baselinePrefix) === JSON.stringify(widePrefix)) sample.exactFuturePrefixes += 1;
  sample.baselinePostChangeCrosses += baseline.events.filter((event) => event.clockMs > tacticalClockMs
    && event.teamId === input.home.id && event.type === "cross_attempt").length;
  sample.widePostChangeCrosses += wide.events.filter((event) => event.clockMs > tacticalClockMs
    && event.teamId === input.home.id && event.type === "cross_attempt").length;
  if (wide.finalState.score[0] > wide.finalState.score[1]) sample.wideWins += 1;
  else if (wide.finalState.score[0] < wide.finalState.score[1]) sample.wideLosses += 1;
  else sample.wideDraws += 1;

  const earlyCrossTeam = adjustPlayerTraits(input.home, "aurora-p10", [
    "cuts_inside", "runs_with_ball", "early_crosses",
  ]);
  const earlyCross = simulateMatch({ ...input, home: earlyCrossTeam });
  sample.baselineTraitCrosses += baseline.events.filter((event) => event.actorId === "aurora-p10"
    && event.type === "cross_attempt").length;
  sample.earlyCrossTraitCrosses += earlyCross.events.filter((event) => event.actorId === "aurora-p10"
    && event.type === "cross_attempt").length;

  const outgoing = input.home.assignments.find((assignment) => assignment.playerId === "aurora-p11");
  if (!outgoing) throw new Error("Atacante titular sem função no protótipo.");
  const substitutionInput = scheduleMatchInterventions(input, [{
    id: `sub-${index}`,
    type: "substitution",
    teamId: input.home.id,
    clockMs: substitutionClockMs,
    playerOutId: "aurora-p11",
    playerInId: "aurora-p18",
    assignment: {
      ...outgoing,
      playerId: "aurora-p18",
      role: "poacher",
      tacticalFamiliarity: 86,
      instructions: { ...outgoing.instructions, shoot: 82, movement: "get_forward" },
    },
  }]);
  const substitution = simulateMatch(substitutionInput);
  const entry = substitution.events.find((event) => event.type === "substitution");
  if (!entry) throw new Error("Evento de substituição ausente.");
  const incomingBefore = substitution.events.some((event) => event.sequence < entry.sequence
    && (event.actorId === "aurora-p18" || event.targetId === "aurora-p18" || event.opponentIds.includes("aurora-p18")));
  const outgoingAfter = substitution.events.some((event) => event.sequence > entry.sequence
    && (event.actorId === "aurora-p11" || event.targetId === "aurora-p11" || event.opponentIds.includes("aurora-p11")));
  if (incomingBefore || outgoingAfter) sample.substitutionBoundaryViolations += 1;
  sample.substituteActions += substitution.events.filter((event) => event.sequence > entry.sequence
    && (event.actorId === "aurora-p18" || event.targetId === "aurora-p18")).length;
}

const familiarityInput = createPrototypeMatchInput("familiarity-calibration");
const passer = familiarityInput.home.players.find((player) => player.position === "CM");
const receiver = familiarityInput.home.players.find((player) => player.position === "AM");
const defender = familiarityInput.away.players.find((player) => player.position === "DM");
if (!passer || !receiver || !defender) throw new Error("Perfis de familiaridade ausentes no protótipo.");
const familiarPass = calculatePassProbability({
  passer,
  receiver,
  defender,
  phase: "creation",
  tactics: familiarityInput.home.tactics,
  homeAdvantage: 3,
  passerFamiliarity: 96,
  receiverFamiliarity: 94,
  defenderFamiliarity: 90,
});
const improvisedPass = calculatePassProbability({
  passer,
  receiver,
  defender,
  phase: "creation",
  tactics: familiarityInput.home.tactics,
  homeAdvantage: 3,
  passerFamiliarity: 18,
  receiverFamiliarity: 28,
  defenderFamiliarity: 90,
});

console.log(JSON.stringify({
  pairs: requestedPairs,
  futureOnly: {
    exactPrefixes: sample.exactFuturePrefixes,
    violations: requestedPairs - sample.exactFuturePrefixes,
  },
  flankInstruction: {
    baselineCrosses: sample.baselinePostChangeCrosses,
    instructedCrosses: sample.widePostChangeCrosses,
    increase: Number((sample.widePostChangeCrosses / sample.baselinePostChangeCrosses - 1).toFixed(4)),
    results: {
      wins: sample.wideWins,
      draws: sample.wideDraws,
      losses: sample.wideLosses,
    },
  },
  earlyCrossTrait: {
    baselineAttempts: sample.baselineTraitCrosses,
    traitAttempts: sample.earlyCrossTraitCrosses,
    increase: Number((sample.earlyCrossTraitCrosses / sample.baselineTraitCrosses - 1).toFixed(4)),
  },
  familiarity: {
    familiarPass: Number(familiarPass.probability.toFixed(4)),
    improvisedPass: Number(improvisedPass.probability.toFixed(4)),
    delta: Number((familiarPass.probability - improvisedPass.probability).toFixed(4)),
  },
  substitution: {
    boundaryViolations: sample.substitutionBoundaryViolations,
    substituteActions: sample.substituteActions,
  },
}, null, 2));
