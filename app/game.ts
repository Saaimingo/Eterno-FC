import { CLUB_SEEDS, LEAGUE_SEEDS, STATE_NAMES } from "./world-data";
import { clamp, seededRandom } from "./domain/random";
import { dateForSeason, SEASON_2026 } from "./rules/season-2026";
import { BRAZIL_2026, brazilianDivisionSchedule, brazilianTransitionRules, regionalEligibleClubs } from "./rules/brazil-2026";
import { divisionShortfall, resolveLeagueTransitions, type LeagueTransitionRule } from "./rules/league-transitions";
import { buildTwoLeggedTies, resolveTwoLeggedTies } from "./rules/two-legged-ties";
import { BRAZIL_CUP_2026_FORMAT, selectBrazilCupEntrants } from "./rules/brazil-cup-2026";
import { REGIONAL_CUP_FORMATS_2026 } from "./rules/regional-cups-2026";
import type { BoardObjective, Club, Competition, CompetitionType, Fixture, GameState, Intensity, JobVacancy, ManagerContract, ManagerOffer, MarketOffer, MatchEvent, MatchPhase, MatchPlan, Mentality, NewsItem, Player, PlayerAttributes, Position, Standing, TransferEvent } from "./domain/types";

export type { BoardObjective, Club, Competition, CompetitionType, Fixture, GameState, IncomingBid, Intensity, JobVacancy, League, ManagerContract, ManagerOffer, MarketOffer, MatchEvent, MatchPhase, MatchPlan, Mentality, NewsItem, Player, PlayerAttributes, Position, Standing, TransferEvent } from "./domain/types";
export { seededRandom } from "./domain/random";

const FIRST_NAMES = ["Gabriel","Lucas","Matheus","João","Pedro","Rafael","Bruno","Caio","Vinícius","André","Diego","Samuel","Thiago","Henrique","Gustavo","Davi","Murilo","Igor","Felipe","Wesley","Eduardo","Arthur","Nicolas","Leonardo","Danilo","Marcos","Alex","Renato","Vitor","Rodrigo"];
const LAST_NAMES = ["Menezes","Silva","Santos","Oliveira","Souza","Costa","Pereira","Almeida","Rocha","Lima","Barbosa","Ribeiro","Carvalho","Moura","Teixeira","Nascimento","Moreira","Fernandes","Castro","Freitas","Cardoso","Martins","Correia","Vieira","Azevedo","Machado","Rezende","Farias","Tavares","Monteiro"];
const POSITION_MAP: Position[] = ["GOL","GOL","LD","LE","ZAG","ZAG","ZAG","ZAG","VOL","VOL","MC","MC","MC","MEI","PE","PD","ATA","ATA","ATA","LD","LE","MEI"];
const TEMPERAMENTS: Player["temperament"][] = ["Fair play","Cordeirinho","Cavalheiro","Caneleiro","Caceteiro","Sarrafeiro"];

function createAttributes(position: Position, rating: number, random: () => number): PlayerAttributes {
  const attribute=(bias=0)=>clamp(Math.round(rating+bias-10+random()*20),30,99);
  const base={pace:attribute(),stamina:attribute(),strength:attribute(),passing:attribute(),vision:attribute(),dribbling:attribute(),finishing:attribute(),tackling:attribute(),positioning:attribute(),composure:attribute(),reflexes:attribute(-22),handling:attribute(-22)};
  if(position==="GOL")return{...base,pace:attribute(-18),passing:attribute(-9),vision:attribute(-12),dribbling:attribute(-25),finishing:attribute(-30),tackling:attribute(-15),positioning:attribute(5),composure:attribute(2),reflexes:attribute(8),handling:attribute(8)};
  if(position==="ZAG")return{...base,pace:attribute(-3),strength:attribute(7),passing:attribute(-4),vision:attribute(-6),dribbling:attribute(-12),finishing:attribute(-14),tackling:attribute(8),positioning:attribute(7),composure:attribute(2)};
  if(position==="LD"||position==="LE")return{...base,pace:attribute(6),stamina:attribute(7),passing:attribute(1),dribbling:attribute(1),finishing:attribute(-8),tackling:attribute(4),positioning:attribute(3)};
  if(position==="VOL")return{...base,stamina:attribute(5),strength:attribute(3),passing:attribute(4),vision:attribute(2),dribbling:attribute(-3),finishing:attribute(-8),tackling:attribute(7),positioning:attribute(6),composure:attribute(4)};
  if(position==="MC")return{...base,stamina:attribute(5),passing:attribute(7),vision:attribute(7),dribbling:attribute(2),finishing:attribute(1),tackling:attribute(1),positioning:attribute(3),composure:attribute(5)};
  if(position==="MEI")return{...base,passing:attribute(8),vision:attribute(9),dribbling:attribute(7),finishing:attribute(4),tackling:attribute(-12),composure:attribute(7)};
  if(position==="PE"||position==="PD")return{...base,pace:attribute(9),stamina:attribute(4),passing:attribute(2),vision:attribute(1),dribbling:attribute(9),finishing:attribute(4),tackling:attribute(-14),composure:attribute(2)};
  return{...base,pace:attribute(5),strength:attribute(4),passing:attribute(-4),vision:attribute(-2),dribbling:attribute(4),finishing:attribute(10),tackling:attribute(-20),positioning:attribute(6),composure:attribute(7)};
}

function roleRating(player: Player) {
  const a=player.attributes;
  if(player.position==="GOL")return(a.reflexes*.34+a.handling*.3+a.positioning*.2+a.composure*.1+a.passing*.06);
  if(player.position==="ZAG")return(a.tackling*.31+a.positioning*.25+a.strength*.2+a.composure*.14+a.pace*.1);
  if(player.position==="LD"||player.position==="LE")return(a.pace*.22+a.stamina*.2+a.tackling*.2+a.positioning*.16+a.passing*.12+a.dribbling*.1);
  if(player.position==="VOL")return(a.tackling*.24+a.positioning*.21+a.passing*.19+a.stamina*.15+a.strength*.11+a.composure*.1);
  if(player.position==="MC")return(a.passing*.24+a.vision*.21+a.stamina*.16+a.composure*.15+a.dribbling*.12+a.tackling*.12);
  if(player.position==="MEI")return(a.vision*.25+a.passing*.23+a.dribbling*.19+a.composure*.15+a.finishing*.12+a.positioning*.06);
  if(player.position==="PE"||player.position==="PD")return(a.pace*.25+a.dribbling*.24+a.finishing*.18+a.passing*.12+a.composure*.11+a.stamina*.1);
  return(a.finishing*.34+a.positioning*.22+a.composure*.19+a.pace*.12+a.strength*.08+a.dribbling*.05);
}

function datePlusDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}

export function transferWindow(game: Pick<GameState,"date">): { open: boolean; label: string } {
  const monthDay=game.date.slice(5);
  if(monthDay>="01-01"&&monthDay<="03-06")return{open:true,label:"janela de início de temporada"};
  if(monthDay>="07-10"&&monthDay<="09-05")return{open:true,label:"janela de meio de temporada"};
  return{open:false,label:"mercado fechado"};
}

function makeClubs(): Club[] {
  return CLUB_SEEDS.map((seed) => ({ ...seed, balance: Math.round((seed.reputation ** 2) * 14500), transferBudget: Math.round((seed.reputation - 48) ** 2 * 26000) }));
}

function mergeMissingWorldClubs(clubs: Club[]): Club[] {
  const existingIds=new Set(clubs.map((club)=>club.id));
  return [...clubs,...makeClubs().filter((club)=>!existingIds.has(club.id))];
}

function createBoardObjectives(club: Club, league: { level: number; promotionTo?: string }): BoardObjective[] {
  const accessTarget=league.promotionTo?`Conquistar o acesso`:`Terminar entre os 6 primeiros`;
  return [
    {id:league.promotionTo?"promotion":"position",label:accessTarget,weight:45,status:"em andamento"},
    {id:"position",label:league.level===1?"Terminar na metade superior":"Terminar entre os 8 primeiros",weight:25,status:"em andamento"},
    {id:"finances",label:"Manter o caixa positivo",weight:15,status:"em andamento"},
    {id:"academy",label:`Valorizar a categoria de base (${club.academy>=75?"alta exigência":"evolução"})`,weight:15,status:"em andamento"},
  ];
}

function createManagerContract(club: Club, season: number): ManagerContract {
  return {clubId:club.id,weeklySalary:Math.max(4_000,Math.round(club.reputation**2*2.8)),expiresSeason:season+1,releaseClause:Math.max(100_000,Math.round(club.reputation**2*7_500))};
}

function makeSquad(club: Club, clubIndex: number, season: number): Player[] {
  const random = seededRandom(`${club.id}-${season}-squad`);
  return POSITION_MAP.map((position, index) => {
    const age = 18 + Math.floor(random() * 17);
    const rating = clamp(Math.round(club.reputation - 15 + random() * 19 - Math.max(0, age - 31) * .7), 42, 94);
    const potential = clamp(Math.round(rating + (age < 24 ? 4 + random() * 12 : random() * 4)), rating, 96);
    return {
      id:`${club.id}-p-${index + 1}`, clubId:club.id,
      name:`${FIRST_NAMES[(index * 3 + clubIndex * 7) % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7 + clubIndex * 4) % LAST_NAMES.length]}`,
      position, age, rating, potential, attributes:createAttributes(position,rating,random), fitness:88 + Math.round(random() * 12), morale:68 + Math.round(random() * 28),
      value:Math.max(80_000, Math.round((rating - 38) ** 2 * 12500 * (potential / Math.max(1,rating)))), wage:Math.max(900,Math.round((rating - 35) ** 2 * 13)),
      contract:1 + Math.floor(random() * 4), goals:0, assists:0, appearances:0,
      starting:index === 0 || [2,3,4,5,8,10,13,14,15,16].includes(index), academy:false,
      nationality:club.country === "Brasil" ? "Brasil" : club.country, temperament:TEMPERAMENTS[Math.floor(random()*TEMPERAMENTS.length)], listed:random() > .86,
    };
  });
}

function makeAcademy(club: Club, season: number, count = 6): Player[] {
  const random = seededRandom(`${club.id}-${season}-academy-${count}`);
  const positions: Position[] = ["GOL","ZAG","VOL","MEI","PD","ATA"];
  return Array.from({ length:count }, (_,index) => {
    const rating = 42 + Math.round(random() * 16); const potential = clamp(rating + 17 + Math.round(random() * 20),64,95);
    const position=positions[index%positions.length]; return { id:`${club.id}-y-${season}-${index+1}`,clubId:club.id,name:`${FIRST_NAMES[(index*5+season)%FIRST_NAMES.length]} ${LAST_NAMES[(index*9+season)%LAST_NAMES.length]}`,position,age:15+Math.floor(random()*3),rating,potential,attributes:createAttributes(position,rating,random),fitness:100,morale:82,value:Math.round((rating-30)**2*9000),wage:1000+Math.round(random()*1800),contract:3,goals:0,assists:0,appearances:0,starting:false,academy:true,nationality:club.country,temperament:TEMPERAMENTS[Math.floor(random()*TEMPERAMENTS.length)],listed:false };
  });
}

