import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE_ATTRIBUTE_KEYS,
  PLAYER_ATTRIBUTE_KEYS,
  EventLedger,
  FatigueTracker,
  adjustPlayerAttributes,
  adjustPlayerFeet,
  adjustPlayerTraits,
  attackActionModifier,
  adjustTeamAttributes,
  calculateActionPressure,
  calculateAerialDuelProbability,
  calculateCrossProbability,
  calculateDribbleProbability,
  calculateGoalProbability,
  calculatePassProbability,
  calculateShotOnTargetProbability,
  createPrototypeMatchInput,
  resolveFootUse,
  scheduleMatchInterventions,
  simulateEmptyMatch,
  simulateMatch,
  traceCausalChain,
  validateMatchInput,
} from "../app/match-engine/index.ts";

test("starts and finishes an empty match with a reproducible canonical ledger", () => {
  const first = simulateEmptyMatch(createPrototypeMatchInput("empty-match"));
  const second = simulateEmptyMatch(createPrototypeMatchInput("empty-match"));

  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.finalState.score, [0, 0]);
  assert.deepEqual(first.events.map((event) => event.type), [
    "kickoff", "period_end", "kickoff", "period_end", "match_end",
  ]);
  assert.equal(first.rngTraces.length, 0);
  assert.equal(first.finalState.players.every((player) => player.fatigue === 0), true);
  assert.equal(Object.isFrozen(first.events), true);
  assert.equal(Object.isFrozen(first.events[0]), true);
});

test("replays the same match exactly from the same seed and input", () => {
  const first = simulateMatch(createPrototypeMatchInput("deterministic-replay"));
  const second = simulateMatch(createPrototypeMatchInput("deterministic-replay"));
  const otherSeed = simulateMatch(createPrototypeMatchInput("deterministic-replay-other"));

  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.rngTraces, second.rngTraces);
  assert.deepEqual(first.statistics, second.statistics);
  assert.notDeepEqual(
    first.rngTraces.map((trace) => trace.value),
    otherSeed.rngTraces.map((trace) => trace.value),
  );
});

test("derives every goal and every statistic from confirmed events", () => {
  const result = simulateMatch(createPrototypeMatchInput("causal-0"));
  const goals = result.events.filter((event) => event.type === "goal");
  assert.ok(goals.length > 0);

  for (const goal of goals) {
    const chain = traceCausalChain(result.events, goal.eventId);
    assert.equal(chain.at(-1)?.eventId, goal.eventId);
    assert.equal(chain.some((event) => event.type === "shot"), true);
    assert.equal(chain.some((event) => event.type === "pass_completed"), true);
    assert.equal(chain.some((event) => event.type === "possession_start"), true);
  }

  const homeGoals = goals.filter((event) => event.teamId === result.input.home.id).length;
  const awayGoals = goals.filter((event) => event.teamId === result.input.away.id).length;
  assert.deepEqual(result.finalState.score, [homeGoals, awayGoals]);
  assert.equal(result.statistics.home.goals, homeGoals);
  assert.equal(result.statistics.away.goals, awayGoals);
  assert.equal(
    result.statistics.home.passesAttempted,
    result.events.filter((event) => event.type === "pass_attempt" && event.teamId === result.input.home.id).length,
  );
});

test("keeps pass resolution sensitive only to relevant attributes", () => {
  const input = createPrototypeMatchInput("attribute-isolation");
  const passer = input.home.players.find((player) => player.position === "CM");
  const receiver = input.home.players.find((player) => player.position === "AM");
  const defender = input.away.players.find((player) => player.position === "DM");
  assert.ok(passer && receiver && defender);

  const baseline = calculatePassProbability({
    passer,
    receiver,
    defender,
    phase: "progression",
    tactics: input.home.tactics,
    homeAdvantage: input.context.homeAdvantage,
  });
  const betterPassing = calculatePassProbability({
    passer: { ...passer, attributes: { ...passer.attributes, passing: passer.attributes.passing + 20 } },
    receiver,
    defender,
    phase: "progression",
    tactics: input.home.tactics,
    homeAdvantage: input.context.homeAdvantage,
  });
  const differentFinishing = calculatePassProbability({
    passer: { ...passer, attributes: { ...passer.attributes, finishing: passer.attributes.finishing + 20 } },
    receiver,
    defender,
    phase: "progression",
    tactics: input.home.tactics,
    homeAdvantage: input.context.homeAdvantage,
  });

  assert.ok(betterPassing.probability > baseline.probability);
  assert.equal(differentFinishing.probability, baseline.probability);
});

