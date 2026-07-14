import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const bundle=process.argv[2];
if(!bundle)throw new Error("Bundle da simulação não informado.");
const game=await import(`${pathToFileURL(bundle).href}?run=${Date.now()}`);
let career=game.createNewGame("Adilson Simon","vitoria","Teste de longo prazo");

assert.equal(career.competitions.find((competition)=>competition.id==="BRA-B")?.participantIds.length,20);
assert.equal(career.competitions.find((competition)=>competition.id==="BRA-D")?.participantIds.length,96);
assert.equal(career.competitions.find((competition)=>competition.id==="COPA-BR")?.participantIds.length,126);

for(let index=0;index<4;index+=1){
  const previous=new Map(career.clubs.map((club)=>[club.id,club.divisionId]));
  career=game.startNextSeason(career);
  assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-A").length,20);
  assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-B").length,20);
  assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-D").length,96);
  assert.equal(career.clubs.filter((club)=>previous.get(club.id)==="BRA-B"&&club.divisionId==="BRA-A").length,4);
  assert.equal(career.clubs.filter((club)=>previous.get(club.id)==="BRA-D"&&club.divisionId==="BRA-C").length,6);
}

assert.equal(career.season,2030);
assert.equal(career.clubs.filter((club)=>club.divisionId==="BRA-C").length,28);
console.log(`Simulação integrada aprovada até ${career.season}.`);
