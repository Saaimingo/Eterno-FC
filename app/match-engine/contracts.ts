export const MATCH_ENGINE_VERSION = "0.2.0-mp2";

export const TECHNICAL_ATTRIBUTE_KEYS = [
  "corners",
  "crossing",
  "dribbling",
  "finishing",
  "firstTouch",
  "freeKick",
  "heading",
  "longShots",
  "longThrows",
  "marking",
  "passing",
  "penalties",
  "tackling",
  "technique",
] as const;

export const MENTAL_ATTRIBUTE_KEYS = [
  "aggression",
  "anticipation",
  "bravery",
  "composure",
  "concentration",
  "decisions",
  "determination",
  "flair",
  "leadership",
  "offBall",
  "positioning",
  "teamwork",
  "vision",
  "workRate",
] as const;

export const PHYSICAL_ATTRIBUTE_KEYS = [
  "acceleration",
  "agility",
  "balance",
  "jumpingReach",
  "naturalFitness",
  "pace",
  "stamina",
  "strength",
] as const;

export const GOALKEEPER_ATTRIBUTE_KEYS = [
  "aerialReach",
  "commandOfArea",
  "communication",
  "eccentricity",
  "handling",
  "kicking",
  "oneOnOnes",
  "reflexes",
  "rushingOut",
  "punching",
  "throwing",
] as const;

export const PLAYER_ATTRIBUTE_KEYS = [
  ...TECHNICAL_ATTRIBUTE_KEYS,
  ...MENTAL_ATTRIBUTE_KEYS,
  ...PHYSICAL_ATTRIBUTE_KEYS,
  ...GOALKEEPER_ATTRIBUTE_KEYS,
] as const;

export const CORE_ATTRIBUTE_KEYS = [
  "passing",
  "technique",
  "vision",
  "decisions",
  "firstTouch",
  "offBall",
  "positioning",
  "anticipation",
  "finishing",
  "tackling",
  "composure",
  "stamina",
] as const;

export type TechnicalAttribute = (typeof TECHNICAL_ATTRIBUTE_KEYS)[number];
export type MentalAttribute = (typeof MENTAL_ATTRIBUTE_KEYS)[number];
export type PhysicalAttribute = (typeof PHYSICAL_ATTRIBUTE_KEYS)[number];
export type GoalkeeperAttribute = (typeof GOALKEEPER_ATTRIBUTE_KEYS)[number];
export type PlayerAttribute = (typeof PLAYER_ATTRIBUTE_KEYS)[number];
export type PlayerAttributes = Readonly<Record<PlayerAttribute, number>>;
export type CoreAttribute = (typeof CORE_ATTRIBUTE_KEYS)[number];
export type CoreAttributes = Readonly<Record<CoreAttribute, number>>;

export type Foot = "left" | "right";

export type FootProfile = Readonly<{
  left: number;
  right: number;
  avoidsWeakFoot: boolean;
}>;

export type BodyProfile = Readonly<{
  heightCm: number;
  massKg: number;
}>;

export type MatchPosition =
  | "GK"
  | "RB"
  | "CB"
  | "LB"
  | "DM"
  | "CM"
  | "AM"
  | "RW"
  | "LW"
  | "ST";

export type MatchPlayer = Readonly<{
  id: string;
  teamId: string;
  name: string;
  position: MatchPosition;
  attributes: PlayerAttributes;
  feet: FootProfile;
  body: BodyProfile;
  condition: number;
}>;

export type TacticalPlan = Readonly<{
  formation: string;
  mentality: "defensive" | "balanced" | "attacking";
  risk: number;
  tempo: number;
}>;

export type TeamSnapshot = Readonly<{
  id: string;
  name: string;
  players: readonly MatchPlayer[];
  tactics: TacticalPlan;
}>;

export type MatchContext = Readonly<{
  matchId: string;
  competitionId: string;
  seed: string;
  homeAdvantage: number;
  possessionsPerPeriod: number;
  importance: number;
}>;

export type MatchInput = Readonly<{
  context: MatchContext;
  home: TeamSnapshot;
  away: TeamSnapshot;
}>;

export type MatchPeriod = 1 | 2;

export type PossessionPhase =
  | "restart"
  | "buildup"
  | "progression"
  | "creation"
  | "danger"
  | "transition";

export const MATCH_EVENT_TYPES = [
  "kickoff",
  "possession_start",
  "pass_attempt",
  "pass_completed",
  "pass_failed",
  "interception",
  "dribble_attempt",
  "tackle",
  "dribble_won",
  "cross_attempt",
  "cross_completed",
  "cross_failed",
  "goalkeeper_claim",
  "goalkeeper_punch",
  "aerial_duel",
  "shot",
  "save",
  "goal",
  "period_end",
  "match_end",
] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];
export type Score = readonly [number, number];
export type PitchPoint = Readonly<{ x: number; y: number }>;

