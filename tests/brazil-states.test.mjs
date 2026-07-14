import assert from "node:assert/strict";
import test from "node:test";

import { BRAZIL_STATE_CUP_SLOTS } from "../app/rules/brazil-2026.ts";
import { CLUB_SEEDS, STATE_NAMES } from "../app/world-data.ts";

test("registers all 26 states and the Federal District",()=>{
  assert.equal(Object.keys(STATE_NAMES).length,27);
  for(const stateCode of Object.keys(STATE_NAMES))assert.ok(CLUB_SEEDS.filter((club)=>club.country==="Brasil"&&club.state===stateCode).length>=2,`${stateCode} precisa de ao menos dois clubes`);
});

test("distributes exactly 102 state routes into the national cup",()=>{
  assert.equal(Object.keys(BRAZIL_STATE_CUP_SLOTS).length,27);
  assert.equal(Object.values(BRAZIL_STATE_CUP_SLOTS).reduce((sum,slots)=>sum+slots,0),102);
});
