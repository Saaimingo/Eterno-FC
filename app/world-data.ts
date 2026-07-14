export type ClubSeed = {
  id: string;
  name: string;
  short: string;
  city: string;
  stadium: string;
  country: "Brasil" | "Espanha" | "Itália" | "Argentina";
  state?: string;
  divisionId: string;
  reputation: number;
  academy: number;
  primary: string;
  secondary: string;
};

export type LeagueSeed = {
  id: string;
  name: string;
  short: string;
  country: ClubSeed["country"];
  level: number;
  promotionTo?: string;
  relegationTo?: string;
  promotionPlaces: number;
  relegationPlaces: number;
};

export const BRAZILIAN_DIVISION_TARGETS = {
  "BRA-A": 20,
  "BRA-B": 20,
  "BRA-C": 20,
  "BRA-D": 96,
} as const;

type RawClub = [name: string, short: string, city: string, state: string | undefined, reputation: number];

const palettes = [
  ["#0b1730", "#b9dc75"], ["#155c3b", "#f7f2de"], ["#b5313b", "#ffffff"], ["#246ea4", "#f2f0e8"],
  ["#5b2f75", "#f0c35a"], ["#b65e22", "#fff0cf"], ["#1d5f73", "#efefea"], ["#222222", "#f4d85a"],
  ["#7a2833", "#e8d7a0"], ["#315e35", "#f2efe3"], ["#23478f", "#ffffff"], ["#8e2528", "#202020"],
] as const;

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildDivision(divisionId: string, country: ClubSeed["country"], raw: RawClub[], offset: number): ClubSeed[] {
  return raw.map(([name, short, city, state, reputation], index) => {
    const palette = palettes[(index + offset) % palettes.length];
    return {
      id: slug(name), name, short, city, state, country, divisionId, reputation,
      academy: Math.max(48, Math.min(94, reputation - 4 + ((index * 7) % 13))),
      stadium: name === "Flamengo" ? "Maracanã" : name === "Cruzeiro" || name === "Atlético Mineiro" ? "Mineirão" : name === "Bahia" ? "Fonte Nova" : name === "Real Madrid" ? "Santiago Bernabéu" : name === "Barcelona" ? "Camp Nou" : name === "Internazionale" || name === "Milan" ? "San Siro" : `Estádio ${city}`,
      primary: palette[0], secondary: palette[1],
    };
  });
}

const brazilianFillerCities = [
  ["AC","Rio Branco"],["AL","Maceió"],["AM","Manaus"],["AP","Macapá"],["BA","Feira de Santana"],["CE","Juazeiro do Norte"],["DF","Brasília"],
  ["ES","Vila Velha"],["GO","Anápolis"],["MA","São Luís"],["MG","Uberlândia"],["MS","Campo Grande"],["MT","Cuiabá"],["PA","Santarém"],
  ["PB","Campina Grande"],["PE","Caruaru"],["PI","Teresina"],["PR","Maringá"],["RJ","Volta Redonda"],["RN","Mossoró"],["RO","Porto Velho"],
  ["RR","Boa Vista"],["RS","Pelotas"],["SC","Blumenau"],["SE","Aracaju"],["SP","Sorocaba"],["TO","Palmas"],
] as const;

const brazilianFillerNames = ["União","Atlético","Ferroviário","Nacional","Operário","Estrela","Aurora","Independente","Esportivo","Pioneiro","Serrano","Real"] as const;

function completeBrazilianDivision(divisionId:keyof typeof BRAZILIAN_DIVISION_TARGETS,raw:RawClub[],offset:number):ClubSeed[]{
  const clubs=buildDivision(divisionId,"Brasil",raw,offset),target=BRAZILIAN_DIVISION_TARGETS[divisionId],level=Number(divisionId.at(-1)==="A"?1:divisionId.at(-1)==="B"?2:divisionId.at(-1)==="C"?3:4);
  return [...clubs,...Array.from({length:Math.max(0,target-clubs.length)},(_,index)=>{const [state,city]=brazilianFillerCities[(index+offset*3)%brazilianFillerCities.length],identity=brazilianFillerNames[(index+offset)%brazilianFillerNames.length],name=`${identity} ${city}`,palette=palettes[(index+offset)%palettes.length],reputation=Math.max(48,82-level*7-(index%8));return{id:`${slug(name)}-${divisionId.toLowerCase()}`,name,short:`${divisionId.at(-1)}${String(index+1).padStart(2,"0")}`,city,state,country:"Brasil",divisionId,reputation,academy:Math.max(44,reputation-5+(index%7)),stadium:`Estádio ${city}`,primary:palette[0],secondary:palette[1]};})];
}

