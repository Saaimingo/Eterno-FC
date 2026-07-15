import { clamp, hashSeed, seededRandom } from "./domain/random";
import type {
  Competition,
  Fixture,
  GameState,
  Player,
  Position,
  ShadowMatchComparison,
} from "./domain/types";
import {
  MATCH_ENGINE_VERSION,
  PLAYER_ATTRIBUTE_KEYS,
  defaultRoleForPosition,
  scheduleMatchInterventions,
  simulateMatch,
  validateMatchInput,
  type IndividualInstructions,
  type MatchInput,
  type MatchIntervention,
  type MatchPlayer,
  type MatchPosition,
  type MatchResult,
  type PlayerAttribute,
  type PlayerAttributes as EnginePlayerAttributes,
  type PlayerRole,
  type PlayerTrait,
  type RoleAssignment,
  type TacticalPlan,
  type TacticalChangeIntervention,
  type SubstitutionIntervention,
  type TeamSnapshot,
} from "./match-engine";

export const LIVE_TACTICAL_PRESETS = Object.freeze({
  protect: Object.freeze({
    label: "Fechar a casa",
    summary: "Bloco baixo, menos risco e saída em contra-ataque.",
    changes: Object.freeze({ mentality: "defensive", risk: 34, tempo: 43, width: 46, defensiveLine: 36, pressingLine: 40, pressingIntensity: 43, passingStyle: "direct", attackingFocus: "balanced", transitionStyle: "counter", creativeFreedom: 38 }),
  }),
  balance: Object.freeze({
    label: "Reequilibrar",
    summary: "Recupera distâncias e circulação sem abandonar o ataque.",
    changes: Object.freeze({ mentality: "balanced", risk: 50, tempo: 52, width: 52, defensiveLine: 50, pressingLine: 52, pressingIntensity: 52, passingStyle: "mixed", attackingFocus: "balanced", transitionStyle: "hold", creativeFreedom: 50 }),
  }),
  press: Object.freeze({
    label: "Pressão total",
    summary: "Linha alta, ritmo forte e mais gente atacando.",
    changes: Object.freeze({ mentality: "attacking", risk: 72, tempo: 69, width: 57, defensiveLine: 66, pressingLine: 70, pressingIntensity: 76, passingStyle: "mixed", attackingFocus: "center", transitionStyle: "balanced", creativeFreedom: 66 }),
  }),
  flanks: Object.freeze({
    label: "Explorar os lados",
    summary: "Abre o campo e procura laterais e pontas.",
    changes: Object.freeze({ risk: 60, tempo: 61, width: 74, pressingLine: 58, pressingIntensity: 58, passingStyle: "mixed", attackingFocus: "flanks", transitionStyle: "balanced", creativeFreedom: 58 }),
  }),
} as const satisfies Readonly<Record<string, Readonly<{ label: string; summary: string; changes: Readonly<Partial<TacticalPlan>> }>>>);

export type LiveTacticalPreset = keyof typeof LIVE_TACTICAL_PRESETS;

const POSITION_MAP: Readonly<Record<Position, MatchPosition>> = Object.freeze({
  GOL: "GK",
  LD: "RB",
  LE: "LB",
  ZAG: "CB",
  VOL: "DM",
  MC: "CM",
  MEI: "AM",
  PE: "LW",
  PD: "RW",
  ATA: "ST",
});

const AGGRESSION_BY_TEMPERAMENT: Readonly<Record<Player["temperament"], number>> = Object.freeze({
  "Fair play": 34,
  Cordeirinho: 28,
  Cavalheiro: 40,
  Caneleiro: 66,
  Caceteiro: 80,
  Sarrafeiro: 91,
});

