import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMatchPlan,
  createNewGame,
  finishRound,
  nextUserFixture,
} from "../app/game.ts";
import {
  compareShadowMatch,
  simulateVNextFixture,
} from "../app/match-adapter.ts";
import {
  candidateCanDriveMatch,
  projectVNextMatchPlan,
} from "../app/match-presentation.ts";

function context(name = "presentation") {
  const game = createNewGame("Técnico Visual", "florianopolis", name);
  const fixture = nextUserFixture(game);
  assert.ok(fixture);
  return { game, fixture };
}

test("projects every canonical goal into score, narration and a pitch destination", () => {
  const { game, fixture } = context("all-goals");
  const result = simulateVNextFixture(game, fixture);
  const shadow = compareShadowMatch([0, 0], [8, 8], 50, result);
  assert.equal(candidateCanDriveMatch(game, fixture, result), true);
  const plan = projectVNextMatchPlan(game, fixture, result, shadow);
  const goals = plan.events.filter((event) => event.type === "goal");
  assert.equal(plan.engineSource, "vnext");
  assert.deepEqual([plan.homeGoals, plan.awayGoals], result.finalState.score);
  assert.equal(goals.length, plan.homeGoals + plan.awayGoals);
  assert.ok(goals.every((event) => event.id && event.minuteLabel && event.destination));
  assert.ok(goals.every((event) => event.text.startsWith("GOOOL DO")));
  assert.deepEqual(goals.at(-1)?.scoreAfter, result.finalState.score);
});

test("builds a minute-by-minute causal pitch projection", () => {
  const { game, fixture } = context("pitch-timeline");
  const result = simulateVNextFixture(game, fixture);
  const plan = projectVNextMatchPlan(game, fixture, result, compareShadowMatch([1, 1], [9, 9], 50, result));
  assert.equal(plan.phases.length, 90);
  assert.equal(plan.phases[0].start, 0);
  assert.equal(plan.phases.at(-1).end, 90);
  assert.ok(plan.phases.every((phase) => phase.ball.x >= 1.5 && phase.ball.x <= 98.5));
  assert.ok(plan.phases.every((phase) => phase.ball.y >= 3 && phase.ball.y <= 97));
  assert.ok(plan.phases.some((phase) => phase.carrierId));
});

test("does not promote a drawn candidate when a single-leg knockout requires a winner", () => {
  const { game, fixture } = context("knockout-gate");
  const knockout = {
    ...fixture,
    competitionId: "test-cup",
    stage: "Final",
    tieId: undefined,
  };
  const cupGame = {
    ...game,
    competitions: [...game.competitions, {
      id: "test-cup",
      name: "Copa Teste",
      short: "CT",
      type: "cup",
      country: "Brasil",
      season: game.season,
      participantIds: [fixture.homeId, fixture.awayId],
      currentStage: "Final",
      pendingByes: [],
      nextRoundDate: fixture.date,
      complete: false,
    }],
  };
  const result = simulateVNextFixture(game, fixture);
  const drawn = {
    ...result,
    finalState: { ...result.finalState, score: [1, 1] },
    events: result.events.map((event, index) => index === result.events.length - 1
      ? { ...event, scoreAfter: [1, 1] }
      : event),
    statistics: {
      home: { ...result.statistics.home, goals: 1 },
      away: { ...result.statistics.away, goals: 1 },
    },
  };
  assert.equal(candidateCanDriveMatch(cupGame, knockout, drawn), false);
});

test("promotes the candidate as the official user match and persists the same score", () => {
  const { game, fixture } = context("official-candidate");
  const plan = buildMatchPlan(game, fixture);
  assert.equal(plan.engineSource, "vnext");
  assert.equal(plan.shadow?.status, "ready");
  const finished = finishRound(game, plan);
  const played = finished.fixtures.find((candidate) => candidate.id === fixture.id);
  assert.equal(played?.played, true);
  assert.deepEqual([played?.homeGoals, played?.awayGoals], [plan.homeGoals, plan.awayGoals]);
  assert.equal(plan.events.filter((event) => event.type === "goal").length, plan.homeGoals + plan.awayGoals);
});
