export const BRAZIL_CUP_2026_FORMAT = {
  totalParticipants:126,
  stateQualified:102,
  firstPhaseClubs:28,
  secondPhaseEntrants:74,
  thirdPhaseProtected:4,
  fifthPhaseSerieA:20,
  twoLeggedStages:["5ª fase","Oitavas","Quartas","Semifinal"] as const,
  singleMatchFinal:true,
} as const;

type RankedBrazilianClub={id:string;divisionId:string;reputation:number};
export type StateQualificationRoute={stateCode:string;slots:number;rankedClubIds:readonly string[]};

export function selectBrazilCupEntrants(clubs:readonly RankedBrazilianClub[],protectedIds:readonly string[]=[],stateRoutes:readonly StateQualificationRoute[]=[]){
  const serieA=clubs.filter((club)=>club.divisionId==="BRA-A").sort((a,b)=>b.reputation-a.reputation).slice(0,BRAZIL_CUP_2026_FORMAT.fifthPhaseSerieA).map((club)=>club.id);
  const serieAIds=new Set(serieA),validProtected=protectedIds.filter((id,index)=>!serieAIds.has(id)&&protectedIds.indexOf(id)===index).slice(0,BRAZIL_CUP_2026_FORMAT.thirdPhaseProtected);
  const protectedSet=new Set(validProtected),rankedOthers=clubs.filter((club)=>!serieAIds.has(club.id)&&!protectedSet.has(club.id)).sort((a,b)=>b.reputation-a.reputation||a.id.localeCompare(b.id));
  const fallbackProtected=rankedOthers.splice(0,BRAZIL_CUP_2026_FORMAT.thirdPhaseProtected-validProtected.length).map((club)=>club.id),thirdPhase=[...validProtected,...fallbackProtected];
  const eligibleById=new Map(rankedOthers.map((club)=>[club.id,club])),selectedIds=new Set<string>(),routed:string[]=[];
  stateRoutes.forEach((route)=>{let filled=0;for(const clubId of route.rankedClubIds){if(filled>=route.slots)break;if(!eligibleById.has(clubId)||selectedIds.has(clubId))continue;selectedIds.add(clubId);routed.push(clubId);filled+=1;}});
  for(const club of rankedOthers){if(routed.length>=BRAZIL_CUP_2026_FORMAT.stateQualified)break;if(selectedIds.has(club.id))continue;selectedIds.add(club.id);routed.push(club.id);}
  const stateQualified=routed.slice(0,BRAZIL_CUP_2026_FORMAT.stateQualified).map((id)=>eligibleById.get(id)!).sort((a,b)=>b.reputation-a.reputation||a.id.localeCompare(b.id)),secondPhase=stateQualified.slice(0,BRAZIL_CUP_2026_FORMAT.secondPhaseEntrants).map((club)=>club.id),firstPhase=stateQualified.slice(-BRAZIL_CUP_2026_FORMAT.firstPhaseClubs).map((club)=>club.id);
  return{firstPhase,secondPhase,thirdPhase,fifthPhase:serieA,all:[...firstPhase,...secondPhase,...thirdPhase,...serieA]};
}