const brazilA: RawClub[] = [
  ["Flamengo","FLA","Rio de Janeiro","RJ",92], ["Palmeiras","PAL","São Paulo","SP",91], ["São Paulo","SAO","São Paulo","SP",87], ["Corinthians","COR","São Paulo","SP",86],
  ["Internacional","INT","Porto Alegre","RS",85], ["Grêmio","GRE","Porto Alegre","RS",85], ["Atlético Mineiro","CAM","Belo Horizonte","MG",87], ["Cruzeiro","CRU","Belo Horizonte","MG",84],
  ["Botafogo","BOT","Rio de Janeiro","RJ",86], ["Fluminense","FLU","Rio de Janeiro","RJ",84], ["Bahia","BAH","Salvador","BA",82], ["Fortaleza","FOR","Fortaleza","CE",82],
];

const brazilB: RawClub[] = [
  ["Santos","SAN","Santos","SP",83], ["Vasco","VAS","Rio de Janeiro","RJ",82], ["Bragantino","RBB","Bragança Paulista","SP",81], ["Athletico Paranaense","CAP","Curitiba","PR",82],
  ["Coritiba","CFC","Curitiba","PR",76], ["Sport","SPT","Recife","PE",78], ["Ceará","CEA","Fortaleza","CE",78], ["Goiás","GOI","Goiânia","GO",76],
  ["Vitória","VIT","Salvador","BA",78], ["Avaí","AVA","Florianópolis","SC",74], ["Chapecoense","CHA","Chapecó","SC",73], ["Criciúma","CRI","Criciúma","SC",75],
];

const brazilC: RawClub[] = [
  ["Náutico","NAU","Recife","PE",72], ["Santa Cruz","SCT","Recife","PE",71], ["Remo","REM","Belém","PA",73], ["Paysandu","PAY","Belém","PA",73],
  ["América de Natal","ARN","Natal","RN",69], ["CSA","CSA","Maceió","AL",69], ["Confiança","CON","Aracaju","SE",68], ["Londrina","LON","Londrina","PR",69],
  ["Figueirense","FIG","Florianópolis","SC",70], ["Ponte Preta","PON","Campinas","SP",72], ["Guarani","GUA","Campinas","SP",71], ["Juventude","JUV","Caxias do Sul","RS",73],
];

const brazilD: RawClub[] = [
  ["Florianópolis","FFC","Florianópolis","SC",66], ["Sergipe","SER","Aracaju","SE",63], ["Itabaiana","ITA","Itabaiana","SE",64], ["Lagarto","LAG","Lagarto","SE",61],
  ["Jacuipense","JAC","Riachão do Jacuípe","BA",64], ["Juazeirense","JUA","Juazeiro","BA",63], ["Barcelona de Ilhéus","BDI","Ilhéus","BA",60], ["Joinville","JEC","Joinville","SC",66],
  ["Marcílio Dias","MAR","Itajaí","SC",63], ["Brasil de Pelotas","BRS","Pelotas","RS",65], ["Caxias","CAX","Caxias do Sul","RS",67], ["Ferroviária","FER","Araraquara","SP",68],
];

const spainA: RawClub[] = [
  ["Real Madrid","RMA","Madrid",undefined,94], ["Barcelona","BAR","Barcelona",undefined,93], ["Atlético de Madrid","ATM","Madrid",undefined,89], ["Athletic Bilbao","ATH","Bilbao",undefined,84],
  ["Sevilla","SEV","Sevilha",undefined,83], ["Valencia","VAL","Valência",undefined,82], ["Villarreal","VIL","Villarreal",undefined,84], ["Real Sociedad","RSO","San Sebastián",undefined,84],
  ["Real Betis","BET","Sevilha",undefined,82], ["Girona","GIR","Girona",undefined,82], ["Celta de Vigo","CEL","Vigo",undefined,78], ["Espanyol","ESP","Barcelona",undefined,77],
];

const spainB: RawClub[] = [
  ["Deportivo La Coruña","DEP","A Coruña",undefined,74], ["Real Zaragoza","ZAR","Zaragoza",undefined,74], ["Málaga","MAL","Málaga",undefined,72], ["Valladolid","VAD","Valladolid",undefined,75],
  ["Eibar","EIB","Eibar",undefined,73], ["Almería","ALM","Almería",undefined,74], ["Sporting Gijón","SGI","Gijón",undefined,72], ["Racing Santander","RAC","Santander",undefined,71],
  ["Granada","GRA","Granada",undefined,73], ["Cádiz","CAD","Cádiz",undefined,72], ["Elche","ELC","Elche",undefined,73], ["Levante","LEV","Valência",undefined,74],
];

const italyA: RawClub[] = [
  ["Internazionale","INTM","Milão",undefined,91], ["Milan","MIL","Milão",undefined,89], ["Juventus","JUVT","Turim",undefined,90], ["Napoli","NAP","Nápoles",undefined,88],
  ["Roma","ROM","Roma",undefined,86], ["Lazio","LAZ","Roma",undefined,84], ["Atalanta","ATA","Bérgamo",undefined,87], ["Fiorentina","FIO","Florença",undefined,83],
  ["Bologna","BOL","Bolonha",undefined,82], ["Torino","TOR","Turim",undefined,79], ["Parma","PAR","Parma",undefined,76], ["Udinese","UDI","Udine",undefined,76],
];

