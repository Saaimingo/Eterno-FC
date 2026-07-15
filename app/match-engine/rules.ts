import type {
  MatchContext,
  MatchPlayer,
  PossessionPhase,
  RefereeProfile,
  TeamSnapshot,
} from "./contracts";
import { assignmentFor, effectiveFamiliarity } from "./tactics";

export type RuleProbabilityBreakdown = Readonly<{
  probability: number;
  attack: number;
  defense: number;
  context: number;
}>;

export type SanctionProbabilities = Readonly<{
  none: number;
  yellow: number;
  straightRed: number;
  severity: number;
}>;

export type StoppageInputs = Readonly<{
  period: 1 | 2;
  goals: number;
  fouls: number;
  cards: number;
  substitutions: number;
  referee: RefereeProfile;
  randomValue: number;
}>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function teamInstructionPressing(team: TeamSnapshot, player: MatchPlayer) {
  const assignment = assignmentFor(team, player.id);
  return assignment.instructions.pressing * 0.58 + team.tactics.pressingIntensity * 0.42;
}

export class DisciplineTracker {
  readonly #yellowCards = new Map<string, number>();
  readonly #sentOff = new Set<string>();

  constructor(players: readonly MatchPlayer[]) {
    for (const player of players) this.#yellowCards.set(player.id, 0);
  }

  yellowCards(playerId: string) {
    return this.#yellowCards.get(playerId) ?? 0;
  }

  isSentOff(playerId: string) {
    return this.#sentOff.has(playerId);
  }

