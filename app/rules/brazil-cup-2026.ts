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

export function selectBrazilCupEntrants(clubs:readonly RankedBrazilianClub[],protectedIds:readonly string[]=[]){
  const serieA=clubs.filter((club)=>club.divisionId==="BRA-A").sort((a,b)=>b.reputation-a.reputation).slice(0,BRAZIL_CUP_2026_FORMAT.fifthPhaseSerieA).map((club)=>club.id);
  const serieAIds=new Set(serieA),validProtected=protectedIds.filter((id,index)=>!serieAIds.has(id)&&protectedIds.indexOf(id)===index).slice(0,BRAZIL_CUP_2026_FORMAT.thirdPhaseProtected);
  const protectedSet=new Set(validProtected),rankedOthers=clubs.filter((club)=>!serieAIds.has(club.id)&&!protectedSet.has(club.id)).sort((a,b)=>b.reputation-a.reputation||a.id.localeCompare(b.id));
  const fallbackProtected=rankedOthers.splice(0,BRAZIL_CUP_2026_FORMAT.thirdPhaseProtected-validProtected.length).map((club)=>club.id),thirdPhase=[...validProtected,...fallbackProtected];
  const stateQualified=rankedOthers.slice(0,BRAZIL_CUP_2026_FORMAT.stateQualified),secondPhase=stateQualified.slice(0,BRAZIL_CUP_2026_FORMAT.secondPhaseEntrants).map((club)=>club.id),firstPhase=stateQualified.slice(-BRAZIL_CUP_2026_FORMAT.firstPhaseClubs).map((club)=>club.id);
  return{firstPhase,secondPhase,thirdPhase,fifthPhase:serieA,all:[...firstPhase,...secondPhase,...thirdPhase,...serieA]};
}