function makeRoundRobin(competition: Competition, startDate: string, intervalDays: number, doubleRound = true): Fixture[] {
  const ids: Array<string | null> = [...competition.participantIds];
  if (ids.length % 2) ids.push(null);
  const rotation = [...ids]; const firstLeg: Fixture[] = [];
  for (let roundIndex=0; roundIndex<rotation.length-1; roundIndex+=1) {
    let pairIndex=0;
    for (let pair=0; pair<rotation.length/2; pair+=1) {
      const a=rotation[pair], b=rotation[rotation.length-1-pair]; if(!a||!b) continue;
      const swap=(roundIndex+pair)%2===1;
      firstLeg.push({id:`${competition.id}-${competition.season}-r${roundIndex+1}-${pairIndex+1}`,competitionId:competition.id,stage:"Liga",round:roundIndex+1,date:datePlusDays(startDate,roundIndex*intervalDays),homeId:swap?b:a,awayId:swap?a:b,played:false,homeGoals:null,awayGoals:null});
      pairIndex+=1;
    }
    rotation.splice(1,0,rotation.pop() as string|null);
  }
  if(!doubleRound) return firstLeg;
  const legRounds=rotation.length-1;
  return [...firstLeg,...firstLeg.map((fixture)=>({...fixture,id:`${fixture.id}-returno`,round:fixture.round+legRounds,date:datePlusDays(fixture.date,legRounds*intervalDays),homeId:fixture.awayId,awayId:fixture.homeId}))];
}

function makeGroupedRoundRobin(competition:Competition,startDate:string,intervalDays:number,groupCount:number):Fixture[]{
  const ordered=[...competition.participantIds].sort();const groupSize=Math.ceil(ordered.length/groupCount);competition.currentStage="Fase de grupos";
  return Array.from({length:groupCount},(_,index)=>ordered.slice(index*groupSize,(index+1)*groupSize)).filter((group)=>group.length>=2).flatMap((group,index)=>{
    const groupLabel=`Grupo ${String(index+1).padStart(2,"0")}`,groupCompetition={...competition,id:`${competition.id}-G${index+1}`,participantIds:group};
    return makeRoundRobin(groupCompetition,startDate,intervalDays,true).map((fixture)=>({...fixture,competitionId:competition.id,stage:groupLabel}));
  });
}

function createCompetitionGroups(competition:Competition,groupCount:number){const random=seededRandom(`${competition.id}-${competition.season}-groups`),shuffled=[...competition.participantIds].sort(()=>random()-.5),groups=Object.fromEntries(Array.from({length:groupCount},(_,index)=>[`Grupo ${String(index+1).padStart(2,"0")}`,[] as string[]]));shuffled.forEach((clubId,index)=>groups[`Grupo ${String(index%groupCount+1).padStart(2,"0")}`].push(clubId));return groups;}

function makeRegionalGroupFixtures(competition:Competition,startDate:string):Fixture[]{const format=REGIONAL_CUP_FORMATS_2026[competition.id],groups=competition.groups??createCompetitionGroups(competition,format.groupCount),entries=Object.entries(groups);competition.groups=groups;competition.currentStage="Fase de grupos";if(format.groupSchedule==="within")return entries.flatMap(([,ids],index)=>makeRoundRobin({...competition,id:`${competition.id}-G${index+1}`,participantIds:ids},startDate,7,false).map((fixture)=>({...fixture,competitionId:competition.id,stage:"Fase de grupos",id:`${competition.id}-${competition.season}-g${index+1}-${fixture.round}-${fixture.homeId}-${fixture.awayId}`})));const pairs=Array.from({length:entries.length/2},(_,index)=>[entries[index*2],entries[index*2+1]] as const);return pairs.flatMap(([[,first],[,second]],pairIndex)=>Array.from({length:first.length},(_,round)=>first.map((clubId,index)=>{const opponent=second[(index+round)%second.length],swap=(round+index)%2===1;return{id:`${competition.id}-${competition.season}-x${pairIndex+1}-r${round+1}-${index+1}`,competitionId:competition.id,stage:"Fase de grupos",round:round+1,date:datePlusDays(startDate,round*7),homeId:swap?opponent:clubId,awayId:swap?clubId:opponent,played:false,homeGoals:null,awayGoals:null};})).flat());}

function stageName(teamCount: number, preliminary = false) {
  if(preliminary) return "Fase preliminar";
  if(teamCount>32)return`Fase de ${teamCount}`;if(teamCount===32)return"16-avos";if(teamCount===16)return"Oitavas";if(teamCount===8)return"Quartas";if(teamCount===4)return"Semifinal";return"Final";
}

function cupOpening(competition: Competition, clubs: Club[], date: string): Fixture[] {
  const sorted=[...competition.participantIds].sort((a,b)=>(clubs.find((club)=>club.id===b)?.reputation??0)-(clubs.find((club)=>club.id===a)?.reputation??0));
  const power=2**Math.floor(Math.log2(sorted.length)); const byes=Math.max(0,2*power-sorted.length); competition.pendingByes=sorted.slice(0,byes);
  const playing=sorted.slice(byes); competition.currentStage=stageName(playing.length,byes>0); competition.nextRoundDate=datePlusDays(date,24);
  const random=seededRandom(`${competition.id}-${competition.season}-draw`); const shuffled=[...playing].sort(()=>random()-.5);
  return Array.from({length:shuffled.length/2},(_,index)=>({id:`${competition.id}-${competition.season}-s0-${index+1}`,competitionId:competition.id,stage:competition.currentStage,round:1,date,homeId:shuffled[index*2],awayId:shuffled[index*2+1],played:false,homeGoals:null,awayGoals:null}));
}

function singleLegRound(competition:Competition,teams:readonly string[],stage:string,date:string,round:number):Fixture[]{const random=seededRandom(`${competition.id}-${competition.season}-${stage}`),shuffled=[...teams].sort(()=>random()-.5);return Array.from({length:Math.floor(shuffled.length/2)},(_,index)=>({id:`${competition.id}-${competition.season}-${round}-t${index+1}`,competitionId:competition.id,stage,round,date,homeId:shuffled[index*2],awayId:shuffled[index*2+1],played:false,homeGoals:null,awayGoals:null}));}

function makeCompetition(id:string,name:string,short:string,type:CompetitionType,country:string,season:number,participantIds:string[],date:string): Competition {
  return {id,name,short,type,country,season,participantIds,currentStage:type==="league"||type==="state"?"Liga":"",pendingByes:[],promotedClubIds:[],nextRoundDate:date,complete:false};
}

type SeasonQualification = { brazilPrimary: string[]; brazilSecondary: string[]; argentinaPrimary: string[]; argentinaSecondary: string[]; spainPrimary: string[]; italyPrimary: string[]; brazilCupProtected: string[] };

function buildSeason(clubs: Club[], season: number, qualification?: SeasonQualification) {
  const competitions:Competition[]=[]; const fixtures:Fixture[]=[];
  LEAGUE_SEEDS.forEach((league)=>{
    const participants=clubs.filter((club)=>club.divisionId===league.id).map((club)=>club.id);
    const brazilianSchedule=league.country==="Brasil"?brazilianDivisionSchedule(league.id):undefined;
    const openingDate=dateForSeason(season,brazilianSchedule?.openingDate??SEASON_2026.league.openingDate);
    const competition={...makeCompetition(league.id,league.name,league.short,"league",league.country,season,participants,openingDate),divisionId:league.id};
    competitions.push(competition); fixtures.push(...(league.id==="BRA-D"?makeGroupedRoundRobin(competition,openingDate,7,BRAZIL_2026.serieDFormat.groups):makeRoundRobin(competition,openingDate,SEASON_2026.league.roundIntervalDays,SEASON_2026.league.doubleRound)));
  });
  Object.entries(STATE_NAMES).forEach(([stateCode,name],index)=>{
    const participants=clubs.filter((club)=>club.country==="Brasil"&&club.state===stateCode).map((club)=>club.id); if(participants.length<2)return;
    const openingDay=11+(index%3)*2;
    const openingDate=`${season}-${BRAZIL_2026.states.openingDate.slice(0,3)}${String(openingDay).padStart(2,"0")}`;
    const competition={...makeCompetition(`STATE-${stateCode}`,name,name.replace("Campeonato ",""),"state","Brasil",season,participants,openingDate),stateCode};
    competitions.push(competition); fixtures.push(...makeRoundRobin(competition,competition.nextRoundDate,BRAZIL_2026.states.roundIntervalDays,false));
  });
  const spain=clubs.filter((club)=>club.country==="Espanha").map((club)=>club.id);
  const italy=clubs.filter((club)=>club.country==="Itália").map((club)=>club.id);
  const ranked=(divisionId:string)=>clubs.filter((club)=>club.divisionId===divisionId).sort((a,b)=>b.reputation-a.reputation).map((club)=>club.id);
  const brazilPrimary=qualification?.brazilPrimary??ranked("BRA-A").slice(0,8),brazilSecondary=qualification?.brazilSecondary??ranked("BRA-A").slice(4,12);
  const argentinaPrimary=qualification?.argentinaPrimary??ranked("ARG-1").slice(0,8),argentinaSecondary=qualification?.argentinaSecondary??ranked("ARG-1").slice(4,12);
  const spainPrimary=qualification?.spainPrimary??ranked("ESP-1").slice(0,8),italyPrimary=qualification?.italyPrimary??ranked("ITA-1").slice(0,8);
  const brazilTop=brazilPrimary.map((id)=>clubs.find((club)=>club.id===id)).filter((club):club is Club=>Boolean(club));
  const continentalBrazilianClubIds=new Set(brazilTop.slice(0,8).map((club)=>club.id));
  const regionalCups= BRAZIL_2026.regionals
    .map((rule)=>{
      const participants=regionalEligibleClubs(clubs,rule.stateCodes,continentalBrazilianClubIds).slice(0,rule.expectedParticipants).map((club)=>club.id);
      if(participants.length<2)return undefined;const competition={...makeCompetition(rule.id,rule.name,rule.short,"cup","Brasil",season,participants,dateForSeason(season,rule.openingDate)),formatId:"regional-cup-2026" as const};competition.groups=createCompetitionGroups(competition,REGIONAL_CUP_FORMATS_2026[rule.id].groupCount);competition.currentStage="Fase de grupos";return competition;
    })
    .filter((competition):competition is Competition=>Boolean(competition));
  const brazilCupSelection=selectBrazilCupEntrants(clubs.filter((club)=>club.country==="Brasil"),qualification?.brazilCupProtected),brazilCup={...makeCompetition(BRAZIL_2026.nationalCup.id,BRAZIL_2026.nationalCup.name,BRAZIL_2026.nationalCup.short,"cup","Brasil",season,brazilCupSelection.all,dateForSeason(season,BRAZIL_2026.nationalCup.openingDate)),formatId:"brazil-cup-2026" as const,currentStage:"1ª fase",entryWaves:{"2ª fase":brazilCupSelection.secondPhase,"3ª fase":brazilCupSelection.thirdPhase,"5ª fase":brazilCupSelection.fifthPhase}};
  const cup = SEASON_2026.cups;
  const cups:Competition[]=[
    ...regionalCups,
    brazilCup,
    makeCompetition(cup.spain.id,cup.spain.name,cup.spain.short,"cup","Espanha",season,spain,dateForSeason(season,cup.spain.openingDate)),
    makeCompetition(cup.italy.id,cup.italy.name,cup.italy.short,"cup","Itália",season,italy,dateForSeason(season,cup.italy.openingDate)),
    makeCompetition(cup.libertadores.id,cup.libertadores.name,cup.libertadores.short,"continental","América do Sul",season,[...brazilPrimary,...argentinaPrimary],dateForSeason(season,cup.libertadores.openingDate)),
    makeCompetition(cup.sudamericana.id,cup.sudamericana.name,cup.sudamericana.short,"continental","América do Sul",season,[...brazilSecondary,...argentinaSecondary],dateForSeason(season,cup.sudamericana.openingDate)),
    makeCompetition(cup.champions.id,cup.champions.name,cup.champions.short,"continental","Europa",season,[...spainPrimary,...italyPrimary],dateForSeason(season,cup.champions.openingDate)),
  ];
  cups.forEach((cup)=>{ competitions.push(cup); fixtures.push(...(cup.formatId==="brazil-cup-2026"?singleLegRound(cup,brazilCupSelection.firstPhase,"1ª fase",cup.nextRoundDate,1):cup.formatId==="regional-cup-2026"?makeRegionalGroupFixtures(cup,cup.nextRoundDate):cupOpening(cup,clubs,cup.nextRoundDate))); });
  return {competitions,fixtures};
}

