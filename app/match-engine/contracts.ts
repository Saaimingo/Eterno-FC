export const MATCH_ENGINE_VERSION = "0.1.0-mp1";

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

export type CoreAttribute = (typeof CORE_ATTRIBUTE_KEYS)[number];
export type CoreAttributes = Readonly<Record<CoreAttribute, number>>;

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
  attributes: CoreAttributes;
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
  shots: number;
  shotsOnTarget: number;
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
    for (const attribute of CORE_ATTRIBUTE_KEYS) {
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
  validateTeamSnapshot(input.home);
  validateTeamSnapshot(input.away);

  const allPlayerIds = [...input.home.players, ...input.away.players].map((player) => player.id);
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    throw new Error("Os jogadores das duas equipes devem ter IDs únicos.");
  }
}
