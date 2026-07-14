import assert from "node:assert/strict";
import test from "node:test";

import { BRAZIL_CUP_2026_FORMAT, selectBrazilCupEntrants } from "../app/rules/brazil-cup-2026.ts";
import { CLUB_SEEDS } from "../app/world-data.ts";

test("selects the 126 clubs and separates every 2026 entry wave", () => {
  const brazilian=CLUB_SEEDS.filter((club)=>club.country==="Brasil"),protectedIds=brazilian.filter((club)=>club.divisionId==="BRA-C").slice(0,4).map((club)=>club.id),selection=selectBrazilCupEntrants(brazilian,protectedIds);
  assert.equal(selection.all.length,BRAZIL_CUP_2026_FORMAT.totalParticipants);
  assert.equal(new Set(selection.all).size,BRAZIL_CUP_2026_FORMAT.totalParticipants);
  assert.equal(selection.firstPhase.length,28);assert.equal(selection.secondPhase.length,74);assert.equal(selection.thirdPhase.length,4);assert.equal(selection.fifthPhase.length,20);
  assert.equal(selection.fifthPhase.every((id)=>brazilian.find((club)=>club.id===id)?.divisionId==="BRA-A"),true);
});

test("prioritizes clubs qualified through their state championships",()=>{
  const brazilian=CLUB_SEEDS.filter((club)=>club.country==="Brasil"),eligible=brazilian.filter((club)=>club.divisionId!=="BRA-A").slice(-3),selection=selectBrazilCupEntrants(brazilian,[],[{stateCode:"ZZ",slots:2,rankedClubIds:eligible.map((club)=>club.id)}]);
  assert.equal(selection.all.includes(eligible[0].id),true);
  assert.equal(selection.all.includes(eligible[1].id),true);
  assert.equal(new Set(selection.all).size,126);
});
