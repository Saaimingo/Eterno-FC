export const MATCH_ENGINE_VERSION = "0.7.0-mp7";

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

export const MATCH_POSITIONS = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"] as const;
export type MatchPosition = (typeof MATCH_POSITIONS)[number];

export const PLAYER_TRAITS = [
  "dictates_tempo",
  "cuts_inside",
  "keeps_width",
  "runs_with_ball",
  "avoids_dribbling",
  "tries_killer_balls",
  "prefers_simple_passes",
  "tries_long_passes",
  "switches_play",
  "early_crosses",
  "arrives_late",
  "stays_back",
  "first_time_shots",
  "places_shots",
  "shoots_with_power",
  "avoids_weak_foot",
  "presses_aggressively",
  "avoids_risky_tackles",
  "plays_out_of_pressure",
  "plays_with_back_to_goal",
  "seeks_one_twos",
] as const;

export type PlayerTrait = (typeof PLAYER_TRAITS)[number];
export type PositionFamiliarity = Readonly<Partial<Record<MatchPosition, number>>>;

export const PLAYER_ROLES = [
  "goalkeeper",
  "central_defender",
  "ball_playing_defender",
  "libero",
  "defensive_fullback",
  "support_fullback",
  "attacking_wingback",
  "ball_winning_midfielder",
  "deep_lying_playmaker",
  "box_to_box_midfielder",
  "advanced_playmaker",
  "shadow_striker",
  "wide_winger",
  "inside_forward",
  "second_striker",
  "mobile_forward",
  "target_forward",
  "poacher",
] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export type IndividualInstructions = Readonly<{
  risk: number;
  dribble: number;
  cross: number;
  shoot: number;
  pressing: number;
  width: "narrow" | "balanced" | "wide";
  movement: "hold" | "balanced" | "get_forward";
}>;

export type RoleAssignment = Readonly<{
  playerId: string;
  position: MatchPosition;
  role: PlayerRole;
  tacticalFamiliarity: number;
  instructions: IndividualInstructions;
}>;

export type MatchPlayer = Readonly<{
  id: string;
  teamId: string;
  name: string;
  position: MatchPosition;
  attributes: PlayerAttributes;
  feet: FootProfile;
  body: BodyProfile;
  condition: number;
  positionFamiliarity: PositionFamiliarity;
  traits: readonly PlayerTrait[];
}>;

export type TacticalPlan = Readonly<{
  formation: string;
  mentality: "defensive" | "balanced" | "attacking";
  risk: number;
  tempo: number;
  width: number;
  defensiveLine: number;
  pressingLine: number;
  pressingIntensity: number;
  passingStyle: "short" | "mixed" | "direct";
  attackingFocus: "balanced" | "center" | "flanks";
  transitionStyle: "hold" | "balanced" | "counter";
  creativeFreedom: number;
}>;

export type TeamSnapshot = Readonly<{
  id: string;
  name: string;
  players: readonly MatchPlayer[];
  bench: readonly MatchPlayer[];
  assignments: readonly RoleAssignment[];
  tactics: TacticalPlan;
}>;

export type SubstitutionIntervention = Readonly<{
  id: string;
  type: "substitution";
  teamId: string;
  clockMs: number;
  playerOutId: string;
  playerInId: string;
  assignment: RoleAssignment;
}>;

export type TacticalChangeIntervention = Readonly<{
  id: string;
  type: "tactical_change";
  teamId: string;
  clockMs: number;
  changes: Readonly<Partial<TacticalPlan>>;
  assignmentChanges: readonly RoleAssignment[];
}>;

export type MatchIntervention = SubstitutionIntervention | TacticalChangeIntervention;

export type MatchRules = Readonly<{
  maxSubstitutions: number;
  secondYellowDismissal: boolean;
  offsideEnabled: boolean;
  stoppageTimeEnabled: boolean;
  drawResolution: "allow_draw" | "extra_time_and_penalties";
}>;

export type RefereeProfile = Readonly<{
  strictness: number;
  cardTendency: number;
  penaltyTendency: number;
  stoppageTendency: number;
}>;

export type MatchContext = Readonly<{
  matchId: string;
  competitionId: string;
  seed: string;
  homeAdvantage: number;
  possessionsPerPeriod: number;
  importance: number;
  rules: MatchRules;
  referee: RefereeProfile;
}>;