export function clubById(game: GameState, id: string) { return game.clubs.find((club)=>club.id===id)!; }
export function userClub(game: GameState) { return clubById(game,game.userClubId); }
export function leagueById(game: GameState,id:string) { return game.leagues.find((league)=>league.id===id)!; }
export function userLeague(game:GameState) { return leagueById(game,userClub(game).divisionId); }
export function competitionById(game:GameState,id:string) { return game.competitions.find((competition)=>competition.id===id)!; }
export function squadFor(game:GameState,clubId:string,includeAcademy=false) { return game.players.filter((player)=>player.clubId===clubId&&(includeAcademy||!player.academy)); }

export function calculateStandings(clubs:Club[],fixtures:Fixture[]):Standing[] {
  const map=new Map<string,Standing>(); clubs.forEach((club)=>map.set(club.id,{clubId:club.id,played:0,wins:0,draws:0,losses:0,gf:0,ga:0,gd:0,points:0}));
  fixtures.filter((fixture)=>fixture.played&&(map.has(fixture.homeId)||map.has(fixture.awayId))).forEach((fixture)=>{
    const home=map.get(fixture.homeId),away=map.get(fixture.awayId),hg=fixture.homeGoals??0,ag=fixture.awayGoals??0;
    if(home){home.played+=1;home.gf+=hg;home.ga+=ag;if(hg>ag){home.wins+=1;home.points+=3;}else if(ag>hg)home.losses+=1;else{home.draws+=1;home.points+=1;}}
    if(away){away.played+=1;away.gf+=ag;away.ga+=hg;if(ag>hg){away.wins+=1;away.points+=3;}else if(hg>ag)away.losses+=1;else{away.draws+=1;away.points+=1;}}
  });
  return [...map.values()].map((row)=>({...row,gd:row.gf-row.ga})).sort((a,b)=>b.points-a.points||b.wins-a.wins||b.gd-a.gd||b.gf-a.gf||a.clubId.localeCompare(b.clubId));
}

export function competitionTable(game:GameState,competitionId:string) {
  const competition=competitionById(game,competitionId); const clubs=competition.participantIds.map((id)=>clubById(game,id)).filter(Boolean);
  return calculateStandings(clubs,game.fixtures.filter((fixture)=>fixture.competitionId===competitionId));
}

function refreshUserStandings(game:GameState,fixtures=game.fixtures,clubs=game.clubs) {
  const divisionId=clubs.find((club)=>club.id===game.userClubId)?.divisionId??"BRA-D";
  return calculateStandings(clubs.filter((club)=>club.divisionId===divisionId),fixtures.filter((fixture)=>fixture.competitionId===divisionId));
}

export function createNewGame(managerName="Adilson Simon",userClubId?:string,careerName="Minha jornada"):GameState {
  const clubs=makeClubs();
  const chosen=clubs.find((club)=>club.id===userClubId)??randomStartingClub(clubs,managerName,careerName);
  const players=clubs.flatMap((club,index)=>makeSquad(club,index,2026)); players.push(...makeAcademy(chosen,2026)); const world=buildSeason(clubs,2026);
  const leagues=LEAGUE_SEEDS.map((league)=>({...league}),); const chosenLeague=leagues.find((league)=>league.id===chosen.divisionId)!;
  const game:GameState={version:2,id:`career-${chosen.id}-${Date.now()}`,careerName,managerName,userClubId:chosen.id,managerStatus:"employed",acceptingJobOffers:true,managerContract:createManagerContract(chosen,2026),managerReputation:48,managerPoints:0,managerRecord:[{clubId:chosen.id,fromSeason:2026,matches:0,wins:0,trophies:0}],season:2026,date:`2026-01-10`,round:1,clubs,leagues,competitions:world.competitions,players,fixtures:world.fixtures,standings:[],news:[],history:[],transferEvents:[],marketOffers:[],incomingBids:[],vacancies:[],jobOffers:[],formation:"4-3-3",mentality:"Equilibrada",intensity:"Normal",balance:chosen.balance,transferBudget:chosen.transferBudget,weeklyIncome:Math.round(chosen.reputation**2*165),weeklyExpenses:Math.round(chosen.reputation**2*128),boardConfidence:68,boardObjectives:createBoardObjectives(chosen,chosenLeague),academyLevel:Math.max(1,Math.round(chosen.academy/20)),reputation:chosen.reputation,lastFive:[],matchesManaged:0,lastSavedAt:new Date().toISOString()};
  game.standings=refreshUserStandings(game); game.date=nextUserFixture(game)?.date??game.date;
  game.news=[
    {id:"welcome-v2",date:game.date,category:"carreira",title:`${managerName} começa na ${userLeague(game).short}`,body:`O ${chosen.name} será seu primeiro degrau. Há quatro divisões no Brasil, acesso, descenso, estaduais, copa nacional e torneios continentais.`,unread:true},
    {id:"world-v2",date:game.date,category:"competição",title:"O mundo da bola está em movimento",body:"Brasil, Espanha, Itália e Argentina jogam simultaneamente. Resultados, demissões e transferências continuarão acontecendo fora do seu clube.",unread:true},
  ];
  game.marketOffers=generateMarketOffers(game,8); game.vacancies=generateVacancies(game,4);
  return game;
}

export function migrateGame(raw:unknown):GameState {
  const source=raw as Partial<GameState>&{version?:number};
  if(source?.version===2&&Array.isArray(source.clubs)&&Array.isArray(source.competitions)) {
    const saved=source as GameState;
    const club=saved.clubs.find((item)=>item.id===saved.userClubId)!;const league=saved.leagues.find((item)=>item.id===club.divisionId)!;
    const managerContract=saved.managerContract??createManagerContract(club,saved.season);
    const prepared={...saved,acceptingJobOffers:saved.acceptingJobOffers??true,managerContract} as GameState;
    const jobOffers=(saved.jobOffers as Array<JobVacancy|ManagerOffer>).map((offer)=>"weeklySalary" in offer?offer:makeManagerOffer(prepared,offer));
    return {...prepared,jobOffers,boardObjectives:saved.boardObjectives??createBoardObjectives(club,league),players:saved.players.map((player)=>player.attributes?player:{...player,attributes:createAttributes(player.position,player.rating,seededRandom(`migrate-${player.id}`))})};
  }
  const old=raw as {id?:string;careerName?:string;managerName?:string;userClubId?:string;clubs?:Array<Partial<Club>>;players?:Player[];balance?:number;transferBudget?:number;formation?:GameState["formation"];mentality?:Mentality;intensity?:Intensity};
  const oldClub=old.clubs?.find((club)=>club.id===old.userClubId); const byName=CLUB_SEEDS.find((club)=>club.name.toLowerCase()===oldClub?.name?.toLowerCase());
  const migrated=createNewGame(old.managerName??"Saimon Menezes",byName?.id??(CLUB_SEEDS.some((club)=>club.id===old.userClubId)?old.userClubId:"florianopolis"),old.careerName??"Carreira migrada");
  const oldSquad=(old.players??[]).filter((player)=>player.clubId===old.userClubId&&!player.academy); const newSquad=squadFor(migrated,migrated.userClubId);
  migrated.players=migrated.players.map((player)=>{const index=newSquad.findIndex((item)=>item.id===player.id),previous=oldSquad[index];return previous?{...player,name:previous.name,rating:previous.rating,potential:Math.max(previous.potential,previous.rating),age:previous.age}:player;});
  migrated.id=old.id??migrated.id; migrated.balance=old.balance??migrated.balance; migrated.transferBudget=old.transferBudget??migrated.transferBudget; migrated.formation=old.formation??migrated.formation;migrated.mentality=old.mentality??migrated.mentality;migrated.intensity=old.intensity??migrated.intensity;
  migrated.news.unshift({id:"migration-v2",date:migrated.date,category:"carreira",title:"Carreira ampliada para o Mundo Vivo",body:"Seu treinador, clube e núcleo do elenco foram preservados. O calendário de 2026 foi reiniciado para incorporar divisões, copas, estaduais, acesso, descenso e mercado mundial.",unread:true});
  return migrated;
}

export function nextUserFixture(game:GameState) {
  if(game.managerStatus==="unemployed") return undefined;
  return game.fixtures.filter((fixture)=>!fixture.played&&(fixture.homeId===game.userClubId||fixture.awayId===game.userClubId)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0];
}

function squadStrength(game:GameState,clubId:string) {
  const club=clubById(game,clubId); const squad=squadFor(game,clubId).filter((player)=>!player.injuredMatches).sort((a,b)=>Number(b.starting)-Number(a.starting)||b.rating-a.rating).slice(0,11);
  const score=squad.reduce((sum,player)=>sum+roleRating(player)*(.7+player.fitness/330)*(.85+player.morale/650),0)/Math.max(1,squad.length); return score*.76+club.reputation*.24;
}

