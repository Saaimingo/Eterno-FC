import assert from "node:assert/strict";
import test from "node:test";

import { buildTwoLeggedTies, resolveTwoLeggedTies } from "../app/rules/two-legged-ties.ts";

test("builds home-and-away legs and resolves the aggregate winner", () => {
  const fixtures=buildTwoLeggedTies({competitionId:"BRA-B",season:2026,stage:"Playoffs",round:39,firstLegDate:"2026-11-30",pairs:[["third","sixth"]]});
  assert.equal(fixtures.length,2);assert.equal(fixtures[0].homeId,"sixth");assert.equal(fixtures[1].homeId,"third");assert.equal(fixtures[1].date,"2026-12-07");
  fixtures[0]={...fixtures[0],played:true,homeGoals:1,awayGoals:0};fixtures[1]={...fixtures[1],played:true,homeGoals:2,awayGoals:0};
  assert.deepEqual(resolveTwoLeggedTies(fixtures,()=>"sixth"),{winners:["third"],losers:["sixth"]});
});

test("uses the supplied tiebreaker when aggregate scores are level", () => {
  const fixtures=buildTwoLeggedTies({competitionId:"BRA-D",season:2026,stage:"Quartas",round:15,firstLegDate:"2026-08-01",pairs:[["alpha","beta"]]}).map((fixture)=>({...fixture,played:true,homeGoals:1,awayGoals:1}));
  assert.deepEqual(resolveTwoLeggedTies(fixtures,()=>"beta"),{winners:["beta"],losers:["alpha"]});
});
