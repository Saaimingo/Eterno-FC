import type {
  MatchPlayer,
  PossessionPhase,
  TacticalPlan,
  TeamSnapshot,
} from "./contracts";

export type ProbabilityBreakdown = Readonly<{
  probability: number;
  attack: number;
  defense: number;
  context: number;
}>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function conditionFactor(player: MatchPlayer) {
  return 0.82 + player.condition / 555;
}

function mentalityModifier(tactics: TacticalPlan) {
  if (tactics.mentality === "attacking") return 0.025;
  if (tactics.mentality === "defensive") return -0.02;
  return 0;
}

const PASS_PHASE_MODIFIER: Record<PossessionPhase, number> = {
  restart: 0.1,
  buildup: 0.07,
  progression: 0.01,
  creation: -0.07,
  danger: -0.11,
  transition: -0.04,
};

export function calculatePassProbability(input: {
  passer: MatchPlayer;
  receiver: MatchPlayer;
  defender: MatchPlayer;
  phase: PossessionPhase;
  tactics: TacticalPlan;
  homeAdvantage: number;
}): ProbabilityBreakdown {
  const { passer, receiver, defender, phase, tactics, homeAdvantage } = input;
  const attack = (
    passer.attributes.passing * 0.32
    + passer.attributes.technique * 0.18
    + passer.attributes.vision * 0.18
    + passer.attributes.decisions * 0.16
    + receiver.attributes.firstTouch * 0.09
    + receiver.attributes.offBall * 0.07
  ) * conditionFactor(passer);
  const defense = (
    defender.attributes.positioning * 0.42
    + defender.attributes.anticipation * 0.34
    + defender.attributes.tackling * 0.24
  ) * conditionFactor(defender);
  const context = PASS_PHASE_MODIFIER[phase]
    - (tactics.risk - 50) / 650
    - (tactics.tempo - 50) / 900
    + mentalityModifier(tactics)
    + homeAdvantage / 500;
  const probability = clamp(0.74 + (attack - defense) / 190 + context, 0.18, 0.94);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateShotOnTargetProbability(input: {
  shooter: MatchPlayer;
  marker: MatchPlayer;
  tactics: TacticalPlan;
  homeAdvantage: number;
}): ProbabilityBreakdown {
  const { shooter, marker, tactics, homeAdvantage } = input;
  const attack = (
    shooter.attributes.finishing * 0.42
    + shooter.attributes.composure * 0.25
    + shooter.attributes.technique * 0.18
    + shooter.attributes.decisions * 0.08
    + shooter.attributes.offBall * 0.07
  ) * conditionFactor(shooter);
  const defense = (
    marker.attributes.positioning * 0.45
    + marker.attributes.anticipation * 0.3
    + marker.attributes.tackling * 0.25
  ) * conditionFactor(marker);
  const context = mentalityModifier(tactics) + homeAdvantage / 600;
  const probability = clamp(0.47 + (attack - defense) / 215 + context, 0.2, 0.79);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateGoalProbability(input: {
  shooter: MatchPlayer;
  goalkeeper: MatchPlayer;
  homeAdvantage: number;
}): ProbabilityBreakdown {
  const { shooter, goalkeeper, homeAdvantage } = input;
  const attack = (
    shooter.attributes.finishing * 0.46
    + shooter.attributes.composure * 0.27
    + shooter.attributes.technique * 0.17
    + shooter.attributes.offBall * 0.1
  ) * conditionFactor(shooter);
  const defense = (
    goalkeeper.attributes.positioning * 0.34
    + goalkeeper.attributes.anticipation * 0.3
    + goalkeeper.attributes.composure * 0.2
    + goalkeeper.attributes.technique * 0.16
  ) * conditionFactor(goalkeeper);
  const context = homeAdvantage / 700;
  const probability = clamp(0.3 + (attack - defense) / 180 + context, 0.07, 0.62);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateTeamControl(team: TeamSnapshot) {
  const outfieldPlayers = team.players.filter((player) => player.position !== "GK");
  const total = outfieldPlayers.reduce((sum, player) => sum
    + player.attributes.passing * 0.28
    + player.attributes.technique * 0.2
    + player.attributes.decisions * 0.2
    + player.attributes.vision * 0.14
    + player.attributes.positioning * 0.1
    + player.attributes.stamina * 0.08, 0);
  return total / outfieldPlayers.length;
}