function poisson(lambda:number,random:()=>number) { const threshold=Math.exp(-lambda);let product=1,count=0;do{count+=1;product*=random();}while(product>threshold&&count<9);return count-1; }
function tacticModifier(game:GameState){return(game.mentality==="Ofensiva"?.22:game.mentality==="Defensiva"?-.14:0)+(game.intensity==="Alta"?.12:game.intensity==="Baixa"?-.08:0);}

function scoreFixture(game:GameState,fixture:Fixture,salt="") {
  const random=seededRandom(`${fixture.id}-${game.formation}-${game.mentality}-${game.intensity}-${salt}`);let homeStrength=squadStrength(game,fixture.homeId)+2.3,awayStrength=squadStrength(game,fixture.awayId);
  if(fixture.homeId===game.userClubId)homeStrength+=tacticModifier(game)*5;if(fixture.awayId===game.userClubId)awayStrength+=tacticModifier(game)*5;
  const diff=homeStrength-awayStrength;let homeGoals=poisson(clamp(1.3+diff/22+(fixture.homeId===game.userClubId?tacticModifier(game):0),.15,3.8),random);let awayGoals=poisson(clamp(1.02-diff/25+(fixture.awayId===game.userClubId?tacticModifier(game):0),.12,3.5),random);
  const competition=game.competitions.find((item)=>item.id===fixture.competitionId),singleLegKnockout=competition&&(competition.type==="cup"||competition.type==="continental")&&fixture.stage!=="Fase de grupos"&&!fixture.tieId;if(singleLegKnockout&&homeGoals===awayGoals){if(random()>.5)homeGoals+=1;else awayGoals+=1;}
  return{homeGoals,awayGoals,random,homeStrength,awayStrength};
}

function scorerFor(game:GameState,clubId:string,random:()=>number){
  const candidates=squadFor(game,clubId).filter((player)=>player.starting&&!player.injuredMatches);
  const total=candidates.reduce((sum,player)=>sum+Math.max(1,Math.round((player.attributes.finishing+player.attributes.positioning+player.attributes.composure)/9)*(player.position==="ATA"?1.45:["PE","PD","MEI"].includes(player.position)?1.15:1)),0);
  let roll=random()*total;
  for(const player of candidates){roll-=Math.max(1,Math.round((player.attributes.finishing+player.attributes.positioning+player.attributes.composure)/9)*(player.position==="ATA"?1.45:["PE","PD","MEI"].includes(player.position)?1.15:1));if(roll<=0)return player;}
  return candidates[0];
}

export function buildMatchPlan(game:GameState,fixture:Fixture):MatchPlan {
  const {homeGoals,awayGoals,random,homeStrength,awayStrength}=scoreFixture(game,fixture,"live");const events:MatchEvent[]=[{minute:1,type:"comment",teamId:fixture.homeId,text:"A bola está rolando."}];const used=new Set<number>();
  const addGoal=(teamId:string)=>{let minute=6+Math.floor(random()*81);while(used.has(minute))minute=Math.min(89,minute+1);used.add(minute);const scorer=scorerFor(game,teamId,random);events.push({minute,type:"goal",teamId,playerId:scorer?.id,text:`GOL! ${scorer?.name??"O atacante"} conclui a jogada.`});};
  for(let index=0;index<homeGoals;index+=1)addGoal(fixture.homeId);for(let index=0;index<awayGoals;index+=1)addGoal(fixture.awayId);
  for(let index=0;index<8+Math.floor(random()*5);index+=1){const minute=4+Math.floor(random()*84);if(used.has(minute))continue;const teamId=random()>.5?fixture.homeId:fixture.awayId;const card=random()>.78;events.push({minute,type:card?"card":"chance",teamId,text:card?"Entrada forte no meio. Cartão amarelo.":"A equipe chega ao último terço e finaliza com perigo."});}
  events.push({minute:45,type:"comment",teamId:fixture.homeId,text:"Fim do primeiro tempo."},{minute:90,type:"comment",teamId:fixture.awayId,text:"Apita o árbitro. Fim de jogo."});events.sort((a,b)=>a.minute-b.minute||(a.type==="goal"?1:-1));
  const phases:MatchPhase[]=[];let start=0,teamId=random()>.5?fixture.homeId:fixture.awayId;
  while(start<90){const length=3+Math.floor(random()*5),end=Math.min(90,start+length);if(random()>.36)teamId=teamId===fixture.homeId?fixture.awayId:fixture.homeId;const progress=random();phases.push({start,end,teamId,zone:progress>.66?"ataque":progress>.28?"meio":"saída",carrier:Math.floor(random()*10)});start=end;}
  events.filter((event)=>event.type==="goal"||event.type==="chance").forEach((event)=>{const phase=phases.find((item)=>event.minute>=item.start&&event.minute<=item.end);if(phase){phase.teamId=event.teamId;phase.zone="ataque";}});
  const homePossession=clamp(Math.round(50+(homeStrength-awayStrength)*1.25),34,66);
  return{fixtureId:fixture.id,homeGoals,awayGoals,events,phases,homePossession,homeShots:Math.max(homeGoals+2,7+Math.round((homeStrength-awayStrength)/5+random()*5)),awayShots:Math.max(awayGoals+2,6+Math.round((awayStrength-homeStrength)/5+random()*5))};
}

function playFixture(game:GameState,fixture:Fixture,salt:string):Fixture{const score=scoreFixture(game,fixture,salt);return{...fixture,played:true,homeGoals:score.homeGoals,awayGoals:score.awayGoals};}

function advanceCups(game:GameState,fixtures:Fixture[],competitions:Competition[]) {
  const nextFixtures=[...fixtures];const nextCompetitions=competitions.map((competition)=>({...competition,pendingByes:[...competition.pendingByes]}));
  nextCompetitions.filter((competition)=>(competition.type==="cup"||competition.type==="continental")&&!competition.complete&&!competition.formatId).forEach((competition)=>{
    const stageFixtures=nextFixtures.filter((fixture)=>fixture.competitionId===competition.id&&fixture.stage===competition.currentStage);if(!stageFixtures.length||stageFixtures.some((fixture)=>!fixture.played))return;
    const winners=stageFixtures.map((fixture)=>(fixture.homeGoals??0)>(fixture.awayGoals??0)?fixture.homeId:fixture.awayId);const nextTeams=[...competition.pendingByes,...winners];competition.pendingByes=[];
    if(nextTeams.length===1){competition.complete=true;competition.championId=nextTeams[0];competition.currentStage="Campeão";return;}
    competition.currentStage=stageName(nextTeams.length);const random=seededRandom(`${competition.id}-${competition.season}-${competition.currentStage}`);const shuffled=[...nextTeams].sort(()=>random()-.5);const round=stageFixtures[0].round+1;
    nextFixtures.push(...Array.from({length:shuffled.length/2},(_,index)=>({id:`${competition.id}-${competition.season}-s${round}-${index+1}`,competitionId:competition.id,stage:competition.currentStage,round,date:competition.nextRoundDate,homeId:shuffled[index*2],awayId:shuffled[index*2+1],played:false,homeGoals:null,awayGoals:null})));
    competition.nextRoundDate=datePlusDays(competition.nextRoundDate,24);
  });
  return{fixtures:nextFixtures,competitions:nextCompetitions};
}

function advanceBrazilCup(game:GameState,fixtures:Fixture[],competitions:Competition[]){
  const nextFixtures=[...fixtures],nextCompetitions=competitions.map((competition)=>({...competition,pendingByes:[...competition.pendingByes],entryWaves:competition.entryWaves?Object.fromEntries(Object.entries(competition.entryWaves).map(([stage,ids])=>[stage,[...ids]])):undefined})),competition=nextCompetitions.find((item)=>item.formatId==="brazil-cup-2026"&&!item.complete);if(!competition)return{fixtures:nextFixtures,competitions:nextCompetitions};
  const stageFixtures=nextFixtures.filter((fixture)=>fixture.competitionId===competition.id&&fixture.stage===competition.currentStage);if(!stageFixtures.length||stageFixtures.some((fixture)=>!fixture.played))return{fixtures:nextFixtures,competitions:nextCompetitions};
  const twoLegged=BRAZIL_CUP_2026_FORMAT.twoLeggedStages.includes(competition.currentStage as typeof BRAZIL_CUP_2026_FORMAT.twoLeggedStages[number]),winners=twoLegged?resolveTwoLeggedTies(stageFixtures,(first,second)=>squadStrength(game,first)>=squadStrength(game,second)?first:second).winners:stageFixtures.map((fixture)=>(fixture.homeGoals??0)>(fixture.awayGoals??0)?fixture.homeId:fixture.awayId);
  if(competition.currentStage==="Final"){competition.complete=true;competition.championId=winners[0];competition.currentStage="Campeão";return{fixtures:nextFixtures,competitions:nextCompetitions};}
  const nextStages:Record<string,string>={"1ª fase":"2ª fase","2ª fase":"3ª fase","3ª fase":"4ª fase","4ª fase":"5ª fase","5ª fase":"Oitavas","Oitavas":"Quartas","Quartas":"Semifinal","Semifinal":"Final"},nextStage=nextStages[competition.currentStage];if(!nextStage)return{fixtures:nextFixtures,competitions:nextCompetitions};const teams=[...winners,...(competition.entryWaves?.[nextStage]??[])],lastDate=stageFixtures.reduce((latest,fixture)=>fixture.date>latest?fixture.date:latest,stageFixtures[0].date),date=datePlusDays(lastDate,7),round=Math.max(...stageFixtures.map((fixture)=>fixture.round))+1;competition.currentStage=nextStage;
  if(BRAZIL_CUP_2026_FORMAT.twoLeggedStages.includes(nextStage as typeof BRAZIL_CUP_2026_FORMAT.twoLeggedStages[number]))nextFixtures.push(...buildTwoLeggedTies({competitionId:competition.id,season:competition.season,stage:nextStage,round,firstLegDate:date,pairs:pairTeams(teams)}));else nextFixtures.push(...singleLegRound(competition,teams,nextStage,date,round));
  return{fixtures:nextFixtures,competitions:nextCompetitions};
}