test("makes a stronger team win more often without guaranteeing victory", () => {
  const boost = Object.fromEntries(CORE_ATTRIBUTE_KEYS.map((attribute) => [attribute, 8]));
  let baselineWins = 0;
  let strongWins = 0;
  let strongLosses = 0;
  let baselineGoals = 0;
  let strongGoals = 0;
  let baselinePassesAttempted = 0;
  let baselinePassesCompleted = 0;
  let strongPassesAttempted = 0;
  let strongPassesCompleted = 0;

  for (let index = 0; index < 160; index += 1) {
    const baselineInput = createPrototypeMatchInput(`sensitivity-${index}`);
    const strongInput = {
      ...baselineInput,
      home: adjustTeamAttributes(baselineInput.home, boost),
    };
    const baseline = simulateMatch(baselineInput);
    const strong = simulateMatch(strongInput);

    if (baseline.finalState.score[0] > baseline.finalState.score[1]) baselineWins += 1;
    if (strong.finalState.score[0] > strong.finalState.score[1]) strongWins += 1;
    if (strong.finalState.score[0] < strong.finalState.score[1]) strongLosses += 1;
    baselineGoals += baseline.finalState.score[0];
    strongGoals += strong.finalState.score[0];
    baselinePassesAttempted += baseline.statistics.home.passesAttempted;
    baselinePassesCompleted += baseline.statistics.home.passesCompleted;
    strongPassesAttempted += strong.statistics.home.passesAttempted;
    strongPassesCompleted += strong.statistics.home.passesCompleted;
  }

  assert.ok(strongWins > baselineWins + 30);
  assert.ok(strongWins < 155);
  assert.ok(strongLosses > 0);
  assert.ok(strongGoals > baselineGoals + 60);
  assert.ok(strongPassesCompleted / strongPassesAttempted > baselinePassesCompleted / baselinePassesAttempted + 0.015);
});

test("rejects invalid teams, future causes and events after the final whistle", () => {
  const input = createPrototypeMatchInput("invalid-contracts");
  assert.throws(
    () => validateMatchInput({ ...input, home: { ...input.home, players: input.home.players.slice(0, 10) } }),
    /exatamente 11 jogadores/,
  );

  const ledger = new EventLedger("ledger-test", "home", "away");
  const kickoff = ledger.append({
    clockMs: 0,
    period: 1,
    type: "kickoff",
    teamId: "home",
  });
  assert.throws(
    () => ledger.append({
      clockMs: 1_000,
      period: 1,
      type: "goal",
      teamId: "home",
      causes: ["future-event"],
    }),
    /Causa inexistente ou futura/,
  );
  ledger.append({
    clockMs: 2_000,
    period: 1,
    type: "match_end",
    teamId: null,
    causes: [kickoff.eventId],
  });
  assert.throws(
    () => ledger.append({ clockMs: 3_000, period: 1, type: "kickoff", teamId: "away" }),
    /após match_end/,
  );
});

test("models the complete MP-2 attribute set and independent foot proficiency", () => {
  const input = createPrototypeMatchInput("feet-contract");
  const player = input.home.players.find((candidate) => candidate.position === "RB");
  assert.ok(player);
  assert.equal(PLAYER_ATTRIBUTE_KEYS.length, 47);
  assert.equal(PLAYER_ATTRIBUTE_KEYS.every((attribute) => Number.isFinite(player.attributes[attribute])), true);

  const right = resolveFootUse(player, "right", true);
  const left = resolveFootUse(player, "left", true);
  assert.equal(right.foot, "right");
  assert.equal(left.foot, "left");
  assert.ok(right.proficiency > left.proficiency + 20);
  assert.equal(left.isWeakFoot, true);

  const receiver = input.home.players.find((candidate) => candidate.position === "AM");
  const defender = input.away.players.find((candidate) => candidate.position === "DM");
  assert.ok(receiver && defender);
  const dominantPass = calculatePassProbability({
    passer: player,
    receiver,
    defender,
    phase: "progression",
    tactics: input.home.tactics,
    homeAdvantage: input.context.homeAdvantage,
    foot: right,
  });
  const weakPass = calculatePassProbability({
    passer: player,
    receiver,
    defender,
    phase: "progression",
    tactics: input.home.tactics,
    homeAdvantage: input.context.homeAdvantage,
    foot: left,
  });
  assert.ok(dominantPass.probability > weakPass.probability + 0.015);
});

