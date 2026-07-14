import type { Fixture } from "../domain/types";

type TiePair = readonly [string, string];

function plusDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildTwoLeggedTies(args: {
  competitionId: string;
  season: number;
  stage: string;
  round: number;
  firstLegDate: string;
  pairs: readonly TiePair[];
}): Fixture[] {
  return args.pairs.flatMap(([first,second],index)=>{
    const tieId=`${args.competitionId}-${args.season}-${args.round}-t${index+1}`;
    return [
      {id:`${tieId}-l1`,tieId,leg:1,competitionId:args.competitionId,stage:args.stage,round:args.round,date:args.firstLegDate,homeId:second,awayId:first,played:false,homeGoals:null,awayGoals:null},
      {id:`${tieId}-l2`,tieId,leg:2,competitionId:args.competitionId,stage:args.stage,round:args.round,date:plusDays(args.firstLegDate,7),homeId:first,awayId:second,played:false,homeGoals:null,awayGoals:null},
    ] satisfies Fixture[];
  });
}

export function resolveTwoLeggedTies(fixtures: readonly Fixture[], tieBreaker: (first:string,second:string)=>string) {
  const ties=new Map<string,Fixture[]>();
  fixtures.forEach((fixture)=>{if(!fixture.tieId)return;ties.set(fixture.tieId,[...(ties.get(fixture.tieId)??[]),fixture]);});
  const winners:string[]=[],losers:string[]=[];
  for(const legs of ties.values()){
    if(legs.length!==2||legs.some((fixture)=>!fixture.played))continue;
    const clubs=[legs[0].homeId,legs[0].awayId];
    const totals=new Map(clubs.map((clubId)=>[clubId,0]));
    legs.forEach((leg)=>{totals.set(leg.homeId,(totals.get(leg.homeId)??0)+(leg.homeGoals??0));totals.set(leg.awayId,(totals.get(leg.awayId)??0)+(leg.awayGoals??0));});
    const [first,second]=clubs,firstGoals=totals.get(first)??0,secondGoals=totals.get(second)??0;
    const winner=firstGoals===secondGoals?tieBreaker(first,second):firstGoals>secondGoals?first:second;
    winners.push(winner);losers.push(winner===first?second:first);
  }
  return{winners,losers};
}
