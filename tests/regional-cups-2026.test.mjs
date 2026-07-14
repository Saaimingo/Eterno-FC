import assert from "node:assert/strict";
import test from "node:test";

import { REGIONAL_CUP_FORMATS_2026 } from "../app/rules/regional-cups-2026.ts";

test("defines the official 2026 regional group sizes and qualification",()=>{
  assert.deepEqual(REGIONAL_CUP_FORMATS_2026["REGIONAL-NE"],{groupCount:4,clubsPerGroup:5,groupSchedule:"cross",advancingPerGroup:2,quarterFinalSingleLeg:true});
  assert.deepEqual(REGIONAL_CUP_FORMATS_2026["REGIONAL-NCO"],{groupCount:4,clubsPerGroup:6,groupSchedule:"within",advancingPerGroup:2,quarterFinalSingleLeg:true});
  assert.deepEqual(REGIONAL_CUP_FORMATS_2026["REGIONAL-SSE"],{groupCount:2,clubsPerGroup:6,groupSchedule:"cross",advancingPerGroup:2,quarterFinalSingleLeg:false});
});

test("keeps every regional participant count compatible with its groups",()=>{
  const participantCounts={"REGIONAL-NE":20,"REGIONAL-NCO":24,"REGIONAL-SSE":12};
  for(const [competitionId,format] of Object.entries(REGIONAL_CUP_FORMATS_2026))assert.equal(format.groupCount*format.clubsPerGroup,participantCounts[competitionId]);
});
