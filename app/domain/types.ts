import type { ClubSeed, LeagueSeed } from "../world-data";

export type Position = "GOL" | "LD" | "LE" | "ZAG" | "VOL" | "MC" | "MEI" | "PE" | "PD" | "ATA";
export type Mentality = "Defensiva" | "Equilibrada" | "Ofensiva";
export type Intensity = "Baixa" | "Normal" | "Alta";
export type CompetitionType = "league" | "cup" | "state" | "continental";

export type Club = ClubSeed & {
  balance: number;
  transferBudget: number;
  badge?: string;
};

export type League = LeagueSeed;

export type PlayerAttributes = {
  pace: number;
  stamina: number;
  strength: number;
  passing: number;
  vision: number;
  dribbling: number;
  finishing: number;
  tackling: number;
  positioning: number;
  composure: number;
  reflexes: number;
  handling: number;
};

export type Player = {
  id: string;
  clubId: string;
  name: string;
  position: Position;
  age: number;
  rating: number;
  potential: number;
  attributes: PlayerAttributes;
  fitness: number;
  morale: number;
  value: number;
  wage: number;
  contract: number;
  goals: number;
  assists: number;
  appearances: number;
  starting: boolean;
  academy: boolean;
  nationality: string;
  temperament: "Fair play" | "Cordeirinho" | "Cavalheiro" | "Caneleiro" | "Caceteiro" | "Sarrafeiro";
  listed: boolean;
  injuredMatches?: number;
};

export type Fixture = {
  id: string;
  tieId?: string;
  leg?: 1 | 2;
  competitionId: string;
  stage: string;
  round: number;
  date: string;
  homeId: string;
  awayId: string;
  played: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerId?: string;
  decision?: "regulation" | "extra_time" | "penalties";
  shootoutHomeGoals?: number;
  shootoutAwayGoals?: number;
};

export type Standing = {
  clubId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type Competition = {
  id: string;
  name: string;
  short: string;
  type: CompetitionType;
  country: string;
  season: number;
  participantIds: string[];
  currentStage: string;
  pendingByes: string[];
  nextRoundDate: string;
  championId?: string;
  promotedClubIds?: string[];
  formatId?: "brazil-cup-2026" | "regional-cup-2026";
  entryWaves?: Record<string,string[]>;
  groups?: Record<string,string[]>;
  groupStage?: string;
  groupAdvancing?: number;
  prizeMoney?: { champion: number; runnerUp: number };
  complete: boolean;
  divisionId?: string;
  stateCode?: string;
};

export type NewsItem = {
  id: string;
  date: string;
  category: "clube" | "elenco" | "mercado" | "base" | "competição" | "carreira";
  title: string;
  body: string;
  unread: boolean;
};

export type SeasonRecord = {
  season: number;
  club: string;
  division: string;
  champion: string;
  userPosition: number;
  userPoints: number;
  outcome: string;
};

export type TransferEvent = {
  id: string;
  date: string;
  playerId: string;
  playerName: string;
  fromClubId: string;
  toClubId: string;
  fee: number;
  kind: "compra" | "empréstimo" | "livre";
};

export type MarketOffer = { id: string; playerId: string; fromClubId: string; askingPrice: number; expiresAt: string };
export type IncomingBid = { id: string; playerId: string; fromClubId: string; fee: number; expiresAt: string };
export type JobVacancy = { id: string; clubId: string; openedAt: string; minimumReputation: number; status: "open" | "offered" };
export type ManagerContract = { clubId: string; weeklySalary: number; expiresSeason: number; releaseClause: number };
export type ManagerOffer = JobVacancy & { weeklySalary: number; contractYears: number; releaseClausePaid: number };
export type ManagerClubRecord = { clubId: string; fromSeason: number; toSeason?: number; matches: number; wins: number; trophies: number };
export type BoardObjective = { id: "promotion" | "position" | "finances" | "academy"; label: string; weight: number; status: "em andamento" | "cumprida" | "não cumprida" };

export type GameState = {
  version: 2;
  id: string;
  careerName: string;
  managerName: string;
  userClubId: string;
  managerStatus: "employed" | "unemployed";
  acceptingJobOffers: boolean;
  managerContract: ManagerContract;
  managerReputation: number;
  managerPoints: number;
  managerRecord: ManagerClubRecord[];
  season: number;
  date: string;
  round: number;
  clubs: Club[];
  leagues: League[];
  competitions: Competition[];
  players: Player[];
  fixtures: Fixture[];
  standings: Standing[];
  news: NewsItem[];
  history: SeasonRecord[];
  transferEvents: TransferEvent[];
  marketOffers: MarketOffer[];
  incomingBids: IncomingBid[];
  vacancies: JobVacancy[];
  jobOffers: ManagerOffer[];
  formation: "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2";
  mentality: Mentality;
  intensity: Intensity;
  balance: number;
  transferBudget: number;
  weeklyIncome: number;
  weeklyExpenses: number;
  boardConfidence: number;
  boardObjectives: BoardObjective[];
  academyLevel: number;
  reputation: number;
  lastFive: Array<"V" | "E" | "D">;
  matchesManaged: number;
  lastSavedAt: string;
};

export type MatchEventType = "goal" | "chance" | "card" | "injury" | "comment" | "foul" | "offside" | "save" | "corner" | "substitution" | "penalty" | "rebound" | "shootout";
export type PitchCoordinate = { x: number; y: number };
export type MatchEvent = {
  id?: string;
  sequence?: number;
  minute: number;
  minuteLabel?: string;
  type: MatchEventType;
  teamId: string;
  playerId?: string;
  targetPlayerId?: string;
  assistPlayerId?: string;
  text: string;
  detail?: string;
  outcome?: string;
  origin?: PitchCoordinate;
  destination?: PitchCoordinate;
  scoreAfter?: readonly [number, number];
};
export type MatchPhase = {
  start: number;
  end: number;
  teamId: string;
  zone: "saída" | "meio" | "ataque";
  carrier: number;
  carrierId?: string;
  eventId?: string;
  ball?: PitchCoordinate;
};
export type ShadowMatchComparison = {
  status: "ready" | "failed";
  engineVersion: string;
  legacyScore: readonly [number, number];
  candidateScore?: readonly [number, number];
  outcomeAgreement?: boolean;
  goalDelta?: number;
  shotDelta?: readonly [number, number];
  possessionDelta?: number;
  candidateEventCount?: number;
  candidateFingerprint?: string;
  failureReason?: string;
};

export type MatchPlan = {
  fixtureId: string;
  engineSource?: "legacy" | "vnext";
  engineVersion?: string;
  homeGoals: number;
  awayGoals: number;
  durationMinutes: 90 | 120;
  decisionMethod?: "draw" | "regulation" | "extra_time" | "penalties";
  winnerTeamId?: string;
  shootoutScore?: readonly [number, number];
  events: readonly MatchEvent[];
  phases: readonly MatchPhase[];
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeCorners?: number;
  awayCorners?: number;
  homeCards?: number;
  awayCards?: number;
  shadow?: ShadowMatchComparison;
};