test("isolates crossing skill from unrelated finishing", () => {
  const input = createPrototypeMatchInput("cross-isolation");
  const crosser = input.home.players.find((player) => player.position === "RB");
  const marker = input.away.players.find((player) => player.position === "LB");
  assert.ok(crosser && marker);
  const foot = resolveFootUse(crosser, "right", true);
  const baseline = calculateCrossProbability({ crosser, marker, homeAdvantage: 3, foot });
  const betterCrossing = calculateCrossProbability({
    crosser: { ...crosser, attributes: { ...crosser.attributes, crossing: crosser.attributes.crossing + 20 } },
    marker,
    homeAdvantage: 3,
    foot,
  });
  const betterFinishing = calculateCrossProbability({
    crosser: { ...crosser, attributes: { ...crosser.attributes, finishing: crosser.attributes.finishing + 20 } },
    marker,
    homeAdvantage: 3,
    foot,
  });
  assert.ok(betterCrossing.probability > baseline.probability + 0.035);
  assert.equal(betterFinishing.probability, baseline.probability);
});

test("resolves dribble against the defender's contextual tackling profile", () => {
  const input = createPrototypeMatchInput("dribble-duel");
  const dribbler = input.home.players.find((player) => player.position === "RW");
  const defender = input.away.players.find((player) => player.position === "LB");
  assert.ok(dribbler && defender);
  const baseline = calculateDribbleProbability({ dribbler, defender, homeAdvantage: 3 });
  const eliteDribbler = calculateDribbleProbability({
    dribbler: { ...dribbler, attributes: { ...dribbler.attributes, dribbling: dribbler.attributes.dribbling + 20 } },
    defender,
    homeAdvantage: 3,
  });
  const eliteTackler = calculateDribbleProbability({
    dribbler,
    defender: { ...defender, attributes: { ...defender.attributes, tackling: defender.attributes.tackling + 20 } },
    homeAdvantage: 3,
  });
  const betterHeader = calculateDribbleProbability({
    dribbler: { ...dribbler, attributes: { ...dribbler.attributes, heading: dribbler.attributes.heading + 20 } },
    defender,
    homeAdvantage: 3,
  });
  assert.ok(eliteDribbler.probability > baseline.probability);
  assert.ok(eliteTackler.probability < baseline.probability);
  assert.equal(betterHeader.probability, baseline.probability);
});

test("separates winning an aerial duel from directing the header", () => {
  const input = createPrototypeMatchInput("aerial-separation");
  const attacker = input.home.players.find((player) => player.position === "ST");
  const defender = input.away.players.find((player) => player.position === "CB");
  assert.ok(attacker && defender);
  const baselineDuel = calculateAerialDuelProbability({ attacker, defender });
  const betterReach = calculateAerialDuelProbability({
    attacker: {
      ...attacker,
      attributes: {
        ...attacker.attributes,
        jumpingReach: attacker.attributes.jumpingReach + 15,
        strength: attacker.attributes.strength + 10,
      },
    },
    defender,
  });
  const betterHeading = calculateAerialDuelProbability({
    attacker: { ...attacker, attributes: { ...attacker.attributes, heading: attacker.attributes.heading + 20 } },
    defender,
  });
  assert.ok(betterReach.probability > baselineDuel.probability);
  assert.equal(betterHeading.probability, baselineDuel.probability);

  const baselineHeader = calculateShotOnTargetProbability({
    shooter: attacker,
    marker: defender,
    tactics: input.home.tactics,
    homeAdvantage: 3,
    shotType: "header",
  });
  const accurateHeader = calculateShotOnTargetProbability({
    shooter: { ...attacker, attributes: { ...attacker.attributes, heading: attacker.attributes.heading + 20 } },
    marker: defender,
    tactics: input.home.tactics,
    homeAdvantage: 3,
    shotType: "header",
  });
  assert.ok(accurateHeader.probability > baselineHeader.probability);
});

