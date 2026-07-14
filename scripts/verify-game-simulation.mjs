import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const bundle=process.argv[2];
if(!bundle)throw new Error("Bundle da simulação não informado.");
const game=await import(`${pathToFileURL(bundle).href}?run=${Date.now()}`);
let career=game.createNewGame("Adilson Simon","vitoria","Teste de longo prazo");

function assertNoClubDateConflicts(state){
  const seen=new Set();
  for(const fixture of state.fixtures)for(const clubId of [fixture.homeId,fixture.awayId]){const key=`${clubId}:${fixture.date}`;assert.equal(seen.has(key),false,`Conflito de calendário em ${key}`);seen.add(key);}
}

function assertUniqueFixtureIds(state){assert.equal(new Set(state.fixtures.map((fixture)=>fixture.id)).size,state.fixtures.length,"Existem IDs de partidas duplicados.");}

assert.equal(career.competitions.find((competition)=>competition.id==="BRA-B")?.participantIds.length,20);
assert.equal(career.fixtures.filter((fixture)=>fixture.competitionId==="BRA-C"&&fixture.stage==="Primeira fase").length,190);
assert.equal(career.competitions.find((competition)=>competition.id==="BRA-D")?.participantIds.length,96);
assert.equal(career.competitions.find((competition)=>competition.id==="COPA-BR")?.participantIds.length,126);
assert.equal(career.competitions.find((competition)=>competition.id==="SUPER-BR")?.participantIds.length,2);
assert.equal(career.fixtures.filter((fixture)=>fixture.competitionId==="SUPER-BR").length,1);
assert.equal(career.fixtures.filter((fixture)=>fixture.competitionId==="CHAMPIONS").length,8);
assert.equal(career.competitions.filter((competition)=>competition.type==="state").length,27);
assertNoClubDateConflicts(career);
assertUniqueFixtureIds(career);

const regionalExpectations={
  "REGIONAL-NE":{participants:20,groups:4,groupFixtures:50},
  "REGIONAL-NCO":{participants:24,groups:4,groupFixtures:60},
  "REGIONAL-SSE":{participants:12,groups:2,groupFixtures:36},
};
for(const [competitionId,expected] of Object.entries(regionalExpectations)){
  const competition=career.competitions.find((item)=>item.id===competitionId);
  assert.equal(competition?.participantIds.length,expected.participants);
  assert.equal(Object.keys(competition?.groups??{}).length,expected.groups);
  assert.equal(career.fixtures.filter((fixture)=>fixture.competitionId===competitionId&&fixture.stage==="Fase de grupos").length,expected.groupFixtures);
}

for(let index=0;index<4;index+=1){
  const previous=new Map(career.clubs.map((club)=>[club.id,club.divisionId]));
  career=game.startNextSeason(career);
  assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-A").length,20);
  assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-B").length,20);
  assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-D").length,96);
  assert.equal(career.clubs.filter((club)=>previous.get(club.id)==="BRA-B"&&club.divisionId==="BRA-A").length,4);
  assert.equal(career.clubs.filter((club)=>previous.get(club.id)==="BRA-C"&&club.divisionId==="BRA-B").length,4);
  assert.equal(career.clubs.filter((club)=>previous.get(club.id)==="BRA-D"&&club.divisionId==="BRA-C").length,6);
  const serieCOpeningCount=career.fixtures.filter((fixture)=>fixture.competitionId==="BRA-C"&&fixture.stage==="Primeira fase").length;
  assert.equal(serieCOpeningCount,career.season===2027?276:364);
  const superCup=career.competitions.find((competition)=>competition.id==="SUPER-BR");
  assert.equal(superCup?.participantIds.length,2);
  assert.equal(new Set(superCup?.participantIds).size,2);
  assertNoClubDateConflicts(career);
  assertUniqueFixtureIds(career);
}

assert.equal(career.season,2030);
assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-C").length,28);
console.log(`Simulação integrada aprovada até ${career.season}.`);