export type EventAudit = Readonly<{
  probability?: number;
  roll?: number;
  components?: Readonly<Record<string, number>>;
  details?: Readonly<Record<string, string | number | boolean>>;
}>;

export type CanonicalMatchEvent = Readonly<{
  eventId: string;
  matchId: string;
  sequence: number;
  clockMs: number;
  period: MatchPeriod;
  type: MatchEventType;
  teamId: string | null;
  actorId?: string;
  targetId?: string;
  opponentIds: readonly string[];
  phase?: PossessionPhase;
  origin?: PitchPoint;
  destination?: PitchPoint;
  outcome?: string;
  scoreBefore: Score;
  scoreAfter: Score;
  tags: readonly string[];
  causes: readonly string[];
  rngTraceId?: string;
  audit?: EventAudit;
}>;

export type RngTrace = Readonly<{
  traceId: string;
  index: number;
  label: string;
  value: number;
}>;

export type PlayerMatchState = Readonly<{
  playerId: string;
  fatigue: number;
}>;

export type MatchState = Readonly<{
  engineVersion: string;
  status: "ready" | "playing" | "finished";
  period: MatchPeriod;
  clockMs: number;
  score: Score;
  possessionTeamId: string | null;
  players: readonly PlayerMatchState[];
}>;

export type TeamStatistics = Readonly<{
  teamId: string;
  possessions: number;
  possessionPercentage: number;
  passesAttempted: number;
  passesCompleted: number;
  interceptions: number;
  dribblesAttempted: number;
  dribblesWon: number;
  tacklesAttempted: number;
  tacklesWon: number;
  crossesAttempted: number;
  crossesCompleted: number;
  aerialDuels: number;
  aerialDuelsWon: number;
  goalkeeperClaims: number;
  goalkeeperPunches: number;
  shots: number;
  shotsOnTarget: number;
  headedShots: number;
  saves: number;
  goals: number;
}>;

export type MatchStatistics = Readonly<{
  home: TeamStatistics;
  away: TeamStatistics;
}>;

export type MatchResult = Readonly<{
  engineVersion: string;
  input: MatchInput;
  finalState: MatchState;
  events: readonly CanonicalMatchEvent[];
  rngTraces: readonly RngTrace[];
  statistics: MatchStatistics;
}>;

function assertRange(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} deve estar entre ${minimum} e ${maximum}.`);
  }
}

export function validateTeamSnapshot(team: TeamSnapshot) {
  if (!team.id || !team.name) throw new Error("Equipe sem identidade válida.");
  if (team.players.length !== 11) throw new Error(`${team.name} deve ter exatamente 11 jogadores.`);
  if (team.players.filter((player) => player.position === "GK").length !== 1) {
    throw new Error(`${team.name} deve ter exatamente um goleiro.`);
  }

  const playerIds = new Set<string>();
  for (const player of team.players) {
    if (!player.id || !player.name) throw new Error(`Jogador inválido em ${team.name}.`);
    if (player.teamId !== team.id) throw new Error(`${player.name} está associado à equipe errada.`);
    if (playerIds.has(player.id)) throw new Error(`Jogador duplicado: ${player.id}.`);
    playerIds.add(player.id);
    assertRange(player.condition, 0, 100, `Condição de ${player.name}`);
    assertRange(player.feet.left, 0, 1_000, `Pé esquerdo de ${player.name}`);
    assertRange(player.feet.right, 0, 1_000, `Pé direito de ${player.name}`);
    if (Math.max(player.feet.left, player.feet.right) < 100) {
      throw new Error(`${player.name} precisa ter ao menos um pé utilizável.`);
    }
    assertRange(player.body.heightCm, 145, 220, `Altura de ${player.name}`);
    assertRange(player.body.massKg, 45, 130, `Massa de ${player.name}`);
    for (const attribute of PLAYER_ATTRIBUTE_KEYS) {
      assertRange(player.attributes[attribute], 1, 100, `${attribute} de ${player.name}`);
    }
  }

  assertRange(team.tactics.risk, 0, 100, `Risco tático de ${team.name}`);
  assertRange(team.tactics.tempo, 0, 100, `Ritmo de ${team.name}`);
}

export function validateMatchInput(input: MatchInput) {
  if (!input.context.matchId || !input.context.competitionId || !input.context.seed) {
    throw new Error("Contexto de partida incompleto.");
  }
  if (input.home.id === input.away.id) throw new Error("Mandante e visitante devem ser equipes distintas.");
  assertRange(input.context.homeAdvantage, 0, 10, "Vantagem de mando");
  assertRange(input.context.possessionsPerPeriod, 1, 100, "Posses por período");
  assertRange(input.context.importance, 0, 100, "Importância da partida");
  validateTeamSnapshot(input.home);
  validateTeamSnapshot(input.away);

  const allPlayerIds = [...input.home.players, ...input.away.players].map((player) => player.id);
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    throw new Error("Os jogadores das duas equipes devem ter IDs únicos.");
  }
}