function advanceRegionalCups(game:GameState,fixtures:Fixture[],competitions:Competition[]){
  const nextFixtures=[...fixtures],nextCompetitions=competitions.map((competition)=>({...competition,groups:competition.groups?Object.fromEntries(Object.entries(competition.groups).map(([group,ids])=>[group,[...ids]])):undefined}));
  nextCompetitions.filter((competition)=>competition.formatId==="regional-cup-2026"&&!competition.complete).forEach((competition)=>{const stageFixtures=nextFixtures.filter((fixture)=>fixture.competitionId===competition.id&&fixture.stage===competition.currentStage);if(!stageFixtures.length||stageFixtures.some((fixture)=>!fixture.played))return;const format=REGIONAL_CUP_FORMATS_2026[competition.id],tieBreaker=(first:string,second:string)=>squadStrength(game,first)>=squadStrength(game,second)?first:second;let winners:string[];
    if(competition.currentStage==="Fase de grupos")winners=Object.values(competition.groups??{}).flatMap((ids)=>calculateStandings(ids.map((id)=>clubById(game,id)),stageFixtures).slice(0,format.advancingPerGroup).map((row)=>row.clubId));else if(competition.currentStage==="Quartas")winners=stageFixtures.map((fixture)=>(fixture.homeGoals??0)>(fixture.awayGoals??0)?fixture.homeId:fixture.awayId);else winners=resolveTwoLeggedTies(stageFixtures,tieBreaker).winners;
    if(competition.currentStage==="Final"){competition.complete=true;competition.championId=winners[0];competition.currentStage="Campeão";return;}
    const nextStage=competition.currentStage==="Fase de grupos"?(winners.length===8?"Quartas":"Semifinal"):competition.currentStage==="Quartas"?"Semifinal":"Final",lastDate=stageFixtures.reduce((latest,fixture)=>fixture.date>latest?fixture.date:latest,stageFixtures[0].date),date=datePlusDays(lastDate,7),round=Math.max(...stageFixtures.map((fixture)=>fixture.round))+1,random=seededRandom(`${competition.id}-${competition.season}-${nextStage}`),shuffled=[...winners].sort(()=>random()-.5);competition.currentStage=nextStage;
    if(nextStage==="Quartas")nextFixtures.push(...singleLegRound(competition,shuffled,nextStage,date,round));else nextFixtures.push(...buildTwoLeggedTies({competitionId:competition.id,season:competition.season,stage:nextStage,round,firstLegDate:date,pairs:pairTeams(shuffled)}));
  });
  return{fixtures:nextFixtures,competitions:nextCompetitions};
}

function pairTeams(teams:readonly string[]):Array<readonly[string,string]>{return Array.from({length:Math.floor(teams.length/2)},(_,index)=>[teams[index*2],teams[index*2+1]] as const);}

function advanceBrazilianLeagueStages(game:GameState,fixtures:Fixture[],competitions:Competition[]){
  const nextFixtures=[...fixtures],nextCompetitions=competitions.map((competition)=>({...competition,pendingByes:[...competition.pendingByes],promotedClubIds:[...(competition.promotedClubIds??[])]}));
  const tieBreaker=(first:string,second:string)=>squadStrength(game,first)>=squadStrength(game,second)?first:second;
  const serieB=nextCompetitions.find((competition)=>competition.id==="BRA-B");
  if(serieB&&!serieB.complete){
    const regular=nextFixtures.filter((fixture)=>fixture.competitionId===serieB.id&&fixture.stage==="Liga");
    if(serieB.currentStage==="Liga"&&regular.length&&regular.every((fixture)=>fixture.played)){
      const table=calculateStandings(serieB.participantIds.map((id)=>clubById(game,id)),regular);serieB.championId=table[0]?.clubId;serieB.promotedClubIds=table.slice(0,2).map((row)=>row.clubId);serieB.currentStage="Playoffs de acesso";
      const lastDate=regular.reduce((latest,fixture)=>fixture.date>latest?fixture.date:latest,regular[0].date),pairs:Array<readonly[string,string]>=[[table[2].clubId,table[5].clubId],[table[3].clubId,table[4].clubId]];
      nextFixtures.push(...buildTwoLeggedTies({competitionId:serieB.id,season:serieB.season,stage:serieB.currentStage,round:39,firstLegDate:datePlusDays(lastDate,7),pairs}));
    }else if(serieB.currentStage==="Playoffs de acesso"){
      const playoff=nextFixtures.filter((fixture)=>fixture.competitionId===serieB.id&&fixture.stage===serieB.currentStage);if(playoff.length&&playoff.every((fixture)=>fixture.played)){const resolved=resolveTwoLeggedTies(playoff,tieBreaker);serieB.promotedClubIds=[...(serieB.promotedClubIds??[]),...resolved.winners];serieB.complete=true;serieB.currentStage="Encerrada";}
    }
  }
  const serieD=nextCompetitions.find((competition)=>competition.id==="BRA-D");
  if(serieD&&!serieD.complete){
    const stageFixtures=nextFixtures.filter((fixture)=>fixture.competitionId===serieD.id&&fixture.stage===serieD.currentStage);
    if(serieD.currentStage==="Fase de grupos"){
      const groups=[...new Set(nextFixtures.filter((fixture)=>fixture.competitionId===serieD.id&&fixture.stage.startsWith("Grupo ")).map((fixture)=>fixture.stage))];const groupFixtures=nextFixtures.filter((fixture)=>fixture.competitionId===serieD.id&&groups.includes(fixture.stage));
      if(groupFixtures.length&&groupFixtures.every((fixture)=>fixture.played)){const qualified=groups.flatMap((group)=>{const matches=groupFixtures.filter((fixture)=>fixture.stage===group),ids=[...new Set(matches.flatMap((fixture)=>[fixture.homeId,fixture.awayId]))];return calculateStandings(ids.map((id)=>clubById(game,id)),matches).slice(0,BRAZIL_2026.serieDFormat.advancingPerGroup).map((row)=>row.clubId);});const random=seededRandom(`${serieD.season}-serie-d-2fase`),shuffled=[...qualified].sort(()=>random()-.5),lastDate=groupFixtures.reduce((latest,fixture)=>fixture.date>latest?fixture.date:latest,groupFixtures[0].date);serieD.currentStage="2ª fase";nextFixtures.push(...buildTwoLeggedTies({competitionId:serieD.id,season:serieD.season,stage:serieD.currentStage,round:11,firstLegDate:datePlusDays(lastDate,7),pairs:pairTeams(shuffled)}));}
    }else if(stageFixtures.length&&stageFixtures.every((fixture)=>fixture.played)){
      if(serieD.currentStage==="Semifinais e playoffs"){
        const semifinals=stageFixtures.filter((fixture)=>fixture.tieId?.includes("-semi-")),playoffs=stageFixtures.filter((fixture)=>fixture.tieId?.includes("-playoff-"));const semifinalWinners=resolveTwoLeggedTies(semifinals,tieBreaker).winners,playoffWinners=resolveTwoLeggedTies(playoffs,tieBreaker).winners;serieD.promotedClubIds=[...(serieD.promotedClubIds??[]),...playoffWinners];serieD.currentStage="Final";const firstDate=datePlusDays(stageFixtures.reduce((latest,fixture)=>fixture.date>latest?fixture.date:latest,stageFixtures[0].date),7),finalFixtures=buildTwoLeggedTies({competitionId:serieD.id,season:serieD.season,stage:"Final",round:17,firstLegDate:firstDate,pairs:pairTeams(semifinalWinners)}).map((fixture)=>({...fixture,tieId:fixture.tieId?.replace("-17-","-final-")}));nextFixtures.push(...finalFixtures);
      }else if(serieD.currentStage==="Final"){
        serieD.championId=resolveTwoLeggedTies(stageFixtures,tieBreaker).winners[0];serieD.complete=true;serieD.currentStage="Campeão";
      }else{
        const resolved=resolveTwoLeggedTies(stageFixtures,tieBreaker),stageOrder:Record<string,string>={"2ª fase":"3ª fase","3ª fase":"Oitavas","Oitavas":"Quartas"};const lastDate=stageFixtures.reduce((latest,fixture)=>fixture.date>latest?fixture.date:latest,stageFixtures[0].date);
        if(serieD.currentStage==="Quartas"){serieD.promotedClubIds=resolved.winners;serieD.currentStage="Semifinais e playoffs";const semifinalFixtures=buildTwoLeggedTies({competitionId:serieD.id,season:serieD.season,stage:serieD.currentStage,round:15,firstLegDate:datePlusDays(lastDate,7),pairs:pairTeams(resolved.winners)}).map((fixture)=>({...fixture,tieId:fixture.tieId?.replace("-15-","-semi-")})),playoffFixtures=buildTwoLeggedTies({competitionId:serieD.id,season:serieD.season,stage:serieD.currentStage,round:15,firstLegDate:datePlusDays(lastDate,7),pairs:pairTeams(resolved.losers)}).map((fixture)=>({...fixture,tieId:fixture.tieId?.replace("-15-","-playoff-")}));nextFixtures.push(...semifinalFixtures,...playoffFixtures);}else{const nextStage=stageOrder[serieD.currentStage];if(nextStage){serieD.currentStage=nextStage;nextFixtures.push(...buildTwoLeggedTies({competitionId:serieD.id,season:serieD.season,stage:nextStage,round:stageFixtures[0].round+2,firstLegDate:datePlusDays(lastDate,7),pairs:pairTeams(resolved.winners)}));}}
      }
    }
  }
  return{fixtures:nextFixtures,competitions:nextCompetitions};
}

function advanceCompetitions(game:GameState,fixtures:Fixture[],competitions:Competition[]){const nationalCup=advanceBrazilCup(game,fixtures,competitions),regionals=advanceRegionalCups({...game,fixtures:nationalCup.fixtures,competitions:nationalCup.competitions},nationalCup.fixtures,nationalCup.competitions),cups=advanceCups({...game,fixtures:regionals.fixtures,competitions:regionals.competitions},regionals.fixtures,regionals.competitions);return advanceBrazilianLeagueStages({...game,fixtures:cups.fixtures,competitions:cups.competitions},cups.fixtures,cups.competitions);}

function generateMarketOffers(game:GameState,count=6):MarketOffer[]{const random=seededRandom(`${game.season}-${game.date}-market`);const candidates=game.players.filter((player)=>!player.academy&&player.clubId!==game.userClubId&&(!player.starting||player.listed)).sort(()=>random()-.5).slice(0,count);return candidates.map((player,index)=>({id:`offer-${game.date}-${index}-${player.id}`,playerId:player.id,fromClubId:player.clubId,askingPrice:Math.round(player.value*((player.listed?.86:.96)+random()*.16)),expiresAt:datePlusDays(game.date,28)}));}

function generateVacancies(game:GameState,count=4):JobVacancy[]{
  const random=seededRandom(`${game.season}-${game.date}-jobs`);
  return game.clubs
    .filter((club)=>club.id!==game.userClubId)
    .map((club)=>({club,roll:random(),minimumReputation:Math.max(35,club.reputation-18)}))
    .sort((a,b)=>Number(a.minimumReputation>game.managerReputation+8)-Number(b.minimumReputation>game.managerReputation+8)||a.roll-b.roll)
    .slice(0,count)
    .map(({club,minimumReputation},index)=>({id:`job-${game.date}-${index}-${club.id}`,clubId:club.id,openedAt:game.date,minimumReputation,status:"open"}));
}

