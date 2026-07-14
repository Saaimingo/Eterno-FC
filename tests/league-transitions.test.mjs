import assert from "node:assert/strict";
import test from "node:test";

import { divisionShortfall, resolveLeagueTransitions } from "../app/rules/league-transitions.ts";
import { BRAZIL_2026, brazilianTransitionRules } from "../app/rules/brazil-2026.ts";
import { BRAZILIAN_DIVISION_TARGETS, CLUB_SEEDS } from "../app/world-data.ts";

const rows = (prefix, count) => Array.from({ length: count }, (_, index) => ({ clubId: `${prefix}-${index + 1}` }));

test("moves the configured top and bottom clubs between divisions", () => {
  const tables = new Map([
    ["A", rows("a", 20)],
    ["B", rows("b", 20)],
    ["C", rows("c", 20)],
    ["D", rows("d", 96)],
  ]);
  const moves = resolveLeagueTransitions([
    { upper: "A", lower: "B", relegated: 4, promoted: 4 },
    { upper: "B", lower: "C", relegated: 4, promoted: 4 },
    { upper: "C", lower: "D", relegated: 2, promoted: 6 },
  ], tables);

  assert.equal(moves.get("a-17"), "B");
  assert.equal(moves.get("b-1"), "A");
  assert.equal(moves.get("b-17"), "C");
  assert.equal(moves.get("c-1"), "B");
  assert.equal(moves.get("c-19"), "D");
  assert.equal(moves.get("d-6"), "C");
  assert.equal(moves.has("a-16"), false);
});

test("stabilizes Serie C at 28 clubs after the 2026-2027 expansion", () => {
  assert.equal(brazilianTransitionRules(2026).at(-1).relegated,2);
  assert.equal(brazilianTransitionRules(2027).at(-1).relegated,2);
  assert.equal(brazilianTransitionRules(2028).at(-1).relegated,6);
  assert.equal(brazilianTransitionRules(2100).at(-1).promoted,6);
});

test("calculates how many Serie D entrants are needed after transitions", () => {
  const divisions = new Map([
    ...rows("d", 90).map((row) => [row.clubId, "D"]),
    ...rows("c", 2).map((row) => [row.clubId, "D"]),
  ]);

  assert.equal(divisionShortfall("D", rows("old", 96).map((row) => row.clubId), divisions), 4);
});

test("keeps the 2026 Brazilian pyramid at its configured participant sizes", () => {
  for (const [divisionId,target] of Object.entries(BRAZILIAN_DIVISION_TARGETS)) {
    assert.equal(CLUB_SEEDS.filter((club) => club.divisionId === divisionId).length, target);
  }
  assert.deepEqual(BRAZIL_2026.serieBPromotion, { directPlaces: 2, playoffPlaces: [3,4,5,6], totalPromoted: 4 });
  assert.deepEqual(BRAZIL_2026.serieDFormat, { groups: 16, clubsPerGroup: 6, advancingPerGroup: 4, promoted: 6, twoLeggedKnockouts: true });
});
