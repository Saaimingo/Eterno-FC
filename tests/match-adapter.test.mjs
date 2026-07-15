import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLegacyMatchPlan,
  createNewGame,
  nextUserFixture,
} from "../app/game.ts";
import {
  compareShadowMatch,
  createVNextMatchInput,
  runShadowMatch,
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