function makeManagerOffer(game: GameState, vacancy: JobVacancy): ManagerOffer {
  const club=clubById(game,vacancy.clubId);
  const random=seededRandom(`${vacancy.id}-${game.managerReputation}`);
  const contractYears=1+Math.floor(random()*3);
  return {...vacancy,status:"offered",weeklySalary:Math.max(4_000,Math.round(club.reputation**2*(2.5+random()))),contractYears,releaseClausePaid:game.managerStatus==="employed"?game.managerContract.releaseClause:0};
}

function runAiTransfers(game:GameState,players:Player[],date:string):{players:Player[];events:TransferEvent[]} {
  if(game.matchesManaged%2!==1)return{players,events:[]};const random=seededRandom(`${game.season}-${date}-ai-transfers`);let next=[...players];const events:TransferEvent[]=[];
  for(let index=0;index<3;index+=1){const buyers=game.clubs.filter((club)=>club.id!==game.userClubId),buyer=buyers[Math.floor(random()*buyers.length)];const candidates=next.filter((player)=>player.clubId!==buyer.id&&player.clubId!==game.userClubId&&!player.academy&&!player.starting&&Math.abs(player.rating-buyer.reputation)<18);const player=candidates[Math.floor(random()*candidates.length)];if(!player)continue;const fee=Math.round(player.value*(.78+random()*.35));events.push({id:`tx-${date}-${index}-${player.id}`,date,playerId:player.id,playerName:player.name,fromClubId:player.clubId,toClubId:buyer.id,fee,kind:"compra"});next=next.map((item)=>item.id===player.id?{...item,clubId:buyer.id,starting:false,morale:82,contract:3}:item);}
  return{players:next,events};
}

export function finishRound(game:GameState,plan:MatchPlan):GameState {
  const userFixture=game.fixtures.find((fixture)=>fixture.id===plan.fixtureId);if(!userFixture||userFixture.played)return game;let players=game.players.map((player)=>({...player}));
  let fixtures=game.fixtures.map((fixture)=>{if(fixture.id===userFixture.id)return{...fixture,played:true,homeGoals:plan.homeGoals,awayGoals:plan.awayGoals};if(!fixture.played&&fixture.date<=userFixture.date&&fixture.homeId!==game.userClubId&&fixture.awayId!==game.userClubId)return playFixture(game,fixture,"world");return fixture;});
  const advanced=advanceCompetitions(game,fixtures,game.competitions);fixtures=advanced.fixtures;const competitions=advanced.competitions;
  const home=userFixture.homeId===game.userClubId,userGoals=home?plan.homeGoals:plan.awayGoals,opponentGoals=home?plan.awayGoals:plan.homeGoals;const result:"V"|"E"|"D"=userGoals>opponentGoals?"V":userGoals===opponentGoals?"E":"D";const opponent=clubById(game,home?userFixture.awayId:userFixture.homeId);const random=seededRandom(`${plan.fixtureId}-stats`);
  players=players.map((player)=>player.clubId===game.userClubId&&!player.academy?{...player,injuredMatches:player.injuredMatches?player.injuredMatches-1:undefined,appearances:player.appearances+(player.starting?1:0),fitness:clamp(player.fitness-(player.starting?(game.intensity==="Alta"?9:game.intensity==="Baixa"?3:6):1),45,100),morale:clamp(player.morale+(result==="V"?3:result==="D"?-3:0),30,100)}:player);
  let injuryNews:NewsItem|undefined;const injuryChance=game.intensity==="Alta"?.12:game.intensity==="Normal"?.075:.04;if(random()<injuryChance){const options=players.filter((player)=>player.clubId===game.userClubId&&!player.academy&&player.starting&&!player.injuredMatches),injured=options[Math.floor(random()*options.length)];if(injured){const duration=1+Math.floor(random()*4),replacement=players.filter((player)=>player.clubId===game.userClubId&&!player.academy&&!player.starting&&!player.injuredMatches&&player.position===injured.position).sort((a,b)=>b.rating-a.rating)[0];players=players.map((player)=>player.id===injured.id?{...player,injuredMatches:duration,starting:false}:replacement&&player.id===replacement.id?{...player,starting:true}:player);injuryNews={id:`injury-${userFixture.date}-${injured.id}`,date:userFixture.date,category:"elenco",title:`Lesão: ${injured.name}`,body:`O atleta ficará fora por cerca de ${duration} partida(s).${replacement?` ${replacement.name} assumiu a vaga automaticamente.`:""}`,unread:true};}}
  plan.events.filter((event)=>event.type==="goal"&&event.playerId).forEach((event)=>{players=players.map((player)=>player.id===event.playerId?{...player,goals:player.goals+1}:player);if(event.teamId===game.userClubId){const choices=players.filter((player)=>player.clubId===game.userClubId&&player.starting&&player.id!==event.playerId),assist=choices[Math.floor(random()*choices.length)];if(assist&&random()>.28)players=players.map((player)=>player.id===assist.id?{...player,assists:player.assists+1}:player);}});
  const tempGame={...game,fixtures,competitions,players} as GameState;const ai=runAiTransfers(tempGame,players,userFixture.date);players=ai.players;
  const confidence=clamp(game.boardConfidence+(result==="V"?3:result==="D"?-3:0),5,99),matchesManaged=game.matchesManaged+1;let managerStatus=game.managerStatus;let vacancies=game.vacancies.filter((job)=>job.openedAt>=datePlusDays(userFixture.date,-120));let jobOffers=game.jobOffers;let offerNews:NewsItem|undefined;
  if(confidence<14&&matchesManaged>=8){managerStatus="unemployed";vacancies=[{id:`dismissed-${game.userClubId}-${userFixture.date}`,clubId:game.userClubId,openedAt:userFixture.date,minimumReputation:35,status:"open"},...vacancies];jobOffers=vacancies.filter((job)=>job.clubId!==game.userClubId).slice(0,2).map((job)=>makeManagerOffer({...game,managerStatus:"unemployed"},job));}
  if(matchesManaged%5===0)vacancies=[...generateVacancies({...tempGame,date:userFixture.date,matchesManaged} as GameState,3),...vacancies].slice(0,8);
  if(game.acceptingJobOffers&&managerStatus==="employed"&&matchesManaged%5===0){const invitations=vacancies.filter((job)=>job.clubId!==game.userClubId&&job.minimumReputation<=game.managerReputation+5).slice(0,2).map((job)=>makeManagerOffer(game,job));jobOffers=[...invitations,...jobOffers.filter((job)=>job.openedAt>=datePlusDays(userFixture.date,-90))].slice(0,4);if(invitations.length)offerNews={id:`offers-${userFixture.date}`,date:userFixture.date,category:"carreira",title:"Seu empresário recebeu contatos",body:`${invitations.length} clube(s) demonstraram interesse no seu trabalho.`,unread:true};}
  const currentRecord=game.managerRecord.map((record,index)=>index===game.managerRecord.length-1?{...record,matches:record.matches+1,wins:record.wins+(result==="V"?1:0)}:record);
  const nextFixture=managerStatus==="employed"?fixtures.filter((fixture)=>!fixture.played&&(fixture.homeId===game.userClubId||fixture.awayId===game.userClubId)).sort((a,b)=>a.date.localeCompare(b.date))[0]:undefined;
  const news:NewsItem[]=[{id:`result-${userFixture.id}`,date:userFixture.date,category:"competição",title:`${userClub(game).name} ${userGoals} x ${opponentGoals} ${opponent.name}`,body:`${competitionById(game,userFixture.competitionId).short}: ${result==="V"?"vitória importante":result==="E"?"empate equilibrado":"derrota que exige reação"}.`,unread:true},...ai.events.slice(0,1).map((event)=>({id:`news-${event.id}`,date:event.date,category:"mercado" as const,title:`${event.playerName} muda de clube`,body:`Negociação fechada por ${formatMoney(event.fee)}. O mercado segue ativo enquanto as competições acontecem.`,unread:true}))];
  if(injuryNews)news.unshift(injuryNews);if(offerNews)news.unshift(offerNews);
  if(managerStatus==="unemployed")news.unshift({id:`fired-${userFixture.date}`,date:userFixture.date,category:"carreira",title:"A diretoria encerrou seu trabalho",body:"A sequência ruim derrubou a confiança. Consulte as vagas e propostas para continuar a carreira em outro clube.",unread:true});
  const updated:GameState={...game,managerStatus,players,fixtures,competitions,standings:[],date:nextFixture?.date??userFixture.date,round:game.round+1,balance:game.balance+game.weeklyIncome-game.weeklyExpenses+(home?Math.round(game.reputation**2*110):0),boardConfidence:confidence,lastFive:[...game.lastFive,result].slice(-5),matchesManaged,managerPoints:game.managerPoints+(result==="V"?5:result==="E"?2:0),managerReputation:clamp(game.managerReputation+(result==="V"?.7:result==="D"?-.35:.1),25,95),managerRecord:currentRecord,transferEvents:[...ai.events,...game.transferEvents].slice(0,80),marketOffers:generateMarketOffers({...tempGame,date:userFixture.date} as GameState,8),incomingBids:game.incomingBids.filter((bid)=>bid.expiresAt>=userFixture.date),vacancies,jobOffers,news:[...news,...game.news].slice(0,120),lastSavedAt:new Date().toISOString()};
  if(matchesManaged%3===0){const sellable=squadFor(updated,updated.userClubId).filter((player)=>!player.starting),target=sellable[Math.floor(random()*sellable.length)],buyer=updated.clubs.filter((club)=>club.id!==updated.userClubId)[Math.floor(random()*(updated.clubs.length-1))];if(target&&buyer)updated.incomingBids=[{id:`bid-${userFixture.date}-${target.id}`,playerId:target.id,fromClubId:buyer.id,fee:Math.round(target.value*(.8+random()*.35)),expiresAt:datePlusDays(userFixture.date,24)},...updated.incomingBids];}
  updated.standings=refreshUserStandings(updated);return updated;
}

function completeWorldSeason(game:GameState) {
  let fixtures=[...game.fixtures],competitions=game.competitions.map((item)=>({...item,pendingByes:[...item.pendingByes]}));let guard=0;
  while(guard<320){const pending=fixtures.filter((fixture)=>!fixture.played).sort((a,b)=>a.date.localeCompare(b.date));if(!pending.length)break;const date=pending[0].date;const snapshot={...game,fixtures,competitions} as GameState;fixtures=fixtures.map((fixture)=>!fixture.played&&fixture.date===date?playFixture(snapshot,fixture,"season-close"):fixture);const advanced=advanceCompetitions(snapshot,fixtures,competitions);fixtures=advanced.fixtures;competitions=advanced.competitions;guard+=1;}
  return{fixtures,competitions};
}

