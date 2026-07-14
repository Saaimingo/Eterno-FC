import type {
  MatchPlayer,
  MatchPosition,
  PlayerRole,
  PlayerTrait,
  PossessionPhase,
  RoleAssignment,
  TeamSnapshot,
} from "./contracts";

export type AttackAction = "shot" | "dribble" | "cross";

type RoleProfile = Readonly<{
  carrier: number;
  buildup: number;
  progression: number;
  creation: number;
  defend: number;
  aerial: number;
  shot: number;
  dribble: number;
  cross: number;
}>;

const ROLE_PROFILES: Readonly<Record<PlayerRole, RoleProfile>> = Object.freeze({
  goalkeeper: { carrier: -60, buildup: -55, progression: -70, creation: -80, defend: -70, aerial: -70, shot: -80, dribble: -80, cross: -80 },
  central_defender: { carrier: 20, buildup: 30, progression: -8, creation: -30, defend: 38, aerial: 28, shot: -28, dribble: -24, cross: -28 },
  ball_playing_defender: { carrier: 34, buildup: 43, progression: 8, creation: -18, defend: 27, aerial: 24, shot: -20, dribble: -12, cross: -22 },
  libero: { carrier: 38, buildup: 35, progression: 24, creation: 2, defend: 20, aerial: 16, shot: -4, dribble: 5, cross: -12 },
  defensive_fullback: { carrier: 12, buildup: 24, progression: 9, creation: 5, defend: 31, aerial: 5, shot: -18, dribble: -10, cross: 7 },
  support_fullback: { carrier: 12, buildup: 19, progression: 23, creation: 22, defend: 20, aerial: 4, shot: -10, dribble: 4, cross: 24 },
  attacking_wingback: { carrier: 8, buildup: 8, progression: 28, creation: 38, defend: 8, aerial: 2, shot: -4, dribble: 14, cross: 35 },
  ball_winning_midfielder: { carrier: 18, buildup: 22, progression: 22, creation: 4, defend: 39, aerial: 12, shot: -10, dribble: -13, cross: -18 },
  deep_lying_playmaker: { carrier: 44, buildup: 43, progression: 35, creation: 17, defend: 14, aerial: -4, shot: -8, dribble: -8, cross: -12 },
  box_to_box_midfielder: { carrier: 25, buildup: 20, progression: 35, creation: 29, defend: 22, aerial: 13, shot: 16, dribble: 9, cross: -5 },
  advanced_playmaker: { carrier: 34, buildup: 8, progression: 34, creation: 47, defend: -8, aerial: -12, shot: 15, dribble: 18, cross: 3 },
  shadow_striker: { carrier: 10, buildup: -15, progression: 18, creation: 45, defend: -12, aerial: 10, shot: 37, dribble: 16, cross: -18 },
  wide_winger: { carrier: 5, buildup: -12, progression: 30, creation: 45, defend: -8, aerial: -5, shot: 4, dribble: 22, cross: 42 },
  inside_forward: { carrier: 6, buildup: -14, progression: 27, creation: 43, defend: -10, aerial: 5, shot: 31, dribble: 25, cross: -8 },
  second_striker: { carrier: 8, buildup: -18, progression: 22, creation: 39, defend: -14, aerial: 13, shot: 31, dribble: 17, cross: -13 },
  mobile_forward: { carrier: 5, buildup: -22, progression: 15, creation: 44, defend: -18, aerial: 18, shot: 42, dribble: 13, cross: -20 },
  target_forward: { carrier: 3, buildup: -18, progression: 12, creation: 38, defend: -14, aerial: 47, shot: 34, dribble: -18, cross: -25 },
  poacher: { carrier: -2, buildup: -28, progression: 4, creation: 49, defend: -25, aerial: 24, shot: 54, dribble: -7, cross: -32 },
});