export type MatchInput = Readonly<{
  context: MatchContext;
  home: TeamSnapshot;
  away: TeamSnapshot;
  interventions: readonly MatchIntervention[];
}>;

export type MatchPeriod = 1 | 2 | 3 | 4 | 5;

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
  "foul",
  "yellow_card",
  "red_card",
  "offside",
  "free_kick",
  "corner",
  "penalty_kick",
  "shot",
  "save",
  "rebound",
  "goal",
  "substitution",
  "tactical_change",
  "stoppage_time",
  "period_end",
  "shootout_kick",
  "shootout_end",
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
  status: "active" | "substituted" | "sent_off" | "bench";
  yellowCards: number;
  position: MatchPosition;
  role: PlayerRole;
  enteredAtMs?: number;
  exitedAtMs?: number;
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
  foulsCommitted: number;
  foulsSuffered: number;
  yellowCards: number;
  redCards: number;
  offsides: number;
  freeKicks: number;
  corners: number;
  penalties: number;
  rebounds: number;
  reboundsWon: number;
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
  decision: MatchDecision;
  events: readonly CanonicalMatchEvent[];
  rngTraces: readonly RngTrace[];
  statistics: MatchStatistics;
}>;

export type MatchDecision = Readonly<{
  method: "draw" | "regulation" | "extra_time" | "penalties";
  winnerTeamId: string | null;
  regulationScore: Score;
  finalScore: Score;
  shootoutScore?: Score;
}>;