test("uses goalkeeper attributes only in the confrontations they govern", () => {
  const input = createPrototypeMatchInput("goalkeeper-profile");
  const shooter = input.home.players.find((player) => player.position === "ST");
  const goalkeeper = input.away.players.find((player) => player.position === "GK");
  assert.ok(shooter && goalkeeper);
  const baseline = calculateGoalProbability({ shooter, goalkeeper, homeAdvantage: 3 });
  const eliteKeeper = calculateGoalProbability({
    shooter,
    goalkeeper: {
      ...goalkeeper,
      attributes: {
        ...goalkeeper.attributes,
        reflexes: goalkeeper.attributes.reflexes + 15,
        oneOnOnes: goalkeeper.attributes.oneOnOnes + 15,
      },
    },
    homeAdvantage: 3,
  });
  const keeperWithCrossing = calculateGoalProbability({
    shooter,
    goalkeeper: { ...goalkeeper, attributes: { ...goalkeeper.attributes, crossing: goalkeeper.attributes.crossing + 20 } },
    homeAdvantage: 3,
  });
  assert.ok(eliteKeeper.probability < baseline.probability);
  assert.equal(keeperWithCrossing.probability, baseline.probability);
});

test("lets stamina reduce accumulated fatigue and fatigue reduce late execution", () => {
  const input = createPrototypeMatchInput("fatigue-model");
  const base = input.home.players.find((player) => player.position === "CM");
  const receiver = input.home.players.find((player) => player.position === "AM");
  const defender = input.away.players.find((player) => player.position === "DM");
  assert.ok(base && receiver && defender);
  const highStamina = {
    ...base,
    id: `${base.id}-high`,
    attributes: { ...base.attributes, stamina: 95, naturalFitness: 90 },
  };
  const lowStamina = {
    ...base,
    id: `${base.id}-low`,
    attributes: { ...base.attributes, stamina: 35, naturalFitness: 40 },
  };
  const tracker = new FatigueTracker([highStamina, lowStamina]);
  for (let index = 0; index < 40; index += 1) {
    tracker.exert(highStamina, 0.8);
    tracker.exert(lowStamina, 0.8);
  }
  assert.ok(tracker.value(highStamina) < tracker.value(lowStamina) - 4);

  const fresh = calculatePassProbability({
    passer: base,
    receiver,
    defender,
    phase: "creation",
    tactics: input.home.tactics,
    homeAdvantage: 3,
    passerFatigue: 5,
    pressure: 55,
  });
  const exhausted = calculatePassProbability({
    passer: base,
    receiver,
    defender,
    phase: "creation",
    tactics: input.home.tactics,
    homeAdvantage: 3,
    passerFatigue: 85,
    pressure: 55,
  });
  assert.ok(fresh.probability > exhausted.probability + 0.015);
});

test("raises pressure late in a close important match without scripting a goal", () => {
  const input = createPrototypeMatchInput("pressure-model");
  const common = {
    context: { ...input.context, importance: 90 },
    period: 2,
    phase: "danger",
    score: [0, 0],
    attackingTeamId: input.home.id,
    homeTeamId: input.home.id,
    awayTeamId: input.away.id,
  };
  const early = calculateActionPressure({ ...common, clockMs: 600_000 });
  const late = calculateActionPressure({ ...common, clockMs: 5_100_000 });
  assert.ok(late > early + 15);
  assert.ok(late <= 100);
});

test("registers MP-2 confrontations as causal events and derives their statistics", () => {
  const results = Array.from({ length: 10 }, (_, index) => simulateMatch(createPrototypeMatchInput(`mp2-events-${index}`)));
  const events = results.flatMap((result) => result.events);
  assert.ok(events.some((event) => event.type === "dribble_attempt"));
  assert.ok(events.some((event) => event.type === "tackle"));
  assert.ok(events.some((event) => event.type === "cross_attempt"));
  assert.ok(events.some((event) => event.type === "aerial_duel"));
  assert.ok(events.some((event) => ["goalkeeper_claim", "goalkeeper_punch"].includes(event.type)));

  for (const result of results) {
    const homeCrosses = result.events.filter((event) => event.type === "cross_attempt" && event.teamId === result.input.home.id).length;
    const homeDribbles = result.events.filter((event) => event.type === "dribble_attempt" && event.teamId === result.input.home.id).length;
    assert.equal(result.statistics.home.crossesAttempted, homeCrosses);
    assert.equal(result.statistics.home.dribblesAttempted, homeDribbles);
  }
});

