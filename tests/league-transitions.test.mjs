import assert from "node:assert/strict";
import test from "node:test";

import { divisionShortfall, resolveLeagueTransitions } from "../app/rules/league-transitions.ts";

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

test("calculates how many Serie D entrants are needed after transitions", () => {
  const divisions = new Map([
    ...rows("d", 90).map((row) => [row.clubId, "D"]),
    ...rows("c", 2).map((row) => [row.clubId, "D"]),
  ]);

  assert.equal(divisionShortfall("D", rows("old", 96).map((row) => row.clubId), divisions), 4);
});