const clampAttribute = (value: number) => Math.round(clamp(value, 1, 100));
const average = (...values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function competitionImportance(competition: Competition | undefined, fixture: Fixture) {
  if (!competition) return 50;
  const decisiveStage = /final|semifinal|quartas|oitavas/i.test(fixture.stage);
  if (competition.type === "continental") return decisiveStage ? 92 : 78;
  if (competition.type === "cup") return decisiveStage ? 88 : 70;
  if (competition.type === "state") return decisiveStage ? 74 : 54;
  return fixture.round > 30 ? 72 : 58;
}

export function selectVNextMatchPlayers(game: GameState, teamId: string) {
  const available = game.players
    .filter((player) => player.clubId === teamId && !player.academy && !player.injuredMatches)
    .sort((left, right) => Number(right.starting) - Number(left.starting) || right.rating - left.rating || left.id.localeCompare(right.id));
  const goalkeeper = available.find((player) => player.position === "GOL");
  if (!goalkeeper) throw new Error(`A equipe ${teamId} não possui goleiro disponível para o adaptador.`);
  const outfield = available.filter((player) => player.id !== goalkeeper.id && player.position !== "GOL").slice(0, 10);
  if (outfield.length !== 10) throw new Error(`A equipe ${teamId} não possui dez jogadores de linha disponíveis.`);
  const starters = [goalkeeper, ...outfield];
  const starterIds = new Set(starters.map((player) => player.id));
  const bench = available.filter((player) => !starterIds.has(player.id)).slice(0, 7);
  return Object.freeze({ starters: Object.freeze(starters), bench: Object.freeze(bench) });
}

function engineAttributes(player: Player): EnginePlayerAttributes {
  const source = player.attributes;
  const rating = player.rating;
  const aggression = AGGRESSION_BY_TEMPERAMENT[player.temperament];
  const goalkeeper = player.position === "GOL";
  const values: Record<PlayerAttribute, number> = {
    corners: average(source.passing, source.vision, source.composure) - 5,
    crossing: average(source.passing, source.vision, source.dribbling) + (["LD", "LE", "PE", "PD"].includes(player.position) ? 5 : -4),
    dribbling: source.dribbling,
    finishing: source.finishing,
    firstTouch: average(source.dribbling, source.passing, source.composure),
    freeKick: average(source.passing, source.finishing, source.composure),
    heading: average(source.strength, source.positioning, rating) + (["ZAG", "ATA"].includes(player.position) ? 5 : 0),
    longShots: average(source.finishing, source.vision, source.composure),
    longThrows: average(source.strength, source.passing, rating) - 8,
    marking: average(source.tackling, source.positioning, source.composure),
    passing: source.passing,
    penalties: average(source.finishing, source.composure) + (player.position === "ATA" ? 3 : 0),
    tackling: source.tackling,
    technique: average(source.passing, source.dribbling, source.composure),
    aggression,
    anticipation: average(source.positioning, source.vision, source.composure),
    bravery: average(source.strength, aggression, rating),
    composure: source.composure,
    concentration: average(source.positioning, source.composure, rating),
    decisions: average(source.vision, source.composure, source.passing),
    determination: average(player.morale, source.stamina, rating),
    flair: average(source.dribbling, source.vision, source.finishing),
    leadership: average(player.age > 29 ? rating + 8 : rating - 2, source.composure, player.morale),
    offBall: average(source.positioning, source.pace, source.vision),
    positioning: source.positioning,
    teamwork: average(source.passing, source.stamina, player.morale),
    vision: source.vision,
    workRate: average(source.stamina, player.fitness, aggression),
    acceleration: average(source.pace, source.dribbling),
    agility: average(source.pace, source.dribbling, source.composure),
    balance: average(source.strength, source.dribbling, source.composure),
    jumpingReach: average(source.strength, source.positioning, rating) + (["GOL", "ZAG", "ATA"].includes(player.position) ? 7 : -3),
    naturalFitness: average(source.stamina, player.fitness, rating),
    pace: source.pace,
    stamina: source.stamina,
    strength: source.strength,
    aerialReach: goalkeeper ? average(source.reflexes, source.handling, source.positioning) : 6,
    commandOfArea: goalkeeper ? average(source.handling, source.positioning, source.composure) : 6,
    communication: goalkeeper ? average(source.composure, source.positioning, rating) : 7,
    eccentricity: goalkeeper ? clamp(105 - source.composure, 10, 80) : 5,
    handling: goalkeeper ? source.handling : 5,
    kicking: goalkeeper ? average(source.passing, source.strength, source.composure) : 5,
    oneOnOnes: goalkeeper ? average(source.reflexes, source.positioning, source.composure) : 5,
    reflexes: goalkeeper ? source.reflexes : 5,
    rushingOut: goalkeeper ? average(source.pace, source.positioning, source.composure) : 5,
    punching: goalkeeper ? average(source.reflexes, source.strength, source.handling) : 5,
    throwing: goalkeeper ? average(source.handling, source.strength, source.passing) : 5,
  };
  return Object.freeze(Object.fromEntries(PLAYER_ATTRIBUTE_KEYS.map((attribute) => [
    attribute,
    clampAttribute(values[attribute]),
  ]))) as unknown as EnginePlayerAttributes;
}

function footProfile(player: Player) {
  const naturalLeft = player.position === "LE" || player.position === "PE";
  const naturalRight = player.position === "LD" || player.position === "PD";
  const variant = hashSeed(player.id);
  const twoFooted = variant % 13 === 0;
  const leftDominant = naturalLeft || (!naturalRight && variant % 2 === 0);
  return Object.freeze(twoFooted
    ? { left: 790, right: 800, avoidsWeakFoot: false }
    : leftDominant
      ? { left: 850, right: 570 + variant % 80, avoidsWeakFoot: true }
      : { left: 570 + variant % 80, right: 850, avoidsWeakFoot: true });
}

function bodyProfile(player: Player) {
  const variant = hashSeed(`${player.id}-body`);
  const base = player.position === "GOL"
    ? [190, 84]
    : player.position === "ZAG"
      ? [185, 80]
      : player.position === "ATA"
        ? [181, 78]
        : [176, 71];
  return Object.freeze({
    heightCm: base[0] + variant % 7 - 3,
    massKg: base[1] + Math.floor(variant / 7) % 7 - 3,
  });
}

function positionFamiliarity(position: MatchPosition) {
  const related: Partial<Record<MatchPosition, number>> = { [position]: 100 };
  if (position === "RB") Object.assign(related, { LB: 45, RW: 62, CB: 40 });
  if (position === "LB") Object.assign(related, { RB: 45, LW: 62, CB: 40 });
  if (position === "CB") Object.assign(related, { DM: 58, RB: 34, LB: 34 });
  if (position === "DM") Object.assign(related, { CM: 78, CB: 58, AM: 35 });
  if (position === "CM") Object.assign(related, { DM: 76, AM: 72 });
  if (position === "AM") Object.assign(related, { CM: 74, ST: 58, RW: 52, LW: 52 });
  if (position === "RW") Object.assign(related, { LW: 68, AM: 58, RB: 45, ST: 42 });
  if (position === "LW") Object.assign(related, { RW: 68, AM: 58, LB: 45, ST: 42 });
  if (position === "ST") Object.assign(related, { AM: 57, RW: 38, LW: 38 });
  return Object.freeze(related);
}

function playerTraits(player: Player, position: MatchPosition): readonly PlayerTrait[] {
  const attributes = player.attributes;
  const traits = new Set<PlayerTrait>();
  if (position === "GK") traits.add("plays_out_of_pressure");
  if (position === "RB" || position === "LB") traits.add("keeps_width");
  if ((position === "RB" || position === "LB") && attributes.passing >= player.rating) traits.add("early_crosses");
  if (position === "CB") traits.add(attributes.passing >= player.rating ? "plays_out_of_pressure" : "stays_back");
  if (position === "DM") traits.add("stays_back");
  if (position === "CM" && attributes.vision >= player.rating) traits.add("dictates_tempo");
  if (position === "AM" && attributes.vision >= player.rating) traits.add("tries_killer_balls");
  if ((position === "RW" || position === "LW") && attributes.dribbling >= player.rating) traits.add("runs_with_ball");
  if (position === "LW") traits.add("cuts_inside");
  if (position === "ST") traits.add(attributes.composure >= attributes.strength ? "places_shots" : "shoots_with_power");
  if (AGGRESSION_BY_TEMPERAMENT[player.temperament] >= 75) traits.add("presses_aggressively");
  if (AGGRESSION_BY_TEMPERAMENT[player.temperament] <= 40) traits.add("avoids_risky_tackles");
  return Object.freeze([...traits]);
}

function adaptPlayer(player: Player, teamId: string): MatchPlayer {
  const position = POSITION_MAP[player.position];
  return Object.freeze({
    id: player.id,
    teamId,
    name: player.name,
    position,
    attributes: engineAttributes(player),
    feet: footProfile(player),
    body: bodyProfile(player),
    condition: clamp(player.fitness, 0, 100),
    positionFamiliarity: positionFamiliarity(position),
    traits: playerTraits(player, position),
  });
}

function roleFor(player: MatchPlayer): PlayerRole {
  if (player.position === "CB" && player.attributes.passing >= player.attributes.marking) return "ball_playing_defender";
  if ((player.position === "RB" || player.position === "LB") && player.attributes.crossing >= 72) return "attacking_wingback";
  if (player.position === "DM" && player.attributes.passing >= player.attributes.tackling) return "deep_lying_playmaker";
  if (player.position === "AM" && player.attributes.finishing >= player.attributes.passing) return "shadow_striker";
  if ((player.position === "RW" || player.position === "LW") && player.attributes.finishing > player.attributes.crossing) return "inside_forward";
  if (player.position === "ST" && player.attributes.heading > player.attributes.pace + 6) return "target_forward";
  if (player.position === "ST" && player.attributes.finishing > player.attributes.passing + 14) return "poacher";
  return defaultRoleForPosition(player.position);
}

function instructionsFor(position: MatchPosition, role: PlayerRole, intensity: GameState["intensity"]): IndividualInstructions {
  const wide = ["RB", "LB", "RW", "LW"].includes(position);
  const attacker = ["AM", "RW", "LW", "ST"].includes(position);
  return Object.freeze({
    risk: ["advanced_playmaker", "inside_forward", "shadow_striker"].includes(role) ? 64 : 48,
    dribble: ["wide_winger", "inside_forward", "advanced_playmaker"].includes(role) ? 66 : 42,
    cross: ["support_fullback", "attacking_wingback", "wide_winger"].includes(role) ? 68 : 40,
    shoot: ["poacher", "mobile_forward", "inside_forward", "shadow_striker"].includes(role) ? 68 : 43,
    pressing: intensity === "Alta" ? 72 : intensity === "Baixa" ? 38 : attacker ? 56 : 50,
    width: wide && role !== "inside_forward" ? "wide" : role === "inside_forward" ? "narrow" : "balanced",
    movement: ["central_defender", "ball_winning_midfielder", "deep_lying_playmaker"].includes(role)
      ? "hold"
      : attacker || role === "support_fullback" || role === "attacking_wingback"
        ? "get_forward"
        : "balanced",
  });
}

function tacticalPlan(game: GameState, teamId: string): TacticalPlan {
  const managed = teamId === game.userClubId;
  const formation = managed ? game.formation : "4-2-3-1";
  const mentality = managed
    ? game.mentality === "Ofensiva" ? "attacking" : game.mentality === "Defensiva" ? "defensive" : "balanced"
    : "balanced";
  const intensity = managed ? game.intensity : "Normal";
  return Object.freeze({
    formation,
    mentality,
    risk: mentality === "attacking" ? 65 : mentality === "defensive" ? 38 : 50,
    tempo: intensity === "Alta" ? 68 : intensity === "Baixa" ? 38 : 52,
    width: formation === "3-5-2" ? 58 : formation === "4-3-3" ? 62 : 50,
    defensiveLine: mentality === "attacking" ? 62 : mentality === "defensive" ? 40 : 50,
    pressingLine: intensity === "Alta" ? 68 : intensity === "Baixa" ? 40 : 52,
    pressingIntensity: intensity === "Alta" ? 72 : intensity === "Baixa" ? 36 : 52,
    passingStyle: mentality === "defensive" ? "direct" : formation === "4-3-3" ? "short" : "mixed",
    attackingFocus: formation === "4-3-3" ? "flanks" : formation === "4-2-3-1" ? "center" : "balanced",
    transitionStyle: mentality === "defensive" ? "counter" : mentality === "attacking" ? "balanced" : "hold",
    creativeFreedom: mentality === "attacking" ? 62 : 50,
  });
}

function adaptTeam(game: GameState, teamId: string): TeamSnapshot {
  const club = game.clubs.find((candidate) => candidate.id === teamId);
  if (!club) throw new Error(`Clube desconhecido no adaptador: ${teamId}.`);
  const selected = selectVNextMatchPlayers(game, teamId);
  const players = Object.freeze(selected.starters.map((player) => adaptPlayer(player, teamId)));
  const bench = Object.freeze(selected.bench.map((player) => adaptPlayer(player, teamId)));
  const assignments: readonly RoleAssignment[] = Object.freeze(players.map((player, index) => {
    const role = roleFor(player);
    return Object.freeze({
      playerId: player.id,
      position: player.position,
      role,
      tacticalFamiliarity: clampAttribute(72 + game.players.find((candidate) => candidate.id === player.id)!.morale * 0.2 + index % 4),
      instructions: instructionsFor(player.position, role, teamId === game.userClubId ? game.intensity : "Normal"),
    });
  }));
  return Object.freeze({
    id: teamId,
    name: club.name,
    players,
    bench,
    assignments,
    tactics: tacticalPlan(game, teamId),
  });
}

export function createVNextMatchInput(
  game: GameState,
  fixture: Fixture,
  interventions: readonly MatchIntervention[] = [],
): MatchInput {
  const random = seededRandom(`${fixture.id}-referee`);
  const competition = game.competitions.find((candidate) => candidate.id === fixture.competitionId);
  const singleLegKnockout = Boolean(
    competition
      && (competition.type === "cup" || competition.type === "continental")
      && fixture.stage !== "Fase de grupos"
      && !fixture.tieId,
  );
  const baseInput = Object.freeze({
    context: Object.freeze({
      matchId: fixture.id,
      competitionId: fixture.competitionId,
      seed: `${fixture.id}-${game.formation}-${game.mentality}-${game.intensity}-vnext`,
      homeAdvantage: 3,
      possessionsPerPeriod: 45,
      importance: competitionImportance(competition, fixture),
      rules: Object.freeze({
        maxSubstitutions: 5,
        secondYellowDismissal: true,
        offsideEnabled: true,
        stoppageTimeEnabled: true,
        drawResolution: singleLegKnockout ? "extra_time_and_penalties" : "allow_draw",
      }),
      referee: Object.freeze({
        strictness: 42 + Math.round(random() * 22),
        cardTendency: 40 + Math.round(random() * 24),
        penaltyTendency: 42 + Math.round(random() * 18),
        stoppageTendency: 45 + Math.round(random() * 18),
      }),
    }),
    home: adaptTeam(game, fixture.homeId),
    away: adaptTeam(game, fixture.awayId),
    interventions: Object.freeze([]),
  }) satisfies MatchInput;
  const input = scheduleMatchInterventions(baseInput, interventions);
  validateMatchInput(input);
  return input;
}

type LiveTeamState = Readonly<{
  activePlayerIds: readonly string[];
  benchPlayerIds: readonly string[];
  assignments: ReadonlyMap<string, RoleAssignment>;
  substitutionsUsed: number;
}>;

function liveTeamState(input: MatchInput, teamId: string): LiveTeamState {
  const team = input.home.id === teamId ? input.home : input.away.id === teamId ? input.away : undefined;
  if (!team) throw new Error("O clube treinado não participa desta partida.");
  const active = team.players.map((player) => player.id);
  const bench = team.bench.map((player) => player.id);
  const assignments = new Map(team.assignments.map((assignment) => [assignment.playerId, assignment]));
  let substitutionsUsed = 0;
  const ordered = [...input.interventions].map((intervention, index) => ({ intervention, index }))
    .sort((left, right) => left.intervention.clockMs - right.intervention.clockMs || left.index - right.index);
  for (const { intervention } of ordered) {
    if (intervention.teamId !== teamId) continue;
    if (intervention.type === "substitution") {
      const activeIndex = active.indexOf(intervention.playerOutId);
      const benchIndex = bench.indexOf(intervention.playerInId);
      if (activeIndex < 0 || benchIndex < 0) continue;
      active[activeIndex] = intervention.playerInId;
      bench.splice(benchIndex, 1);
      assignments.delete(intervention.playerOutId);
      assignments.set(intervention.playerInId, intervention.assignment);
      substitutionsUsed += 1;
    } else {
      intervention.assignmentChanges.forEach((assignment) => assignments.set(assignment.playerId, assignment));
    }
  }
  return Object.freeze({
    activePlayerIds: Object.freeze(active),
    benchPlayerIds: Object.freeze(bench),
    assignments,
    substitutionsUsed,
  });
}

function managedTeam(input: MatchInput, game: GameState) {
  if (input.home.id === game.userClubId) return input.home;
  if (input.away.id === game.userClubId) return input.away;
  throw new Error("O clube do treinador não participa desta partida.");
}

function interventionClock(input: MatchInput, revealedMinute: number) {
  const maximumMinute = input.context.rules.drawResolution === "extra_time_and_penalties" ? 119 : 89;
  return Math.floor(clamp(revealedMinute, 1, maximumMinute)) * 60_000 + 1_000;
}

export function selectLiveVNextPlayers(
  game: GameState,
  fixture: Fixture,
  interventions: readonly MatchIntervention[] = [],
) {
  const input = createVNextMatchInput(game, fixture, interventions);
  const state = liveTeamState(input, game.userClubId);
  return Object.freeze({
    activePlayerIds: state.activePlayerIds,
    benchPlayerIds: state.benchPlayerIds,
    substitutionsUsed: state.substitutionsUsed,
    substitutionLimit: input.context.rules.maxSubstitutions,
  });
}

export function createLiveTacticalIntervention(
  game: GameState,
  fixture: Fixture,
  interventions: readonly MatchIntervention[],
  revealedMinute: number,
  preset: LiveTacticalPreset,
): TacticalChangeIntervention {
  const input = createVNextMatchInput(game, fixture, interventions);
  managedTeam(input, game);
  const intervention = Object.freeze({
    id: `live-${fixture.id}-${interventions.length + 1}-${preset}`,
    type: "tactical_change",
    teamId: game.userClubId,
    clockMs: interventionClock(input, revealedMinute),
    changes: Object.freeze({ ...LIVE_TACTICAL_PRESETS[preset].changes }),
    assignmentChanges: Object.freeze([]),
  }) satisfies TacticalChangeIntervention;
  createVNextMatchInput(game, fixture, [...interventions, intervention]);
  return intervention;
}

export function createLiveSubstitutionIntervention(
  game: GameState,
  fixture: Fixture,
  interventions: readonly MatchIntervention[],
  revealedMinute: number,
  playerOutId: string,
  playerInId: string,
): SubstitutionIntervention {
  const input = createVNextMatchInput(game, fixture, interventions);
  const team = managedTeam(input, game);
  const state = liveTeamState(input, game.userClubId);
  if (state.substitutionsUsed >= input.context.rules.maxSubstitutions) throw new Error("O limite de substituições já foi utilizado.");
  if (!state.activePlayerIds.includes(playerOutId)) throw new Error("O jogador escolhido para sair não está mais em campo.");
  if (!state.benchPlayerIds.includes(playerInId)) throw new Error("O jogador escolhido para entrar não está mais no banco.");
  const outgoing = state.assignments.get(playerOutId);
  const incoming = team.bench.find((player) => player.id === playerInId);
  if (!outgoing || !incoming) throw new Error("Não foi possível montar a nova função da substituição.");
  const positionalFamiliarity = incoming.positionFamiliarity[outgoing.position] ?? 0;
  const assignment = Object.freeze({
    ...outgoing,
    playerId: playerInId,
    tacticalFamiliarity: Math.round(clamp(50 + positionalFamiliarity * 0.35, 45, 88)),
    instructions: Object.freeze({ ...outgoing.instructions }),
  });
  const intervention = Object.freeze({
    id: `live-${fixture.id}-${interventions.length + 1}-sub`,
    type: "substitution",
    teamId: game.userClubId,
    clockMs: interventionClock(input, revealedMinute),
    playerOutId,
    playerInId,
    assignment,
  }) satisfies SubstitutionIntervention;
  createVNextMatchInput(game, fixture, [...interventions, intervention]);
  return intervention;
}

export function simulateVNextFixture(
  game: GameState,
  fixture: Fixture,
  interventions: readonly MatchIntervention[] = [],
): MatchResult {
  return simulateMatch(createVNextMatchInput(game, fixture, interventions));
}

function outcome(score: readonly [number, number]) {
  return score[0] > score[1] ? "home" : score[0] < score[1] ? "away" : "draw";
}

function fingerprint(result: MatchResult) {
  const source = result.events.map((event) => [
    event.type,
    event.teamId ?? "-",
    event.actorId ?? "-",
    event.outcome ?? "-",
    event.scoreAfter.join(":"),
  ].join("|")).join(";");
  return hashSeed(source).toString(16).padStart(8, "0");
}

export function compareShadowMatch(
  legacyScore: readonly [number, number],
  legacyShots: readonly [number, number],
  legacyHomePossession: number,
  candidate: MatchResult,
): ShadowMatchComparison {
  const candidateScore = candidate.finalState.score;
  return Object.freeze({
    status: "ready",
    engineVersion: candidate.engineVersion,
    legacyScore,
    candidateScore,
    outcomeAgreement: outcome(legacyScore) === outcome(candidateScore),
    goalDelta: candidateScore[0] + candidateScore[1] - legacyScore[0] - legacyScore[1],
    shotDelta: Object.freeze([
      candidate.statistics.home.shots - legacyShots[0],
      candidate.statistics.away.shots - legacyShots[1],
    ]) as readonly [number, number],
    possessionDelta: Number((candidate.statistics.home.possessionPercentage - legacyHomePossession).toFixed(1)),
    candidateEventCount: candidate.events.length,
    candidateFingerprint: fingerprint(candidate),
  });
}

export function runShadowMatch(
  game: GameState,
  fixture: Fixture,
  legacyScore: readonly [number, number],
  legacyShots: readonly [number, number],
  legacyHomePossession: number,
): ShadowMatchComparison {
  try {
    return compareShadowMatch(
      legacyScore,
      legacyShots,
      legacyHomePossession,
      simulateVNextFixture(game, fixture),
    );
  } catch (error) {
    return Object.freeze({
      status: "failed",
      engineVersion: MATCH_ENGINE_VERSION,
      legacyScore,
      failureReason: error instanceof Error ? error.message : "Falha desconhecida no motor candidato.",
    });
  }
}