test("keeps foot, attribute and condition helpers immutable", () => {
  const input = createPrototypeMatchInput("immutable-adjustments");
  const player = input.home.players.find((candidate) => candidate.position === "ST");
  assert.ok(player);
  const changedAttributes = adjustPlayerAttributes(input.home, player.id, { heading: 12 });
  const changedFeet = adjustPlayerFeet(input.home, player.id, { left: 900, avoidsWeakFoot: false });
  assert.equal(input.home.players.find((candidate) => candidate.id === player.id)?.attributes.heading, player.attributes.heading);
  assert.equal(changedAttributes.players.find((candidate) => candidate.id === player.id)?.attributes.heading, player.attributes.heading + 12);
  assert.equal(changedFeet.players.find((candidate) => candidate.id === player.id)?.feet.left, 900);
  assert.equal(Object.isFrozen(changedAttributes.players), true);
});

test("makes contextual specialists measurably better without a scripted star tag", () => {
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
  };

  for (let index = 0; index < 200; index += 1) {
    const input = createPrototypeMatchInput(`specialist-test-${index}`);
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

    for (const event of baseline.events) {
      if (event.actorId === "aurora-p2" && event.type === "cross_attempt") sample.baselineCrossAttempts += 1;
      if (event.actorId === "aurora-p2" && event.type === "cross_completed") sample.baselineCrosses += 1;
      if (event.actorId === "aurora-p9" && event.type === "dribble_attempt") sample.baselineDribbleAttempts += 1;
      if (event.actorId === "aurora-p9" && event.type === "dribble_won") sample.baselineDribbles += 1;
      if (event.actorId === "aurora-p11" && event.type === "shot" && event.tags.includes("header")) sample.baselineHeaders += 1;
    }
    for (const event of crossingSpecialist.events) {
      if (event.actorId === "aurora-p2" && event.type === "cross_attempt") sample.specialistCrossAttempts += 1;
      if (event.actorId === "aurora-p2" && event.type === "cross_completed") sample.specialistCrosses += 1;
    }
    for (const event of dribblingSpecialist.events) {
      if (event.actorId === "aurora-p9" && event.type === "dribble_attempt") sample.specialistDribbleAttempts += 1;
      if (event.actorId === "aurora-p9" && event.type === "dribble_won") sample.specialistDribbles += 1;
    }
    for (const event of aerialSpecialist.events) {
      if (event.actorId === "aurora-p11" && event.type === "shot" && event.tags.includes("header")) sample.specialistHeaders += 1;
    }
  }

  const baselineCrossRate = sample.baselineCrosses / sample.baselineCrossAttempts;
  const specialistCrossRate = sample.specialistCrosses / sample.specialistCrossAttempts;
  const baselineDribbleRate = sample.baselineDribbles / sample.baselineDribbleAttempts;
  const specialistDribbleRate = sample.specialistDribbles / sample.specialistDribbleAttempts;
  assert.ok(specialistCrossRate > baselineCrossRate + 0.04);
  assert.ok(specialistDribbleRate > baselineDribbleRate + 0.04);
  assert.ok(sample.specialistHeaders > sample.baselineHeaders * 1.15);
});

test("validates MP-3 roles, positional familiarity, instructions and the bench", () => {
  const input = createPrototypeMatchInput("mp3-contracts");
  assert.equal(input.home.players.length, 11);
  assert.equal(input.home.bench.length, 7);
  assert.equal(input.home.assignments.length, 11);
  assert.equal(new Set(input.home.assignments.map((assignment) => assignment.playerId)).size, 11);
  assert.equal(input.home.assignments.filter((assignment) => assignment.position === "GK").length, 1);
  assert.equal(input.home.players.every((player) => player.positionFamiliarity[player.position] === 100), true);

  const player = input.home.players[1];
  const invalidPlayer = {
    ...player,
    positionFamiliarity: { ...player.positionFamiliarity, [player.position]: 101 },
  };
  assert.throws(
    () => validateMatchInput({
      ...input,
      home: { ...input.home, players: [input.home.players[0], invalidPlayer, ...input.home.players.slice(2)] },
    }),
    /Familiaridade/,
  );

  const striker = input.home.assignments.find((assignment) => assignment.playerId === "aurora-p11");
  const winger = input.home.assignments.find((assignment) => assignment.playerId === "aurora-p9");
  assert.ok(striker && winger);
  const illegalReentry = scheduleMatchInterventions(input, [{
    id: "first-sub",
    type: "substitution",
    teamId: input.home.id,
    clockMs: 1_000_000,
    playerOutId: "aurora-p11",
    playerInId: "aurora-p18",
    assignment: { ...striker, playerId: "aurora-p18" },
  }, {
    id: "illegal-reentry",
    type: "substitution",
    teamId: input.home.id,
    clockMs: 2_000_000,
    playerOutId: "aurora-p9",
    playerInId: "aurora-p11",
    assignment: { ...winger, playerId: "aurora-p11" },
  }]);
  assert.throws(() => validateMatchInput(illegalReentry), /não está no banco/);
});

