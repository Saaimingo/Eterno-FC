import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE_ATTRIBUTE_KEYS,
  EventLedger,
  adjustTeamAttributes,
  calculatePassProbability,
  createPrototypeMatchInput,
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
