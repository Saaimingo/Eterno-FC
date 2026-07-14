export type RegionalCupFormat={groupCount:number;clubsPerGroup:number;groupSchedule:"within"|"cross";advancingPerGroup:number;quarterFinalSingleLeg:boolean;};

export const REGIONAL_CUP_FORMATS_2026:Record<string,RegionalCupFormat>={
  "REGIONAL-NE":{groupCount:4,clubsPerGroup:5,groupSchedule:"cross",advancingPerGroup:2,quarterFinalSingleLeg:true},
  "REGIONAL-NCO":{groupCount:4,clubsPerGroup:6,groupSchedule:"within",advancingPerGroup:2,quarterFinalSingleLeg:true},
  "REGIONAL-SSE":{groupCount:2,clubsPerGroup:6,groupSchedule:"cross",advancingPerGroup:2,quarterFinalSingleLeg:false},
};
