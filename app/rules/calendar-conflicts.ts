type SchedulableFixture = {
  id: string;
  date: string;
  homeId: string;
  awayId: string;
  played: boolean;
};

function nextDate(value: string) {
  const date=new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}

/**
 * Preserva partidas já realizadas e desloca somente compromissos futuros.
 * A ordenação por data e id torna o resultado reproduzível em qualquer tela.
 */
export function resolveClubDateConflicts<T extends SchedulableFixture>(fixtures: readonly T[]): T[] {
  const occupied=new Map<string,Set<string>>();
  const reserve=(clubId:string,date:string)=>{const dates=occupied.get(clubId)??new Set<string>();dates.add(date);occupied.set(clubId,dates);};
  const isOccupied=(clubId:string,date:string)=>occupied.get(clubId)?.has(date)??false;

  fixtures.filter((fixture)=>fixture.played).forEach((fixture)=>{reserve(fixture.homeId,fixture.date);reserve(fixture.awayId,fixture.date);});
  const scheduled=new Map<number,T>();
  fixtures.map((fixture,index)=>({fixture,index})).filter(({fixture})=>!fixture.played).sort((left,right)=>left.fixture.date.localeCompare(right.fixture.date)||left.fixture.id.localeCompare(right.fixture.id)||left.index-right.index).forEach(({fixture,index})=>{
    let date=fixture.date;
    while(isOccupied(fixture.homeId,date)||isOccupied(fixture.awayId,date))date=nextDate(date);
    reserve(fixture.homeId,date);reserve(fixture.awayId,date);scheduled.set(index,date===fixture.date?fixture:{...fixture,date});
  });

  return fixtures.map((fixture,index)=>fixture.played?fixture:scheduled.get(index)??fixture);
}

export function findClubDateConflicts(fixtures: readonly SchedulableFixture[]) {
  const seen=new Set<string>(),conflicts:string[]=[];
  fixtures.forEach((fixture)=>{
    for(const clubId of [fixture.homeId,fixture.awayId]){
      const key=`${clubId}:${fixture.date}`;
      if(seen.has(key))conflicts.push(key);else seen.add(key);
    }
  });
  return conflicts;
}
