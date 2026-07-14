import type {
  MatchPlayer,
  PossessionPhase,
  TacticalPlan,
  TeamSnapshot,
} from "./contracts";
import { resolveFootUse, type FootUse } from "./feet";

export type ProbabilityBreakdown = Readonly<{
  probability: number;
  attack: number;
  defense: number;
  context: number;
}>;

export type ShotType = "foot" | "header";

type ExecutionContext = Readonly<{
  fatigue?: number;
  pressure?: number;
  foot?: FootUse;
}>;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function conditionFactor(player: MatchPlayer) {
  return 0.84 + player.condition / 625;
}

function mentalityModifier(tactics: TacticalPlan) {
  if (tactics.mentality === "attacking") return 0.025;
  if (tactics.mentality === "defensive") return -0.02;
  return 0;
}

function executionScore(
  player: MatchPlayer,
  rawScore: number,
  context: ExecutionContext,
  usesFoot = true,
) {
  const fatigue = clamp(context.fatigue ?? 0, 0, 100);
  const pressure = clamp(context.pressure ?? 0, 0, 100);
  const composureResistance = 0.35 + player.attributes.composure / 155;
  const fatiguePenalty = fatigue * (1.08 - player.attributes.stamina / 180) * 0.2;
  const pressurePenalty = pressure * (1 - composureResistance) * 0.23;
  const foot = context.foot ?? resolveFootUse(player);
  const footAdjustment = usesFoot ? (foot.proficiency - 70) * 0.16 : 0;
  return rawScore * conditionFactor(player) - fatiguePenalty - pressurePenalty + footAdjustment;
}

