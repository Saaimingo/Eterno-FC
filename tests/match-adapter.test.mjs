import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMatchPlan,
  buildLegacyMatchPlan,
  createNewGame,
  matchPlanPrefixIsStable,
  nextUserFixture,
} from "../app/game.ts";
import {
  compareShadowMatch,
  createLiveSubstitutionIntervention,
  createLiveTacticalIntervention,
  createVNextMatchInput,
  runShadowMatch,
  selectLiveVNextPlayers,
  simulateVNextFixture,
} from "../app/match-adapter.ts";
import { validateMatchInput } from "../app/match-engine/index.ts";

function matchContext(seed = "shadow-adapter") {
  const game = createNewGame("Técnico Teste", "florianopolis", seed);
  const fixture = nextUserFixture(game);
  assert.ok(fixture);
  return { game, fixture };
}

test("adapts a live career fixture into a valid MP-5 input", () => {
  const { game, fixture } = matchContext("valid-input");
  const input = createVNextMatchInput(game, fixture);
  assert.doesNotThrow(() => validateMatchInput(input));
  assert.equal(input.home.players.length, 11);
  assert.equal(input.away.players.length, 11);
  assert.equal(input.home.players.filter((player) => player.position === "GK").length, 1);
  assert.equal(input.away.players.filter((player) => player.position === "GK").length, 1);
  assert.ok(input.home.players.every((player) => player.attributes.passing >= 1 && player.attributes.passing <= 100));
  assert.ok(input.home.players.some((player) => player.attributes.crossing !== player.attributes.finishing));
});

test("keeps the legacy plan unchanged while the candidate runs in shadow", () => {
  const { game, fixture } = matchContext("legacy-canonical");
  const legacy = buildLegacyMatchPlan(game, fixture);
  const observed = runShadowMatch(
    game,
    fixture,
    [legacy.homeGoals, legacy.awayGoals],
    [legacy.homeShots, legacy.awayShots],
    legacy.homePossession,
  );
  assert.equal(observed.status, "ready");
  assert.deepEqual(observed.legacyScore, [legacy.homeGoals, legacy.awayGoals]);
  assert.equal(legacy.engineSource, "legacy");
});

test("produces an exact deterministic candidate and comparison fingerprint", () => {
  const { game, fixture } = matchContext("exact-shadow");
  const first = simulateVNextFixture(game, fixture);
  const second = simulateVNextFixture(game, fixture);
  assert.deepEqual(second, first);
  const left = compareShadowMatch([1, 0], [9, 7], 53, first);
  const right = compareShadowMatch([1, 0], [9, 7], 53, second);
  assert.equal(left.candidateFingerprint, right.candidateFingerprint);
  assert.equal(left.candidateEventCount, first.events.length);
});

test("contains candidate failures without blocking the official legacy match", () => {
  const { game, fixture } = matchContext("fallback");
  const broken = {
    ...game,
    players: game.players.filter((player) => !(player.clubId === fixture.awayId && player.position === "GOL")),
  };
  const shadow = runShadowMatch(broken, fixture, [2, 1], [12, 8], 54);
  assert.equal(shadow.status, "failed");
  assert.deepEqual(shadow.legacyScore, [2, 1]);
  assert.match(shadow.failureReason ?? "", /goleiro/);
});

test("recalculates only the unrevealed future after live coaching decisions", () => {
  const { game, fixture } = matchContext("live-coaching");
  const baseline = buildMatchPlan(game, fixture);
  assert.equal(baseline.engineSource, "vnext");

  const tactical = createLiveTacticalIntervention(game, fixture, [], 30, "flanks");
  const afterTactic = buildMatchPlan(game, fixture, [tactical]);
  assert.equal(afterTactic.engineSource, "vnext");
  assert.equal(matchPlanPrefixIsStable(baseline, afterTactic, 30), true);
  assert.ok(afterTactic.events.some((event) => event.detail === "tactical_change"
    && event.minute > 30 && event.text.includes("explorar os lados")));

  const selection = selectLiveVNextPlayers(game, fixture, [tactical]);
  const playerOutId = selection.activePlayerIds.find((id) => game.players.find((player) => player.id === id)?.position !== "GOL");
  const playerInId = selection.benchPlayerIds[0];
  assert.ok(playerOutId);
  assert.ok(playerInId);
  const substitution = createLiveSubstitutionIntervention(game, fixture, [tactical], 60, playerOutId, playerInId);
  const afterSubstitution = buildMatchPlan(game, fixture, [tactical, substitution]);
  assert.equal(afterSubstitution.engineSource, "vnext");
  assert.equal(matchPlanPrefixIsStable(afterTactic, afterSubstitution, 60), true);
  assert.ok(afterSubstitution.events.some((event) => event.detail === "substitution"
    && event.outcome === "completed" && event.minute > 60
    && event.playerId === playerOutId && event.targetPlayerId === playerInId));

  const updatedSelection = selectLiveVNextPlayers(game, fixture, [tactical, substitution]);
  assert.equal(updatedSelection.activePlayerIds.includes(playerOutId), false);
  assert.equal(updatedSelection.activePlayerIds.includes(playerInId), true);
  assert.equal(updatedSelection.substitutionsUsed, 1);
});
