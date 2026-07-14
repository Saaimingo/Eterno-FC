import assert from "node:assert/strict";
import test from "node:test";

import { serieCFormatForSeason, splitSerieCAccessGroups } from "../app/rules/serie-c.ts";

test("versions Serie C participant and relegation changes through 2028",()=>{
  assert.deepEqual(serieCFormatForSeason(2026),{participantCount:20,firstStageGroupCount:1,firstStageDoubleRound:false,qualifiedForAccessStage:8,promoted:4,relegated:2});
  assert.equal(serieCFormatForSeason(2027).participantCount,24);
  assert.deepEqual(serieCFormatForSeason(2028),{participantCount:28,firstStageGroupCount:2,firstStageDoubleRound:true,qualifiedForAccessStage:8,promoted:4,relegated:6});
});

test("splits the top eight into balanced access groups",()=>{
  const ranked=["1","2","3","4","5","6","7","8"];
  assert.deepEqual(splitSerieCAccessGroups(ranked),{"Grupo de acesso A":["1","4","5","8"],"Grupo de acesso B":["2","3","6","7"]});
  assert.throws(()=>splitSerieCAccessGroups(ranked.slice(0,7)),/oito classificados/);
});