test("uses traits to change choice frequency without granting automatic execution quality", () => {
  const probabilityInput = createPrototypeMatchInput("trait-probability");
  const crosser = probabilityInput.home.players.find((player) => player.id === "aurora-p10");
  const marker = probabilityInput.away.players.find((player) => player.position === "LB");
  assert.ok(crosser && marker);
  const earlyCrosser = { ...crosser, traits: [...crosser.traits, "early_crosses"] };
  const baselineExecution = calculateCrossProbability({ crosser, marker, homeAdvantage: 3 });
  const traitExecution = calculateCrossProbability({ crosser: earlyCrosser, marker, homeAdvantage: 3 });
  assert.equal(traitExecution.probability, baselineExecution.probability);
  assert.ok(
    attackActionModifier(probabilityInput.home, earlyCrosser, "cross")
      > attackActionModifier(probabilityInput.home, crosser, "cross") + 20,
  );

  let baselineAttempts = 0;
  let traitAttempts = 0;
  for (let index = 0; index < 120; index += 1) {
    const input = createPrototypeMatchInput(`trait-choice-${index}`);
    const withoutEarlyCross = adjustPlayerTraits(input.home, "aurora-p10", ["cuts_inside", "runs_with_ball"]);
    const withEarlyCross = adjustPlayerTraits(input.home, "aurora-p10", ["cuts_inside", "runs_with_ball", "early_crosses"]);
    const baseline = simulateMatch({ ...input, home: withoutEarlyCross });
    const changed = simulateMatch({ ...input, home: withEarlyCross });
    baselineAttempts += baseline.events.filter((event) => event.type === "cross_attempt" && event.actorId === "aurora-p10").length;
    traitAttempts += changed.events.filter((event) => event.type === "cross_attempt" && event.actorId === "aurora-p10").length;
  }
  assert.ok(traitAttempts > baselineAttempts * 1.18);
});

test("penalizes unfamiliar deployment without erasing the player's attributes", () => {
  const input = createPrototypeMatchInput("familiarity-execution");
  const passer = input.home.players.find((player) => player.position === "CM");
  const receiver = input.home.players.find((player) => player.position === "AM");
  const defender = input.away.players.find((player) => player.position === "DM");
  assert.ok(passer && receiver && defender);
  const familiar = calculatePassProbability({
    passer,
    receiver,
    defender,
    phase: "creation",
    tactics: input.home.tactics,
    homeAdvantage: 3,
    passerFamiliarity: 96,
    receiverFamiliarity: 94,
    defenderFamiliarity: 90,
  });
  const improvised = calculatePassProbability({
    passer,
    receiver,
    defender,
    phase: "creation",
    tactics: input.home.tactics,
    homeAdvantage: 3,
    passerFamiliarity: 18,
    receiverFamiliarity: 28,
    defenderFamiliarity: 90,
  });
  assert.deepEqual(passer.attributes, input.home.players.find((player) => player.id === passer.id)?.attributes);
  assert.ok(familiar.probability > improvised.probability + 0.015);
});