function oppositionScore(player: MatchPlayer, rawScore: number, fatigue = 0) {
  const fatiguePenalty = clamp(fatigue, 0, 100) * (1.06 - player.attributes.stamina / 190) * 0.15;
  return rawScore * conditionFactor(player) - fatiguePenalty;
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
  passerFatigue?: number;
  defenderFatigue?: number;
  pressure?: number;
  foot?: FootUse;
}): ProbabilityBreakdown {
  const { passer, receiver, defender, phase, tactics, homeAdvantage } = input;
  const rawAttack = (
    passer.attributes.passing * 0.3
    + passer.attributes.technique * 0.16
    + passer.attributes.vision * 0.15
    + passer.attributes.decisions * 0.14
    + passer.attributes.composure * 0.08
    + receiver.attributes.firstTouch * 0.09
    + receiver.attributes.offBall * 0.08
  );
  const attack = executionScore(passer, rawAttack, {
    fatigue: input.passerFatigue,
    pressure: input.pressure,
    foot: input.foot,
  });
  const defense = oppositionScore(defender, (
    defender.attributes.positioning * 0.29
    + defender.attributes.anticipation * 0.25
    + defender.attributes.marking * 0.18
    + defender.attributes.concentration * 0.13
    + defender.attributes.acceleration * 0.08
    + defender.attributes.tackling * 0.07
  ), input.defenderFatigue);
  const context = PASS_PHASE_MODIFIER[phase]
    - (tactics.risk - 50) / 650
    - (tactics.tempo - 50) / 900
    + mentalityModifier(tactics)
    + homeAdvantage / 500;
  const probability = clamp(0.74 + (attack - defense) / 190 + context, 0.16, 0.95);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateDribbleProbability(input: {
  dribbler: MatchPlayer;
  defender: MatchPlayer;
  homeAdvantage: number;
  dribblerFatigue?: number;
  defenderFatigue?: number;
  pressure?: number;
  foot?: FootUse;
}): ProbabilityBreakdown {
  const { dribbler, defender, homeAdvantage } = input;
  const attack = executionScore(dribbler, (
    dribbler.attributes.dribbling * 0.27
    + dribbler.attributes.technique * 0.17
    + dribbler.attributes.acceleration * 0.15
    + dribbler.attributes.agility * 0.14
    + dribbler.attributes.balance * 0.09
    + dribbler.attributes.flair * 0.09
    + dribbler.attributes.decisions * 0.09
  ), {
    fatigue: input.dribblerFatigue,
    pressure: input.pressure,
    foot: input.foot,
  });
  const defense = oppositionScore(defender, (
    defender.attributes.tackling * 0.24
    + defender.attributes.positioning * 0.18
    + defender.attributes.anticipation * 0.16
    + defender.attributes.agility * 0.12
    + defender.attributes.acceleration * 0.1
    + defender.attributes.strength * 0.1
    + defender.attributes.decisions * 0.1
  ), input.defenderFatigue);
  const context = homeAdvantage / 800;
  const probability = clamp(0.49 + (attack - defense) / 175 + context, 0.1, 0.88);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateCrossProbability(input: {
  crosser: MatchPlayer;
  marker: MatchPlayer;
  homeAdvantage: number;
  crosserFatigue?: number;
  markerFatigue?: number;
  pressure?: number;
  foot?: FootUse;
}): ProbabilityBreakdown {
  const { crosser, marker, homeAdvantage } = input;
  const attack = executionScore(crosser, (
    crosser.attributes.crossing * 0.38
    + crosser.attributes.technique * 0.18
    + crosser.attributes.balance * 0.12
    + crosser.attributes.composure * 0.12
    + crosser.attributes.decisions * 0.1
    + crosser.attributes.vision * 0.1
  ), {
    fatigue: input.crosserFatigue,
    pressure: input.pressure,
    foot: input.foot,
  });
  const defense = oppositionScore(marker, (
    marker.attributes.marking * 0.25
    + marker.attributes.positioning * 0.22
    + marker.attributes.anticipation * 0.18
    + marker.attributes.acceleration * 0.13
    + marker.attributes.agility * 0.12
    + marker.attributes.concentration * 0.1
  ), input.markerFatigue);
  const context = homeAdvantage / 900;
  const probability = clamp(0.55 + (attack - defense) / 185 + context, 0.14, 0.88);
  return Object.freeze({ probability, attack, defense, context });
}

function heightContribution(player: MatchPlayer) {
  return clamp((player.body.heightCm - 175) * 0.55, -8, 14);
}

export function calculateAerialDuelProbability(input: {
  attacker: MatchPlayer;
  defender: MatchPlayer;
  attackerFatigue?: number;
  defenderFatigue?: number;
  pressure?: number;
}): ProbabilityBreakdown {
  const { attacker, defender } = input;
  const attack = executionScore(attacker, (
    attacker.attributes.jumpingReach * 0.29
    + attacker.attributes.strength * 0.2
    + attacker.attributes.bravery * 0.16
    + attacker.attributes.anticipation * 0.16
    + attacker.attributes.balance * 0.09
    + attacker.attributes.offBall * 0.1
    + heightContribution(attacker)
  ), {
    fatigue: input.attackerFatigue,
    pressure: input.pressure,
  }, false);
  const defense = oppositionScore(defender, (
    defender.attributes.jumpingReach * 0.27
    + defender.attributes.strength * 0.2
    + defender.attributes.bravery * 0.14
    + defender.attributes.anticipation * 0.15
    + defender.attributes.positioning * 0.13
    + defender.attributes.marking * 0.11
    + heightContribution(defender)
  ), input.defenderFatigue);
  const context = 0;
  const probability = clamp(0.5 + (attack - defense) / 170, 0.09, 0.91);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateGoalkeeperCrossProbability(input: {
  goalkeeper: MatchPlayer;
  crosser: MatchPlayer;
  target: MatchPlayer;
  goalkeeperFatigue?: number;
  crosserFatigue?: number;
  pressure?: number;
  foot?: FootUse;
}): ProbabilityBreakdown {
  const { goalkeeper, crosser, target } = input;
  const attack = executionScore(goalkeeper, (
    goalkeeper.attributes.commandOfArea * 0.24
    + goalkeeper.attributes.aerialReach * 0.2
    + goalkeeper.attributes.handling * 0.16
    + goalkeeper.attributes.punching * 0.1
    + goalkeeper.attributes.decisions * 0.1
    + goalkeeper.attributes.communication * 0.1
    + goalkeeper.attributes.anticipation * 0.1
  ), {
    fatigue: input.goalkeeperFatigue,
    pressure: input.pressure,
  }, false);
  const delivery = executionScore(crosser, (
    crosser.attributes.crossing * 0.38
    + crosser.attributes.technique * 0.2
    + target.attributes.offBall * 0.16
    + target.attributes.jumpingReach * 0.14
    + target.attributes.bravery * 0.12
  ), {
    fatigue: input.crosserFatigue,
    pressure: input.pressure,
    foot: input.foot,
  });
  const defense = delivery;
  const context = 0;
  const probability = clamp(0.31 + (attack - defense) / 220, 0.08, 0.68);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateShotOnTargetProbability(input: {
  shooter: MatchPlayer;
  marker: MatchPlayer;
  tactics: TacticalPlan;
  homeAdvantage: number;
  shotType?: ShotType;
  shooterFatigue?: number;
  markerFatigue?: number;
  pressure?: number;
  foot?: FootUse;
  chanceQuality?: number;
}): ProbabilityBreakdown {
  const { shooter, marker, tactics, homeAdvantage } = input;
  const shotType = input.shotType ?? "foot";
  const rawAttack = shotType === "header"
    ? shooter.attributes.heading * 0.36
      + shooter.attributes.composure * 0.19
      + shooter.attributes.technique * 0.1
      + shooter.attributes.jumpingReach * 0.13
      + shooter.attributes.bravery * 0.1
      + shooter.attributes.anticipation * 0.12
    : shooter.attributes.finishing * 0.38
      + shooter.attributes.composure * 0.23
      + shooter.attributes.technique * 0.16
      + shooter.attributes.balance * 0.08
      + shooter.attributes.decisions * 0.08
      + shooter.attributes.offBall * 0.07;
  const attack = executionScore(shooter, rawAttack, {
    fatigue: input.shooterFatigue,
    pressure: input.pressure,
    foot: input.foot,
  }, shotType === "foot");
  const defense = oppositionScore(marker, (
    marker.attributes.positioning * 0.27
    + marker.attributes.anticipation * 0.2
    + marker.attributes.marking * 0.16
    + marker.attributes.concentration * 0.14
    + marker.attributes.tackling * 0.11
    + marker.attributes.bravery * 0.07
    + marker.attributes.balance * 0.05
  ), input.markerFatigue);
  const context = mentalityModifier(tactics)
    + homeAdvantage / 600
    + (input.chanceQuality ?? 0) / 500;
  const probability = clamp(0.46 + (attack - defense) / 205 + context, 0.12, 0.82);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateGoalProbability(input: {
  shooter: MatchPlayer;
  goalkeeper: MatchPlayer;
  homeAdvantage: number;
  shotType?: ShotType;
  shooterFatigue?: number;
  goalkeeperFatigue?: number;
  pressure?: number;
  foot?: FootUse;
  chanceQuality?: number;
}): ProbabilityBreakdown {
  const { shooter, goalkeeper, homeAdvantage } = input;
  const shotType = input.shotType ?? "foot";
  const rawAttack = shotType === "header"
    ? shooter.attributes.heading * 0.43
      + shooter.attributes.composure * 0.25
      + shooter.attributes.technique * 0.12
      + shooter.attributes.bravery * 0.1
      + shooter.attributes.anticipation * 0.1
    : shooter.attributes.finishing * 0.44
      + shooter.attributes.composure * 0.27
      + shooter.attributes.technique * 0.16
      + shooter.attributes.offBall * 0.08
      + shooter.attributes.balance * 0.05;
  const attack = executionScore(shooter, rawAttack, {
    fatigue: input.shooterFatigue,
    pressure: input.pressure,
    foot: input.foot,
  }, shotType === "foot");
  const goalkeeperRaw = shotType === "header"
    ? goalkeeper.attributes.reflexes * 0.27
      + goalkeeper.attributes.aerialReach * 0.2
      + goalkeeper.attributes.handling * 0.17
      + goalkeeper.attributes.positioning * 0.13
      + goalkeeper.attributes.anticipation * 0.13
      + goalkeeper.attributes.composure * 0.1
    : goalkeeper.attributes.reflexes * 0.29
      + goalkeeper.attributes.oneOnOnes * 0.22
      + goalkeeper.attributes.handling * 0.17
      + goalkeeper.attributes.positioning * 0.13
      + goalkeeper.attributes.anticipation * 0.11
      + goalkeeper.attributes.composure * 0.08;
  const defense = oppositionScore(goalkeeper, goalkeeperRaw, input.goalkeeperFatigue);
  const context = homeAdvantage / 700 + (input.chanceQuality ?? 0) / 650;
  const probability = clamp(0.29 + (attack - defense) / 175 + context, 0.04, 0.66);
  return Object.freeze({ probability, attack, defense, context });
}

export function calculateTeamControl(team: TeamSnapshot) {
  const outfieldPlayers = team.players.filter((player) => player.position !== "GK");
  const total = outfieldPlayers.reduce((sum, player) => sum
    + player.attributes.passing * 0.25
    + player.attributes.technique * 0.17
    + player.attributes.decisions * 0.17
    + player.attributes.vision * 0.12
    + player.attributes.positioning * 0.09
    + player.attributes.teamwork * 0.08
    + player.attributes.stamina * 0.06
    + player.attributes.firstTouch * 0.06, 0);
  return total / outfieldPlayers.length;
}