function reviewBoardObjectives(game: GameState, userPosition: number, outcome: string) {
  const reviewed=game.boardObjectives.map((objective)=>{
    const fulfilled=objective.id==="promotion"?outcome==="Promovido":objective.id==="position"?userPosition<=(objective.label.includes("6")?6:8):objective.id==="finances"?game.balance>0:game.academyLevel>=Math.max(2,Math.round(userClub(game).academy/22));
    return {...objective,status:fulfilled?"cumprida" as const:"não cumprida" as const};
  });
  const score=reviewed.reduce((sum,objective)=>sum+(objective.status==="cumprida"?objective.weight:0),0);
  return {reviewed,score};
}

function qualificationFromSeason(game:GameState,tables: Map<string,Standing[]>): SeasonQualification {
  const ranked=(leagueId:string)=>tables.get(leagueId)?.map((row)=>row.clubId)??[];
  const brazil=ranked("BRA-A"),argentina=ranked("ARG-1"),spain=ranked("ESP-1"),italy=ranked("ITA-1");
  const champions=[ranked("BRA-C")[0],game.competitions.find((competition)=>competition.id==="BRA-D")?.championId,game.competitions.find((competition)=>competition.id==="REGIONAL-NE")?.championId,game.competitions.find((competition)=>competition.id==="REGIONAL-NCO")?.championId].filter((id):id is string=>Boolean(id));
  return {brazilPrimary:brazil.slice(0,8),brazilSecondary:brazil.slice(8,16),argentinaPrimary:argentina.slice(0,8),argentinaSecondary:argentina.slice(8,16),spainPrimary:spain.slice(0,8),italyPrimary:italy.slice(0,8),brazilCupProtected:[...new Set(champions)].slice(0,4)};
}

function seasonFinancialPlan(club: Club, currentLevel: number, nextLevel: number, position: number) {
  const promoted=nextLevel<currentLevel;
  const levelRevenue=[0,44_000_000,20_000_000,8_500_000,3_500_000][nextLevel]??3_500_000;
  const clubScale=Math.round(club.reputation**2*1_150);
  const sportingBonus=promoted?Math.round(levelRevenue*.58+clubScale):position===1?Math.round(levelRevenue*.28+clubScale*.55):Math.round(levelRevenue*.11+clubScale*.3);
  const transferAllocation=Math.round(sportingBonus*(promoted?.68:.32));
  const weeklyIncome=Math.round(club.reputation**2*(120+(5-nextLevel)*24));
  const weeklyExpenses=Math.round(club.reputation**2*(102+(5-nextLevel)*18));
  return {sportingBonus,transferAllocation,weeklyIncome,weeklyExpenses};
}

function createSerieDEntrants(season: number, count: number): Club[] {
  const entries=[
    ["MA","São Luís","União Maranhense"],["PI","Teresina","Atlético Piauiense"],["ES","Vitória","Capixaba"],["MS","Campo Grande","Operário do Centro"],
    ["PB","João Pessoa","Nacional da Paraíba"],["AM","Manaus","Amazonas Norte"],["MT","Cuiabá","Cuiabá Serrano"],["TO","Palmas","Palmas FC"],
  ] as const;
  return Array.from({length:count},(_,index)=>{const [state,city,name]=entries[(season+index)%entries.length];const reputation=56+(index%4)*2;return{id:`bra-d-entry-${season}-${index+1}`,name,short:`D${season.toString().slice(-2)}${index+1}`,city,state,country:"Brasil" as const,divisionId:"BRA-D",reputation,academy:Math.max(42,reputation-8),stadium:`Estádio ${city}`,primary:["#193d63","#7a2630","#154d3a","#47306b"][index%4],secondary:"#f4f0e7",balance:Math.round(reputation**2*14_500),transferBudget:Math.round((reputation-48)**2*26_000)};});
}

export function startNextSeason(game:GameState):GameState {
  const completed=completeWorldSeason(game);const snapshot={...game,fixtures:completed.fixtures,competitions:completed.competitions} as GameState;const tables=new Map<string,Standing[]>();game.leagues.forEach((league)=>tables.set(league.id,competitionTable(snapshot,league.id)));
  const qualification=qualificationFromSeason(snapshot,tables);
  const currentLeague=userLeague(game),userTable=tables.get(currentLeague.id)??[],userPosition=userTable.findIndex((row)=>row.clubId===game.userClubId)+1,userRow=userTable.find((row)=>row.clubId===game.userClubId)??{points:0};const champion=clubById(game,userTable[0]?.clubId??game.userClubId);
  const transitions:LeagueTransitionRule[]=[...brazilianTransitionRules(game.season),{upper:"ESP-1",lower:"ESP-2",relegated:3,promoted:3},{upper:"ITA-1",lower:"ITA-2",relegated:3,promoted:3}];const moves=resolveLeagueTransitions(transitions,tables);const applyPromoted=(lower:string,upper:string)=>{const promoted=snapshot.competitions.find((competition)=>competition.id===lower)?.promotedClubIds;if(!promoted?.length)return;game.clubs.filter((club)=>club.divisionId===lower&&moves.get(club.id)===upper).forEach((club)=>moves.delete(club.id));promoted.forEach((clubId)=>moves.set(clubId,upper));};applyPromoted("BRA-B","BRA-A");applyPromoted("BRA-D","BRA-C");
  let clubs=game.clubs.map((club)=>moves.has(club.id)?{...club,divisionId:moves.get(club.id)!}:club);const postMoveDivisions=new Map(clubs.map((club)=>[club.id,club.divisionId]));const serieDShortfall=divisionShortfall("BRA-D",game.clubs.filter((club)=>club.divisionId==="BRA-D").map((club)=>club.id),postMoveDivisions);clubs=mergeMissingWorldClubs([...clubs,...createSerieDEntrants(game.season+1,serieDShortfall)]);const oldDivision=currentLeague.id,newDivision=clubs.find((club)=>club.id===game.userClubId)?.divisionId??oldDivision;const outcome=newDivision!==oldDivision?(game.leagues.find((league)=>league.id===newDivision)!.level<currentLeague.level?"Promovido":"Rebaixado"):`${userPosition}º lugar`;
  const nextSeason=game.season+1,random=seededRandom(`${nextSeason}-aging`);let retired=0;let players=game.players.flatMap((player)=>{if(player.academy)return[{...player,age:player.age+1,rating:clamp(player.rating+(random()>.3?1:0),35,player.potential)}];const age=player.age+1;if(age>=38||(age>=35&&random()>.72)){if(player.clubId===game.userClubId)retired+=1;return[];}const development=age<=24&&player.rating<player.potential?(random()>.24?1:0):age>=32&&random()>.4?-1:0;return[{...player,age,rating:clamp(player.rating+development,38,player.potential),contract:Math.max(1,player.contract-1),goals:0,assists:0,appearances:0,fitness:100,morale:clamp(player.morale+3,45,100),listed:random()>.88}];});
  clubs.forEach((club)=>{const count=players.filter((player)=>player.clubId===club.id&&!player.academy).length;if(count<20)players.push(...makeAcademy(club,nextSeason,20-count).map((player)=>({...player,id:`${player.id}-senior`,academy:false,age:player.age+2,rating:player.rating+5})));});players=[...players.filter((player)=>!(player.clubId===game.userClubId&&player.academy&&player.age>19)),...makeAcademy(clubs.find((club)=>club.id===game.userClubId)!,nextSeason,5)];
  const world=buildSeason(clubs,nextSeason,qualification);const promoted=outcome==="Promovido",relegated=outcome==="Rebaixado";const boardReview=reviewBoardObjectives(game,userPosition,outcome);const nextConfidence=clamp(Math.round(game.boardConfidence*.45+boardReview.score*.55+(promoted?8:relegated?-12:0)),12,94);const managerStatus:GameState["managerStatus"]=relegated&&boardReview.score<35&&nextConfidence<35?"unemployed":game.managerStatus;const record=game.managerRecord.map((item,index)=>index===game.managerRecord.length-1?{...item,toSeason:managerStatus==="unemployed"?game.season:item.toSeason}:item);const futureLeague=game.leagues.find((league)=>league.id===newDivision)!;const futureClub=clubs.find((club)=>club.id===game.userClubId)!;
  const financialPlan=seasonFinancialPlan(futureClub,currentLeague.level,futureLeague.level,userPosition);
  const next:GameState={...game,season:nextSeason,date:`${nextSeason}-01-10`,round:1,clubs,players,fixtures:world.fixtures,competitions:world.competitions,standings:[],history:[...game.history,{season:game.season,club:userClub(game).name,division:currentLeague.name,champion:champion.name,userPosition,userPoints:userRow.points,outcome}],managerStatus,managerRecord:record,lastFive:[],balance:game.balance+financialPlan.sportingBonus,transferBudget:game.transferBudget+financialPlan.transferAllocation,weeklyIncome:financialPlan.weeklyIncome,weeklyExpenses:financialPlan.weeklyExpenses,boardConfidence:nextConfidence,boardObjectives:createBoardObjectives(futureClub,futureLeague),marketOffers:[],incomingBids:[],vacancies:[],jobOffers:[],news:[{id:`season-${nextSeason}`,date:`${nextSeason}-01-10`,category:"carreira" as const,title:`Temporada ${nextSeason}: ${outcome}`,body:`${retired?`${retired} atleta(s) do clube se aposentaram. `:""}A diretoria liberou ${formatMoney(financialPlan.sportingBonus)} pela campanha, com ${formatMoney(financialPlan.transferAllocation)} destinados ao mercado. Metas cumpridas: ${boardReview.score}%.`,unread:true},...game.news].slice(0,120),lastSavedAt:new Date().toISOString()};
  next.standings=refreshUserStandings(next);next.marketOffers=generateMarketOffers(next,8);next.vacancies=generateVacancies(next,5);if(managerStatus==="unemployed")next.jobOffers=next.vacancies.filter((job)=>job.minimumReputation<=next.managerReputation).slice(0,3).map((job)=>makeManagerOffer(next,job));next.date=nextUserFixture(next)?.date??next.date;return next;
}

export function seasonIsOver(game:GameState){if(game.managerStatus==="unemployed")return false;return !nextUserFixture(game);}

export function promoteYouth(game:GameState,playerId:string):GameState{return{...game,players:game.players.map((player)=>player.id===playerId?{...player,academy:false,contract:3,wage:Math.max(player.wage,6500),morale:clamp(player.morale+8,0,100)}:player),news:[{id:`promote-${playerId}`,date:game.date,category:"base",title:"Joia promovida ao elenco principal",body:`${game.players.find((player)=>player.id===playerId)?.name??"O jovem"} agora treina com os profissionais.`,unread:true},...game.news]};}
export function scoutProspect(game:GameState):GameState{if(game.balance<600_000)return game;const prospect=makeAcademy(userClub(game),game.season+game.players.filter((player)=>player.academy).length,1)[0];return{...game,balance:game.balance-600_000,players:[...game.players,prospect],news:[{id:`scout-${prospect.id}`,date:game.date,category:"base",title:"Olheiro encontra novo talento",body:`${prospect.name}, ${prospect.position}, chega para formação.`,unread:true},...game.news]};}
export function upgradeAcademy(game:GameState):GameState{const cost=game.academyLevel*3_000_000;if(game.academyLevel>=5||game.balance<cost)return game;return{...game,balance:game.balance-cost,academyLevel:game.academyLevel+1,news:[{id:`academy-up-${game.academyLevel+1}`,date:game.date,category:"base",title:"Centro de formação ampliado",body:"Estrutura, análise e captação da base foram melhoradas.",unread:true},...game.news]};}

