import assert from "node:assert/strict";
import test from "node:test";

import { BRAZIL_SUPER_CUP_2026, resolveSuperCupParticipants } from "../app/rules/super-cup.ts";

test("qualifies the league and cup champions for the national super cup",()=>{
  assert.deepEqual(resolveSuperCupParticipants({leagueChampionId:"league",leagueRunnerUpId:"runner-up",cupChampionId:"cup"}),["league","cup"]);
  assert.equal(BRAZIL_SUPER_CUP_2026.matchDate,"02-01");
});

test("uses the league runner-up when one club wins the domestic double",()=>{
  assert.deepEqual(resolveSuperCupParticipants({leagueChampionId:"double",leagueRunnerUpId:"runner-up",cupChampionId:"double"}),["double","runner-up"]);
});

test("rejects a super cup without two distinct qualified clubs",()=>{
  assert.throws(()=>resolveSuperCupParticipants({leagueChampionId:"same",leagueRunnerUpId:"same",cupChampionId:"same"}),/dois classificados distintos/);
});
