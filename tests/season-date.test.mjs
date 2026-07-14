import assert from "node:assert/strict";
import test from "node:test";

import { dateForSeason } from "../app/rules/season-2026.ts";

test("normalizes full and month-day calendar dates for a season", () => {
  assert.equal(dateForSeason(2027,"01-28"),"2027-01-28");
  assert.equal(dateForSeason(2027,"2026-03-11"),"2027-03-11");
  assert.throws(()=>dateForSeason(2027,"28/01"),/Data de calendário inválida/);
});