function assertRange(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} deve estar entre ${minimum} e ${maximum}.`);
  }
}

const PLAYER_TRAIT_SET = new Set<string>(PLAYER_TRAITS);
const PLAYER_ROLE_SET = new Set<string>(PLAYER_ROLES);
const MATCH_POSITION_SET = new Set<string>(MATCH_POSITIONS);
const REGULATION_DURATION_MS = 5_400_000;
const MAX_MATCH_DURATION_MS = 7_200_000;

function validatePlayer(player: MatchPlayer, team: TeamSnapshot, playerIds: Set<string>) {
  if (!player.id || !player.name) throw new Error(`Jogador inválido em ${team.name}.`);
  if (player.teamId !== team.id) throw new Error(`${player.name} está associado à equipe errada.`);
  if (playerIds.has(player.id)) throw new Error(`Jogador duplicado: ${player.id}.`);
  playerIds.add(player.id);
  if (!MATCH_POSITION_SET.has(player.position)) throw new Error(`Posição natural inválida de ${player.name}.`);
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
  if (new Set(player.traits).size !== player.traits.length) {
    throw new Error(`${player.name} possui traços duplicados.`);
  }
  for (const trait of player.traits) {
    if (!PLAYER_TRAIT_SET.has(trait)) throw new Error(`Traço desconhecido em ${player.name}: ${trait}.`);
  }
  const familiarities = Object.entries(player.positionFamiliarity);
  if (familiarities.length === 0 || player.positionFamiliarity[player.position] === undefined) {
    throw new Error(`${player.name} precisa ter familiaridade declarada em sua posição natural.`);
  }
  for (const [position, familiarity] of familiarities) {
    if (!MATCH_POSITION_SET.has(position)) throw new Error(`Zona de familiaridade desconhecida de ${player.name}: ${position}.`);
    assertRange(familiarity ?? Number.NaN, 0, 100, `Familiaridade ${position} de ${player.name}`);
  }
}

function validateInstructions(instructions: IndividualInstructions, label: string) {
  assertRange(instructions.risk, 0, 100, `Risco individual de ${label}`);
  assertRange(instructions.dribble, 0, 100, `Drible individual de ${label}`);
  assertRange(instructions.cross, 0, 100, `Cruzamento individual de ${label}`);
  assertRange(instructions.shoot, 0, 100, `Finalização individual de ${label}`);
  assertRange(instructions.pressing, 0, 100, `Pressão individual de ${label}`);
  if (!["narrow", "balanced", "wide"].includes(instructions.width)) {
    throw new Error(`Largura individual inválida para ${label}.`);
  }
  if (!["hold", "balanced", "get_forward"].includes(instructions.movement)) {
    throw new Error(`Movimento individual inválido para ${label}.`);
  }
}

function validateAssignment(assignment: RoleAssignment, playerIds: Set<string>, label: string) {
  if (!playerIds.has(assignment.playerId)) throw new Error(`Função atribuída a jogador desconhecido em ${label}.`);
  if (!PLAYER_ROLE_SET.has(assignment.role)) throw new Error(`Função desconhecida em ${label}: ${assignment.role}.`);
  if (!MATCH_POSITION_SET.has(assignment.position)) throw new Error(`Posição desconhecida em ${label}: ${assignment.position}.`);
  if ((assignment.position === "GK") !== (assignment.role === "goalkeeper")) {
    throw new Error(`A função de goleiro deve ocupar exclusivamente a posição GK em ${label}.`);
  }
  assertRange(assignment.tacticalFamiliarity, 0, 100, `Familiaridade tática de ${assignment.playerId}`);
  validateInstructions(assignment.instructions, assignment.playerId);
}

export function validateTacticalPlan(tactics: TacticalPlan, label = "equipe") {
  if (!tactics.formation.trim()) throw new Error(`Formação inválida de ${label}.`);
  if (!["defensive", "balanced", "attacking"].includes(tactics.mentality)) {
    throw new Error(`Mentalidade inválida de ${label}.`);
  }
  for (const [name, value] of [
    ["Risco tático", tactics.risk],
    ["Ritmo", tactics.tempo],
    ["Largura", tactics.width],
    ["Linha defensiva", tactics.defensiveLine],
    ["Linha de pressão", tactics.pressingLine],
    ["Intensidade de pressão", tactics.pressingIntensity],
    ["Liberdade criativa", tactics.creativeFreedom],
  ] as const) {
    assertRange(value, 0, 100, `${name} de ${label}`);
  }
  if (!["short", "mixed", "direct"].includes(tactics.passingStyle)) {
    throw new Error(`Estilo de passe inválido de ${label}.`);
  }
  if (!["balanced", "center", "flanks"].includes(tactics.attackingFocus)) {
    throw new Error(`Foco de ataque inválido de ${label}.`);
  }
  if (!["hold", "balanced", "counter"].includes(tactics.transitionStyle)) {
    throw new Error(`Transição inválida de ${label}.`);
  }
}

export function validateTeamSnapshot(team: TeamSnapshot) {
  if (!team.id || !team.name) throw new Error("Equipe sem identidade válida.");
  if (team.players.length !== 11) throw new Error(`${team.name} deve ter exatamente 11 jogadores.`);
  if (team.bench.length > 12) throw new Error(`${team.name} pode relacionar no máximo 12 reservas.`);

  const playerIds = new Set<string>();
  for (const player of [...team.players, ...team.bench]) validatePlayer(player, team, playerIds);

  if (team.assignments.length !== 11) {
    throw new Error(`${team.name} deve ter exatamente 11 atribuições de função.`);
  }
  const activeIds = new Set(team.players.map((player) => player.id));
  const assignedIds = new Set<string>();
  for (const assignment of team.assignments) {
    validateAssignment(assignment, activeIds, team.name);
    if (assignedIds.has(assignment.playerId)) throw new Error(`Função duplicada para ${assignment.playerId}.`);
    assignedIds.add(assignment.playerId);
  }
  if (team.assignments.filter((assignment) => assignment.position === "GK").length !== 1) {
    throw new Error(`${team.name} deve escalar exatamente um goleiro.`);
  }
  validateTacticalPlan(team.tactics, team.name);
}

function validateInterventions(input: MatchInput) {
  const knownTeams = new Map([[input.home.id, input.home], [input.away.id, input.away]]);
  const interventionIds = new Set<string>();
  const runtime = new Map([...knownTeams].map(([teamId, team]) => [teamId, {
    active: new Set(team.players.map((player) => player.id)),
    bench: new Set(team.bench.map((player) => player.id)),
    assignments: new Map(team.assignments.map((assignment) => [assignment.playerId, assignment])),
    tactics: team.tactics,
    substitutions: 0,
  }]));
  const ordered = [...input.interventions].map((intervention, index) => ({ intervention, index }))
    .sort((left, right) => left.intervention.clockMs - right.intervention.clockMs || left.index - right.index);

  for (const { intervention } of ordered) {
    if (!intervention.id || interventionIds.has(intervention.id)) {
      throw new Error(`Intervenção sem ID único: ${intervention.id || "vazio"}.`);
    }
    interventionIds.add(intervention.id);
    const interventionLimit = input.context.rules.drawResolution === "extra_time_and_penalties"
      ? MAX_MATCH_DURATION_MS
      : REGULATION_DURATION_MS;
    assertRange(intervention.clockMs, 1, interventionLimit - 1, `Relógio de ${intervention.id}`);
    const team = knownTeams.get(intervention.teamId);
    const state = runtime.get(intervention.teamId);
    if (!team || !state) throw new Error(`Intervenção ${intervention.id} pertence a equipe desconhecida.`);

    if (intervention.type === "substitution") {
      state.substitutions += 1;
      if (state.substitutions > input.context.rules.maxSubstitutions) {
        throw new Error(`${team.name} excedeu o limite de substituições.`);
      }
      if (!state.active.has(intervention.playerOutId)) {
        throw new Error(`${intervention.playerOutId} não está em campo em ${intervention.id}.`);
      }
      if (!state.bench.has(intervention.playerInId)) {
        throw new Error(`${intervention.playerInId} não está no banco em ${intervention.id}.`);
      }
      if (intervention.assignment.playerId !== intervention.playerInId) {
        throw new Error(`A nova função de ${intervention.id} não pertence ao jogador que entra.`);
      }
      validateAssignment(intervention.assignment, state.bench, team.name);
      state.active.delete(intervention.playerOutId);
      state.bench.delete(intervention.playerInId);
      state.active.add(intervention.playerInId);
      state.assignments.delete(intervention.playerOutId);
      state.assignments.set(intervention.playerInId, intervention.assignment);
    } else {
      if (Object.keys(intervention.changes).length === 0 && intervention.assignmentChanges.length === 0) {
        throw new Error(`Intervenção tática vazia: ${intervention.id}.`);
      }
      state.tactics = Object.freeze({ ...state.tactics, ...intervention.changes });
      validateTacticalPlan(state.tactics, team.name);
      const changedIds = new Set<string>();
      for (const assignment of intervention.assignmentChanges) {
        if (changedIds.has(assignment.playerId)) {
          throw new Error(`Mudança tática duplicada para ${assignment.playerId} em ${intervention.id}.`);
        }
        changedIds.add(assignment.playerId);
        validateAssignment(assignment, state.active, team.name);
        state.assignments.set(assignment.playerId, assignment);
      }
    }

    if (state.assignments.size !== 11
      || [...state.assignments.values()].filter((assignment) => assignment.position === "GK").length !== 1) {
      throw new Error(`${team.name} ficou sem uma escalação válida após ${intervention.id}.`);
    }
  }
}

export function validateMatchInput(input: MatchInput) {
  if (!input.context.matchId || !input.context.competitionId || !input.context.seed) {
    throw new Error("Contexto de partida incompleto.");
  }
  if (input.home.id === input.away.id) throw new Error("Mandante e visitante devem ser equipes distintas.");
  assertRange(input.context.homeAdvantage, 0, 10, "Vantagem de mando");
  assertRange(input.context.possessionsPerPeriod, 1, 100, "Posses por período");
  assertRange(input.context.importance, 0, 100, "Importância da partida");
  assertRange(input.context.rules.maxSubstitutions, 0, 12, "Limite de substituições");
  if (!["allow_draw", "extra_time_and_penalties"].includes(input.context.rules.drawResolution)) {
    throw new Error("Regra de desempate inválida.");
  }
  assertRange(input.context.referee.strictness, 0, 100, "Rigor do árbitro");
  assertRange(input.context.referee.cardTendency, 0, 100, "Tendência de cartões do árbitro");
  assertRange(input.context.referee.penaltyTendency, 0, 100, "Tendência de pênaltis do árbitro");
  assertRange(input.context.referee.stoppageTendency, 0, 100, "Tendência de acréscimos do árbitro");
  validateTeamSnapshot(input.home);
  validateTeamSnapshot(input.away);

  const allPlayerIds = [
    ...input.home.players,
    ...input.home.bench,
    ...input.away.players,
    ...input.away.bench,
  ].map((player) => player.id);
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    throw new Error("Os jogadores das duas equipes devem ter IDs únicos.");
  }
  validateInterventions(input);
}