const italyB: RawClub[] = [
  ["Palermo","PALM","Palermo",undefined,73], ["Sampdoria","SAM","Gênova",undefined,74], ["Bari","BAR","Bari",undefined,71], ["Spezia","SPE","La Spezia",undefined,72],
  ["Pisa","PIS","Pisa",undefined,72], ["Venezia","VEN","Veneza",undefined,74], ["Brescia","BRE","Brescia",undefined,71], ["Modena","MOD","Módena",undefined,70],
  ["Cesena","CES","Cesena",undefined,69], ["Reggiana","REG","Reggio Emilia",undefined,69], ["Empoli","EMP","Empoli",undefined,75], ["Monza","MNZ","Monza",undefined,75],
];

const argentinaA: RawClub[] = [
  ["River Plate","RIV","Buenos Aires",undefined,88], ["Boca Juniors","BOC","Buenos Aires",undefined,88], ["Racing Club","RACG","Avellaneda",undefined,83], ["Independiente","IND","Avellaneda",undefined,82],
  ["San Lorenzo","SLO","Buenos Aires",undefined,80], ["Vélez Sarsfield","VEL","Buenos Aires",undefined,81], ["Estudiantes","EST","La Plata",undefined,82], ["Rosario Central","ROS","Rosário",undefined,80],
  ["Newell's Old Boys","NOB","Rosário",undefined,78], ["Talleres","TAL","Córdoba",undefined,81], ["Lanús","LAN","Lanús",undefined,79], ["Defensa y Justicia","DYJ","Florencio Varela",undefined,79],
];

export const LEAGUE_SEEDS: LeagueSeed[] = [
  { id:"BRA-A", name:"Brasileirão Série A", short:"Série A", country:"Brasil", level:1, relegationTo:"BRA-B", promotionPlaces:0, relegationPlaces:3 },
  { id:"BRA-B", name:"Brasileirão Série B", short:"Série B", country:"Brasil", level:2, promotionTo:"BRA-A", relegationTo:"BRA-C", promotionPlaces:3, relegationPlaces:3 },
  { id:"BRA-C", name:"Brasileirão Série C", short:"Série C", country:"Brasil", level:3, promotionTo:"BRA-B", relegationTo:"BRA-D", promotionPlaces:3, relegationPlaces:3 },
  { id:"BRA-D", name:"Brasileirão Série D", short:"Série D", country:"Brasil", level:4, promotionTo:"BRA-C", promotionPlaces:3, relegationPlaces:0 },
  { id:"ESP-1", name:"Liga Espanhola", short:"La Liga", country:"Espanha", level:1, relegationTo:"ESP-2", promotionPlaces:0, relegationPlaces:3 },
  { id:"ESP-2", name:"Segunda Divisão Espanhola", short:"La Liga 2", country:"Espanha", level:2, promotionTo:"ESP-1", promotionPlaces:3, relegationPlaces:0 },
  { id:"ITA-1", name:"Campeonato Italiano", short:"Serie A", country:"Itália", level:1, relegationTo:"ITA-2", promotionPlaces:0, relegationPlaces:3 },
  { id:"ITA-2", name:"Segunda Divisão Italiana", short:"Serie B", country:"Itália", level:2, promotionTo:"ITA-1", promotionPlaces:3, relegationPlaces:0 },
  { id:"ARG-1", name:"Campeonato Argentino", short:"Liga Argentina", country:"Argentina", level:1, promotionPlaces:0, relegationPlaces:0 },
];

export const CLUB_SEEDS: ClubSeed[] = [
  ...completeBrazilianDivision("BRA-A",brazilA,0), ...completeBrazilianDivision("BRA-B",brazilB,2),
  ...completeBrazilianDivision("BRA-C",brazilC,4), ...completeBrazilianDivision("BRA-D",brazilD,6),
  ...buildDivision("ESP-1","Espanha",spainA,1), ...buildDivision("ESP-2","Espanha",spainB,3),
  ...buildDivision("ITA-1","Itália",italyA,5), ...buildDivision("ITA-2","Itália",italyB,7),
  ...buildDivision("ARG-1","Argentina",argentinaA,9),
];

export const STATE_NAMES: Record<string,string> = {
  SC:"Campeonato Catarinense", BA:"Campeonato Baiano", SE:"Campeonato Sergipano", SP:"Campeonato Paulista",
  RJ:"Campeonato Carioca", RS:"Campeonato Gaúcho", PE:"Campeonato Pernambucano", PA:"Campeonato Paraense",
  PR:"Campeonato Paranaense", CE:"Campeonato Cearense", MG:"Campeonato Mineiro",
};