export function buyPlayer(game:GameState,playerId:string,forcedPrice?:number):GameState{const player=game.players.find((item)=>item.id===playerId);if(!player||player.clubId===game.userClubId)return game;const window=transferWindow(game);if(!window.open)return{...game,news:[{id:`market-closed-${game.date}-${playerId}`,date:game.date,category:"mercado",title:"Mercado fechado",body:"A negociação só poderá ser concluída na próxima janela de transferências.",unread:true},...game.news]};const price=forcedPrice??player.value;if(price>game.transferBudget||price>game.balance)return game;const seller=clubById(game,player.clubId),buyer=userClub(game);const random=seededRandom(`buy-${game.date}-${player.id}-${price}`);const minimumPrice=player.listed||!player.starting?player.value*.84:player.value*(1.08+random()*.18);const clubAccepts=price>=minimumPrice;const playerAccepts=buyer.reputation>=seller.reputation-6||!player.starting||player.morale<66||random()>.55;if(!clubAccepts||!playerAccepts){const reason=!clubAccepts?`${seller.name} considerou a proposta abaixo do valor necessário.`:`${player.name} preferiu continuar no projeto atual.`;return{...game,news:[{id:`buy-refused-${game.date}-${player.id}`,date:game.date,category:"mercado",title:"Negociação não avançou",body:reason,unread:true},...game.news]};}const event:TransferEvent={id:`user-buy-${game.date}-${player.id}`,date:game.date,playerId:player.id,playerName:player.name,fromClubId:player.clubId,toClubId:game.userClubId,fee:price,kind:"compra"};return{...game,transferBudget:game.transferBudget-price,balance:game.balance-price,players:game.players.map((item)=>item.id===playerId?{...item,clubId:game.userClubId,starting:false,morale:86,contract:4,listed:false}:item),marketOffers:game.marketOffers.filter((offer)=>offer.playerId!==playerId),transferEvents:[event,...game.transferEvents].slice(0,80),news:[{id:`buy-${playerId}-${game.date}`,date:game.date,category:"mercado",title:`${player.name} é o novo reforço`,body:`Contratação fechada por ${formatMoney(price)}.`,unread:true},...game.news]};}
export function sellPlayer(game:GameState,playerId:string,feeOverride?:number,buyerOverride?:string):GameState{const player=game.players.find((item)=>item.id===playerId&&item.clubId===game.userClubId&&!item.academy);if(!player)return game;const buyer=buyerOverride?clubById(game,buyerOverride):game.clubs.filter((club)=>club.id!==game.userClubId).sort((a,b)=>Math.abs(a.reputation-player.rating)-Math.abs(b.reputation-player.rating))[0];const fee=feeOverride??Math.round(player.value*.9);const event:TransferEvent={id:`user-sell-${game.date}-${player.id}`,date:game.date,playerId:player.id,playerName:player.name,fromClubId:game.userClubId,toClubId:buyer.id,fee,kind:"compra"};return{...game,transferBudget:game.transferBudget+fee,balance:game.balance+fee,players:game.players.map((item)=>item.id===playerId?{...item,clubId:buyer.id,starting:false,morale:78,listed:false}:item),incomingBids:game.incomingBids.filter((bid)=>bid.playerId!==playerId),transferEvents:[event,...game.transferEvents].slice(0,80),news:[{id:`sell-${playerId}-${game.date}`,date:game.date,category:"mercado",title:`${player.name} deixa o clube`,body:`${buyer.name} acertou a contratação por ${formatMoney(fee)}.`,unread:true},...game.news]};}
export function acceptBid(game:GameState,bidId:string):GameState{const bid=game.incomingBids.find((item)=>item.id===bidId);return bid&&transferWindow(game).open?sellPlayer(game,bid.playerId,bid.fee,bid.fromClubId):game;}
export function rejectBid(game:GameState,bidId:string):GameState{return{...game,incomingBids:game.incomingBids.filter((bid)=>bid.id!==bidId)};}
export function togglePlayerListing(game:GameState,playerId:string):GameState{const player=game.players.find((item)=>item.id===playerId&&item.clubId===game.userClubId&&!item.academy);if(!player)return game;const listed=!player.listed;return{...game,players:game.players.map((item)=>item.id===playerId?{...item,listed}:item),news:[{id:`listing-${game.date}-${player.id}`,date:game.date,category:"mercado",title:listed?`${player.name} foi colocado à venda`:`${player.name} saiu da lista de transferências`,body:listed?"Seu empresário passará a ouvir propostas pelo atleta.":"O clube não aceitará novas abordagens no momento.",unread:true},...game.news]};}
export function toggleStarter(game:GameState,playerId:string):GameState{const player=game.players.find((item)=>item.id===playerId);if(!player||player.clubId!==game.userClubId||player.academy||player.injuredMatches)return game;const starters=squadFor(game,game.userClubId).filter((item)=>item.starting&&!item.injuredMatches);if(!player.starting&&starters.length>=11)return game;if(player.starting&&starters.length<=7)return game;return{...game,players:game.players.map((item)=>item.id===playerId?{...item,starting:!item.starting}:item)};}
export function toggleJobOffers(game:GameState):GameState{if(game.managerStatus!=="employed")return game;const acceptingJobOffers=!game.acceptingJobOffers;return{...game,acceptingJobOffers,jobOffers:acceptingJobOffers?game.jobOffers:[],news:[{id:`offer-preference-${game.date}`,date:game.date,category:"carreira",title:acceptingJobOffers?"Empresário aberto a propostas":"Empresário bloqueia abordagens",body:acceptingJobOffers?"Projetos compatíveis poderão chegar até você.":"Você seguirá focado no clube atual e não receberá propostas diretas.",unread:true},...game.news]};}

export function applyForJob(game:GameState,vacancyId:string):GameState{const vacancy=game.vacancies.find((item)=>item.id===vacancyId);if(!vacancy)return game;const club=clubById(game,vacancy.clubId);if(game.managerStatus==="unemployed"&&club.id===game.userClubId)return{...game,vacancies:game.vacancies.filter((item)=>item.id!==vacancyId),news:[{id:`job-former-${game.date}-${club.id}`,date:game.date,category:"carreira",title:`${club.name} seguirá outro caminho`,body:"A diretoria não reabriu a negociação após o fim do seu trabalho. Procure um novo projeto.",unread:true},...game.news]};if(game.managerReputation+8<vacancy.minimumReputation)return{...game,news:[{id:`job-no-${game.date}-${club.id}`,date:game.date,category:"carreira",title:`${club.name} escolhe outro treinador`,body:"Sua reputação ainda não corresponde à exigência da vaga.",unread:true},...game.news],vacancies:game.vacancies.filter((item)=>item.id!==vacancyId)};const offer=makeManagerOffer(game,vacancy);return{...game,jobOffers:[offer,...game.jobOffers.filter((item)=>item.clubId!==club.id)],vacancies:game.vacancies.map((item)=>item.id===vacancyId?{...item,status:"offered"}:item),news:[{id:`job-yes-${game.date}-${club.id}`,date:game.date,category:"carreira",title:`${club.name} apresenta uma proposta`,body:"A diretoria quer você no comando. A decisão é sua.",unread:true},...game.news]};}
export function acceptJob(game:GameState,offerId:string):GameState{const offer=game.jobOffers.find((item)=>item.id===offerId);if(!offer)return game;const club=clubById(game,offer.clubId);const records=game.managerRecord.map((record,index)=>index===game.managerRecord.length-1&&!record.toSeason?{...record,toSeason:game.season}:record);const next={...game,userClubId:club.id,managerStatus:"employed" as const,managerContract:{clubId:club.id,weeklySalary:offer.weeklySalary,expiresSeason:game.season+offer.contractYears,releaseClause:Math.round(offer.weeklySalary*52*1.4)},managerRecord:[...records,{clubId:club.id,fromSeason:game.season,matches:0,wins:0,trophies:0}],balance:club.balance,transferBudget:club.transferBudget,weeklyIncome:Math.round(club.reputation**2*165),weeklyExpenses:Math.round(club.reputation**2*128),boardConfidence:66,reputation:club.reputation,jobOffers:[],vacancies:game.vacancies.filter((item)=>item.clubId!==club.id),lastFive:[],news:[{id:`job-start-${game.date}-${club.id}`,date:game.date,category:"carreira",title:`Novo desafio: ${club.name}`,body:`Você assume o clube na ${leagueById(game,club.divisionId).name}. ${offer.releaseClausePaid?`O novo clube quitou a multa de ${formatMoney(offer.releaseClausePaid)}. `:""}Seu contrato vai até ${game.season+offer.contractYears}.`,unread:true},...game.news]} as GameState;next.standings=refreshUserStandings(next);next.date=nextUserFixture(next)?.date??next.date;return next;}
export function resignJob(game:GameState):GameState{if(game.managerStatus==="unemployed")return game;const resigned={...game,managerStatus:"unemployed" as const};return{...resigned,vacancies:[{id:`resign-${game.date}-${game.userClubId}`,clubId:game.userClubId,openedAt:game.date,minimumReputation:35,status:"open"},...game.vacancies],jobOffers:game.vacancies.filter((job)=>job.minimumReputation<=game.managerReputation).slice(0,2).map((job)=>makeManagerOffer(resigned,job)),news:[{id:`resign-news-${game.date}`,date:game.date,category:"carreira",title:"Você deixou o cargo",body:"Sua carreira continua. Consulte as vagas e propostas para continuar a carreira em outro clube.",unread:true},...game.news]};}

export function formatMoney(value:number){if(Math.abs(value)>=1_000_000)return`R$ ${(value/1_000_000).toLocaleString("pt-BR",{maximumFractionDigits:1})} mi`;if(Math.abs(value)>=1_000)return`R$ ${(value/1_000).toLocaleString("pt-BR",{maximumFractionDigits:0})} mil`;return`R$ ${value.toLocaleString("pt-BR")}`;}
export function formatGameDate(value:string,long=false){const date=new Date(`${value}T12:00:00Z`);return new Intl.DateTimeFormat("pt-BR",long?{weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"}:{weekday:"short",day:"2-digit",month:"short",timeZone:"UTC"}).format(date).replace(".","");}
function randomStartingClub(clubs: Club[], managerName: string, careerName: string) {
  const random=seededRandom(`first-club-${managerName}-${careerName}-${Date.now()}`);
  return clubs[Math.floor(random()*clubs.length)]??clubs[0]!;
}

export function getAvailableClubs(){return makeClubs();}