  issueYellow(playerId: string) {
    if (!this.#yellowCards.has(playerId)) throw new Error(`Disciplina desconhecida para ${playerId}.`);
    const total = this.yellowCards(playerId) + 1;
    this.#yellowCards.set(playerId, total);
    return total;
  }

  sendOff(playerId: string) {
    if (!this.#yellowCards.has(playerId)) throw new Error(`Disciplina desconhecida para ${playerId}.`);
    this.#sentOff.add(playerId);
  }
}

export function calculateFoulProbability(input: {
  defender: MatchPlayer;
  victim: MatchPlayer;
  defendingTeam: TeamSnapshot;
  context: MatchContext;
  phase: PossessionPhase;
  defenderFatigue?: number;
  pressure?: number;
  contestedDribble?: boolean;
}): RuleProbabilityBreakdown {
  const { defender, victim, defendingTeam, context, phase } = input;
  const fatigue = clamp(input.defenderFatigue ?? 0, 0, 100);
  const pressure = clamp(input.pressure ?? 0, 0, 100);
  const pressing = teamInstructionPressing(defendingTeam, defender);
  const traitRisk = defender.traits.includes("presses_aggressively") ? 9
    : defender.traits.includes("avoids_risky_tackles") ? -9
      : 0;
  const attack = (
    defender.attributes.aggression * 0.25
    + pressing * 0.2
    + (100 - defender.attributes.tackling) * 0.2
    + (100 - defender.attributes.decisions) * 0.12
    + fatigue * 0.08
    + victim.attributes.dribbling * 0.07
    + pressure * 0.06
    + traitRisk
  );
  const defense = (
    defender.attributes.tackling * 0.32
    + defender.attributes.decisions * 0.24
    + defender.attributes.composure * 0.16
    + defender.attributes.concentration * 0.15
    + defender.attributes.anticipation * 0.13
  );
  const phaseBase: Record<PossessionPhase, number> = {
    restart: 0.018,
    buildup: 0.04,
    progression: 0.055,
    creation: 0.07,
    danger: 0.115,
    transition: 0.075,
  };
  const contextModifier = (
    (context.referee.strictness - 50) / 850
    + (context.importance - 50) / 2_800
    + (input.contestedDribble ? 0.026 : 0)
  );
  const probability = clamp(
    phaseBase[phase] + (attack - 45) / 650 + (60 - defense) / 900 + contextModifier,
    0.008,
    0.34,
  );
  return Object.freeze({ probability, attack, defense, context: contextModifier });
}

export function calculateSanctionProbabilities(input: {
  defender: MatchPlayer;
  phase: PossessionPhase;
  referee: RefereeProfile;
  defenderFatigue?: number;
  pressure?: number;
  deniedGoalOpportunity?: boolean;
}): SanctionProbabilities {
  const { defender, phase, referee } = input;
  const fatigue = clamp(input.defenderFatigue ?? 0, 0, 100);
  const pressure = clamp(input.pressure ?? 0, 0, 100);
  const traitRisk = defender.traits.includes("presses_aggressively") ? 10
    : defender.traits.includes("avoids_risky_tackles") ? -10
      : 0;
  const severity = clamp(
    defender.attributes.aggression * 0.25
      + (100 - defender.attributes.tackling) * 0.25
      + (100 - defender.attributes.decisions) * 0.15
      + fatigue * 0.09
      + pressure * 0.08
      + (phase === "danger" ? 7 : phase === "transition" ? 5 : 0)
      + (input.deniedGoalOpportunity ? 18 : 0)
      + traitRisk,
    0,
    100,
  );
  const straightRed = clamp(
    0.002 + Math.max(0, severity - 67) / 430 + (referee.cardTendency - 50) / 3_200,
    0.001,
    0.09,
  );
  const yellow = clamp(
    0.085 + severity / 365 + (referee.cardTendency - 50) / 520,
    0.07,
    0.58,
  );
  return Object.freeze({
    none: Math.max(0, 1 - yellow - straightRed),
    yellow,
    straightRed,
    severity,
  });
}

export function calculatePenaltyAwardProbability(input: {
  offender: MatchPlayer;
  referee: RefereeProfile;
  pressure?: number;
}) {
  const pressure = clamp(input.pressure ?? 0, 0, 100);
  return clamp(
    0.105
      + (input.referee.penaltyTendency - 50) / 720
      + (input.referee.strictness - 50) / 1_300
      + (input.offender.attributes.aggression - 50) / 1_800
      + pressure / 4_500,
    0.045,
    0.27,
  );
}

export function calculateOffsideProbability(input: {
  attackingTeam: TeamSnapshot;
  defendingTeam: TeamSnapshot;
  passer: MatchPlayer;
  receiver: MatchPlayer;
  defender: MatchPlayer;
  phase: PossessionPhase;
}): RuleProbabilityBreakdown {
  const { attackingTeam, defendingTeam, passer, receiver, defender, phase } = input;
  const assignment = assignmentFor(attackingTeam, receiver.id);
  const familiarity = effectiveFamiliarity(receiver, assignment);
  const advanced = ["AM", "LW", "RW", "ST"].includes(assignment.position);
  const runnerRisk = assignment.instructions.movement === "get_forward" ? 13
    : assignment.instructions.movement === "hold" ? -10
      : 0;
  const roleRisk = ["poacher", "mobile_forward", "shadow_striker", "inside_forward"].includes(assignment.role) ? 8 : 0;
  const attack = (
    attackingTeam.tactics.risk * 0.18
    + attackingTeam.tactics.tempo * 0.12
    + (attackingTeam.tactics.passingStyle === "direct" ? 12 : attackingTeam.tactics.passingStyle === "short" ? -5 : 0)
    + runnerRisk
    + roleRisk
    + (passer.traits.includes("tries_killer_balls") ? 8 : 0)
  );
  const defense = (
    receiver.attributes.offBall * 0.24
    + receiver.attributes.anticipation * 0.18
    + receiver.attributes.decisions * 0.17
    + receiver.attributes.teamwork * 0.12
    + defender.attributes.positioning * 0.13
    + defender.attributes.anticipation * 0.08
    + familiarity * 0.08
  );
  const context = (defendingTeam.tactics.defensiveLine - 50) / 1_600
    + (phase === "creation" ? 0.022 : phase === "progression" ? 0.011 : -0.01)
    + (advanced ? 0.012 : -0.012);
  const probability = clamp(0.04 + (attack - defense) / 1_000 + context, advanced ? 0.006 : 0.001, 0.13);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateSetPieceDeliveryProbability(input: {
  taker: MatchPlayer;
  marker: MatchPlayer;
  kind: "corner" | "free_kick";
  takerFatigue?: number;
  pressure?: number;
  familiarity?: number;
}): RuleProbabilityBreakdown {
  const { taker, marker, kind } = input;
  const fatigue = clamp(input.takerFatigue ?? 0, 0, 100);
  const pressure = clamp(input.pressure ?? 0, 0, 100);
  const specialty = kind === "corner" ? taker.attributes.corners : taker.attributes.freeKick;
  const attack = (
    specialty * 0.42
    + taker.attributes.crossing * 0.2
    + taker.attributes.technique * 0.16
    + taker.attributes.vision * 0.1
    + taker.attributes.composure * 0.07
    + taker.attributes.decisions * 0.05
    - fatigue * 0.09
    - pressure * 0.035
    - (100 - clamp(input.familiarity ?? 100, 0, 100)) * 0.035
  );
  const defense = (
    marker.attributes.positioning * 0.28
    + marker.attributes.anticipation * 0.24
    + marker.attributes.jumpingReach * 0.16
    + marker.attributes.marking * 0.16
    + marker.attributes.concentration * 0.16
  );
  const context = kind === "corner" ? 0.018 : -0.005;
  const probability = clamp(0.59 + (attack - defense) / 230 + context, 0.23, 0.86);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateReboundProbability(input: {
  attacker: MatchPlayer;
  defender: MatchPlayer;
  goalkeeper: MatchPlayer;
  attackerFatigue?: number;
  defenderFatigue?: number;
}): RuleProbabilityBreakdown {
  const { attacker, defender, goalkeeper } = input;
  const attack = (
    attacker.attributes.anticipation * 0.27
    + attacker.attributes.offBall * 0.23
    + attacker.attributes.acceleration * 0.15
    + attacker.attributes.agility * 0.12
    + attacker.attributes.bravery * 0.11
    + attacker.attributes.composure * 0.12
    - clamp(input.attackerFatigue ?? 0, 0, 100) * 0.08
  );
  const defense = (
    defender.attributes.positioning * 0.24
    + defender.attributes.anticipation * 0.21
    + defender.attributes.concentration * 0.16
    + defender.attributes.acceleration * 0.12
    + goalkeeper.attributes.reflexes * 0.11
    + goalkeeper.attributes.handling * 0.1
    + goalkeeper.attributes.communication * 0.06
    - clamp(input.defenderFatigue ?? 0, 0, 100) * 0.07
  );
  const context = 0;
  const probability = clamp(0.43 + (attack - defense) / 190, 0.16, 0.72);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateStoppageSeconds(input: StoppageInputs) {
  const base = input.period === 1 ? 55 : 125;
  const incidents = input.goals * 18 + input.fouls * 5 + input.cards * 24 + input.substitutions * 22;
  const referee = (input.referee.stoppageTendency - 50) * 1.4;
  const random = clamp(input.randomValue, 0, 1) * (input.period === 1 ? 80 : 125);
  const minimum = input.period === 1 ? 45 : 90;
  const maximum = input.period === 1 ? 300 : 480;
  return Math.round(clamp(base + incidents + referee + random, minimum, maximum) / 15) * 15;
}
