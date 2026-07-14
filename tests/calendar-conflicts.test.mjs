import assert from "node:assert/strict";
import test from "node:test";

import { findClubDateConflicts, resolveClubDateConflicts } from "../app/rules/calendar-conflicts.ts";

const fixture=(id,homeId,awayId,date="2026-03-01",played=false)=>({id,homeId,awayId,date,played});

test("moves a future fixture when one club is already booked",()=>{
  const scheduled=resolveClubDateConflicts([fixture("league","a","b"),fixture("cup","a","c")]);
  assert.deepEqual([...new Set(scheduled.map((item)=>item.date))].sort(),["2026-03-01","2026-03-02"]);
  assert.deepEqual(findClubDateConflicts(scheduled),[]);
});

test("never moves a fixture that was already played",()=>{
  const scheduled=resolveClubDateConflicts([fixture("future","a","c"),fixture("played","a","b","2026-03-01",true)]);
  assert.equal(scheduled.find((item)=>item.id==="played").date,"2026-03-01");
  assert.equal(scheduled.find((item)=>item.id==="future").date,"2026-03-02");
});

test("produces the same dates for the same fixture set",()=>{
  const input=[fixture("z","a","b"),fixture("a","a","c"),fixture("m","b","c")];
  assert.deepEqual(resolveClubDateConflicts(input),resolveClubDateConflicts(input));
});