const ACTION_TRAITS: Readonly<Record<AttackAction, Readonly<Partial<Record<PlayerTrait, number>>>>> = Object.freeze({
  shot: Object.freeze({
    cuts_inside: 12,
    arrives_late: 17,
    first_time_shots: 20,
    places_shots: 8,
    shoots_with_power: 8,
    plays_with_back_to_goal: 5,
  }),
  dribble: Object.freeze({
    cuts_inside: 13,
    runs_with_ball: 30,
    avoids_dribbling: -38,
    plays_out_of_pressure: 10,
    seeks_one_twos: 5,
  }),
  cross: Object.freeze({
    cuts_inside: -18,
    keeps_width: 18,
    early_crosses: 30,
    stays_back: -14,
  }),
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function defaultRoleForPosition(position: MatchPosition): PlayerRole {
  if (position === "GK") return "goalkeeper";
  if (position === "CB") return "central_defender";
  if (position === "LB" || position === "RB") return "support_fullback";
  if (position === "DM") return "ball_winning_midfielder";
  if (position === "CM") return "box_to_box_midfielder";
  if (position === "AM") return "advanced_playmaker";
  if (position === "LW" || position === "RW") return "wide_winger";
  return "mobile_forward";
}

export function assignmentFor(team: TeamSnapshot, playerId: string) {
  const assignment = team.assignments.find((candidate) => candidate.playerId === playerId);
  if (!assignment) throw new Error(`Jogador ${playerId} está em campo sem função em ${team.name}.`);
  return assignment;
}

export function effectiveFamiliarity(player: MatchPlayer, assignment: RoleAssignment) {
  const positional = player.positionFamiliarity[assignment.position] ?? 0;
  return Number(clamp(positional * 0.64 + assignment.tacticalFamiliarity * 0.36, 0, 100).toFixed(2));
}

export function tacticalAdherence(player: MatchPlayer, assignment: RoleAssignment) {
  const familiarity = effectiveFamiliarity(player, assignment);
  return clamp(
    0.54
      + player.attributes.teamwork / 320
      + player.attributes.decisions / 520
      + familiarity / 620,
    0.62,
    1.18,
  );
}

function profileFor(team: TeamSnapshot, player: MatchPlayer) {
  const assignment = assignmentFor(team, player.id);
  return { assignment, profile: ROLE_PROFILES[assignment.role] };
}

function phaseProfile(profile: RoleProfile, phase: PossessionPhase) {
  if (phase === "buildup" || phase === "progression" || phase === "creation") return profile[phase];
  return 0;
}

export function initialCarrierModifier(team: TeamSnapshot, player: MatchPlayer) {
  const { assignment, profile } = profileFor(team, player);
  const trait = player.traits.includes("dictates_tempo") ? 19 : 0;
  const simple = player.traits.includes("prefers_simple_passes") ? 8 : 0;
  return (profile.carrier + trait + simple) * tacticalAdherence(player, assignment);
}

export function receiverModifier(team: TeamSnapshot, player: MatchPlayer, phase: PossessionPhase) {
  const { assignment, profile } = profileFor(team, player);
  const adherence = tacticalAdherence(player, assignment);
  const familiarity = effectiveFamiliarity(player, assignment);
  const movement = assignment.instructions.movement === "get_forward"
    ? phase === "creation" ? 15 : 7
    : assignment.instructions.movement === "hold"
      ? phase === "buildup" ? 12 : -12
      : 0;
  const isWide = ["LB", "RB", "LW", "RW"].includes(assignment.position);
  const focus = team.tactics.attackingFocus === "flanks"
    ? isWide ? 13 : -5
    : team.tactics.attackingFocus === "center"
      ? isWide ? -6 : 10
      : 0;
  const width = assignment.instructions.width === "wide"
    ? isWide ? 8 : -2
    : assignment.instructions.width === "narrow"
      ? isWide ? -6 : 6
      : 0;
  const trait = phase === "creation" && player.traits.includes("arrives_late") ? 13 : 0;
  const passingStyle = team.tactics.passingStyle === "direct"
    ? ["AM", "LW", "RW", "ST"].includes(assignment.position) ? 10 : -3
    : team.tactics.passingStyle === "short"
      ? ["CB", "DM", "CM"].includes(assignment.position) ? 9 : -2
      : 0;
  return (phaseProfile(profile, phase) + movement + focus + width + trait + passingStyle) * adherence
    + (familiarity - 75) * 0.12;
}

export function passTargetModifier(
  carrier: MatchPlayer,
  receiver: MatchPlayer,
  phase: PossessionPhase,
) {
  const attackingTarget = ["AM", "LW", "RW", "ST"].includes(receiver.position);
  const safeTarget = ["CB", "DM", "CM"].includes(receiver.position);
  let modifier = 0;
  if (carrier.traits.includes("tries_killer_balls") && phase === "creation") {
    modifier += attackingTarget ? 20 : -8;
  }
  if (carrier.traits.includes("prefers_simple_passes")) {
    modifier += safeTarget ? 13 : -7;
  }
  if (carrier.traits.includes("tries_long_passes") && phase !== "buildup") {
    modifier += attackingTarget ? 16 : -5;
  }
  if (carrier.traits.includes("switches_play")) {
    const rightToLeft = ["RB", "RW"].includes(carrier.position) && ["LB", "LW"].includes(receiver.position);
    const leftToRight = ["LB", "LW"].includes(carrier.position) && ["RB", "RW"].includes(receiver.position);
    if (rightToLeft || leftToRight) modifier += 18;
  }
  if (carrier.traits.includes("seeks_one_twos") && ["CM", "AM", "ST"].includes(receiver.position)) {
    modifier += 8;
  }
  return modifier;
}

export function defenderModifier(team: TeamSnapshot, player: MatchPlayer, phase: PossessionPhase) {
  const { assignment, profile } = profileFor(team, player);
  const adherence = tacticalAdherence(player, assignment);
  const individualPress = (assignment.instructions.pressing - 50) * 0.28;
  const collectivePress = (team.tactics.pressingIntensity - 50) * 0.2;
  const lineEffect = phase === "buildup"
    ? (team.tactics.pressingLine - 50) * 0.18
    : phase === "creation"
      ? (team.tactics.defensiveLine - 50) * 0.14
      : 0;
  const trait = player.traits.includes("presses_aggressively") ? 14 : 0;
  const caution = player.traits.includes("avoids_risky_tackles") ? -7 : 0;
  return (profile.defend + individualPress + collectivePress + lineEffect + trait + caution) * adherence;
}

export function aerialTargetModifier(team: TeamSnapshot, player: MatchPlayer) {
  const { assignment, profile } = profileFor(team, player);
  const movement = assignment.instructions.movement === "get_forward" ? 10 : assignment.instructions.movement === "hold" ? -12 : 0;
  return (profile.aerial + movement) * tacticalAdherence(player, assignment);
}

export function attackActionModifier(team: TeamSnapshot, player: MatchPlayer, action: AttackAction) {
  const { assignment, profile } = profileFor(team, player);
  const adherence = tacticalAdherence(player, assignment);
  const instructionValue = action === "shot"
    ? assignment.instructions.shoot
    : assignment.instructions[action];
  const instruction = (instructionValue - 50) * 0.52;
  const risk = (assignment.instructions.risk - 50) * (action === "shot" ? 0.2 : 0.13);
  const trait = player.traits.reduce((sum, candidate) => sum + (ACTION_TRAITS[action][candidate] ?? 0), 0);
  const collective = action === "cross"
    ? (team.tactics.width - 50) * 0.28 + (team.tactics.attackingFocus === "flanks" ? 18 : team.tactics.attackingFocus === "center" ? -11 : 0)
    : action === "shot"
      ? (team.tactics.mentality === "attacking" ? 13 : team.tactics.mentality === "defensive" ? -10 : 0)
        + (team.tactics.attackingFocus === "center" ? 11 : 0)
      : (team.tactics.creativeFreedom - 50) * 0.22
        + (team.tactics.transitionStyle === "counter" ? 8 : 0);
  return (profile[action] + instruction + risk + trait + collective) * adherence;
}

export function relevantActionTraits(player: MatchPlayer, action: AttackAction) {
  return Object.freeze(player.traits.filter((trait) => ACTION_TRAITS[action][trait] !== undefined));
}

export function tacticalAudit(team: TeamSnapshot, player: MatchPlayer) {
  const assignment = assignmentFor(team, player.id);
  return Object.freeze({
    role: assignment.role,
    assignedPosition: assignment.position,
    familiarity: effectiveFamiliarity(player, assignment),
    formation: team.tactics.formation,
    mentality: team.tactics.mentality,
  });
}