test("applies tactical changes only to future events and records the coach decision causally", () => {
  const input = createPrototypeMatchInput("future-only-tactics");
  const wingerAssignment = input.home.assignments.find((assignment) => assignment.playerId === "aurora-p9");
  assert.ok(wingerAssignment);
  const clockMs = 3_300_000;
  const changedInput = scheduleMatchInterventions(input, [{
    id: "aurora-chase-game",
    type: "tactical_change",
    teamId: input.home.id,
    clockMs,
    changes: {
      formation: "4-2-4",
      mentality: "attacking",
      risk: 82,
      tempo: 76,
      width: 84,
      pressingLine: 76,
      pressingIntensity: 78,
      passingStyle: "direct",
      attackingFocus: "flanks",
      transitionStyle: "counter",
      creativeFreedom: 72,
    },
    assignmentChanges: [{
      ...wingerAssignment,
      role: "inside_forward",
      tacticalFamiliarity: 74,
      instructions: { ...wingerAssignment.instructions, cross: 35, shoot: 78, width: "narrow" },
    }],
  }]);
  const baseline = simulateMatch(input);
  const changed = simulateMatch(changedInput);
  const decision = changed.events.find((event) => event.type === "tactical_change");
  assert.ok(decision);
  assert.equal(decision.clockMs, clockMs);
  assert.deepEqual(decision.scoreBefore, decision.scoreAfter);
  assert.deepEqual(
    changed.events.filter((event) => event.clockMs < clockMs),
    baseline.events.filter((event) => event.clockMs < clockMs),
  );
  assert.notDeepEqual(
    changed.events.filter((event) => event.clockMs > clockMs).slice(0, 20),
    baseline.events.filter((event) => event.clockMs > clockMs).slice(0, 20),
  );
  assert.equal(decision.causes.length, 1);
});

test("keeps substitutes outside the simulation until their canonical entry event", () => {
  const input = createPrototypeMatchInput("substitution-boundary");
  const outgoing = input.home.assignments.find((assignment) => assignment.playerId === "aurora-p11");
  assert.ok(outgoing);
  const clockMs = 1_800_000;
  const changedInput = scheduleMatchInterventions(input, [{
    id: "aurora-super-sub",
    type: "substitution",
    teamId: input.home.id,
    clockMs,
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
  const result = simulateMatch(changedInput);
  const substitution = result.events.find((event) => event.type === "substitution");
  assert.ok(substitution);
  assert.equal(substitution.actorId, "aurora-p11");
  assert.equal(substitution.targetId, "aurora-p18");
  assert.equal(result.events.some((event) => event.sequence < substitution.sequence
    && (event.actorId === "aurora-p18" || event.targetId === "aurora-p18" || event.opponentIds.includes("aurora-p18"))), false);
  assert.equal(result.events.some((event) => event.sequence > substitution.sequence
    && (event.actorId === "aurora-p11" || event.targetId === "aurora-p11" || event.opponentIds.includes("aurora-p11"))), false);
  assert.equal(result.events.some((event) => event.sequence > substitution.sequence
    && (event.actorId === "aurora-p18" || event.targetId === "aurora-p18")), true);

  const outgoingState = result.finalState.players.find((player) => player.playerId === "aurora-p11");
  const incomingState = result.finalState.players.find((player) => player.playerId === "aurora-p18");
  assert.equal(outgoingState?.status, "substituted");
  assert.equal(outgoingState?.exitedAtMs, clockMs);
  assert.equal(incomingState?.status, "active");
  assert.equal(incomingState?.enteredAtMs, clockMs);
  assert.equal(incomingState?.role, "poacher");
});

test("makes a flank intervention measurable without turning it into a guaranteed win", () => {
  let baselineCrosses = 0;
  let changedCrosses = 0;
  let changedWins = 0;
  let changedNonWins = 0;
  const clockMs = 2_700_001;

  for (let index = 0; index < 100; index += 1) {
    const input = createPrototypeMatchInput(`coach-sensitivity-${index}`);
    const changedInput = scheduleMatchInterventions(input, [{
      id: `wide-${index}`,
      type: "tactical_change",
      teamId: input.home.id,
      clockMs,
      changes: {
        mentality: "attacking",
        width: 100,
        attackingFocus: "flanks",
        tempo: 68,
        risk: 64,
      },
      assignmentChanges: [],
    }]);
    const baseline = simulateMatch(input);
    const changed = simulateMatch(changedInput);
    baselineCrosses += baseline.events.filter((event) => event.clockMs > clockMs
      && event.teamId === input.home.id && event.type === "cross_attempt").length;
    changedCrosses += changed.events.filter((event) => event.clockMs > clockMs
      && event.teamId === input.home.id && event.type === "cross_attempt").length;
    if (changed.finalState.score[0] > changed.finalState.score[1]) changedWins += 1;
    else changedNonWins += 1;
  }

  assert.ok(changedCrosses > baselineCrosses * 1.12);
  assert.ok(changedWins > 0);
  assert.ok(changedNonWins > 0);
});
