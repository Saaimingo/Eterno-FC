import {
  GOALKEEPER_ATTRIBUTE_KEYS,
  PLAYER_ATTRIBUTE_KEYS,
  type BodyProfile,
  type FootProfile,
  type IndividualInstructions,
  type MatchInput,
  type MatchIntervention,
  type MatchPlayer,
  type MatchPosition,
  type PlayerAttribute,
  type PlayerAttributes,
  type PlayerRole,
  type PlayerTrait,
  type PositionFamiliarity,
  type RoleAssignment,
  type TacticalPlan,
  type TeamSnapshot,
} from "./contracts";
import { defaultRoleForPosition } from "./tactics";

const POSITIONS: readonly MatchPosition[] = [
  "GK", "RB", "CB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST",
];

const BENCH_POSITIONS: readonly MatchPosition[] = ["GK", "CB", "RB", "CM", "AM", "RW", "ST"];

const HOME_NAMES = [
  "Caio Nobre", "Luan Serra", "Ícaro Luz", "Davi Rocha", "Rui Vale", "Nilo Prado",
  "Theo Campos", "Gael Reis", "Yuri Sol", "Breno Lima", "Alex Viana",
];

const AWAY_NAMES = [
  "Otávio Melo", "Raul Torres", "César Moura", "Enzo Vidal", "Alan Freire", "Noah Pires",
  "Levi Ramos", "Hugo Neves", "Ian Leal", "Vitor Leme", "Samuel Paes",
];

const HOME_BENCH_NAMES = [
  "Murilo Braga", "João Teles", "Erick Farias", "Lucca Matos", "Pedro Sena", "Ravi Cunha", "André Vidal",
];

const AWAY_BENCH_NAMES = [
  "Bento Maia", "Ramon Diniz", "Artur Galvão", "Kaique Nunes", "Heitor Cruz", "Diego Lins", "Renan Bastos",
];

const GOALKEEPER_ATTRIBUTES = new Set<PlayerAttribute>(GOALKEEPER_ATTRIBUTE_KEYS);

const POSITION_ADJUSTMENTS: Record<MatchPosition, Partial<Record<PlayerAttribute, number>>> = {
  GK: {
    finishing: -24, crossing: -14, dribbling: -10, tackling: -8, marking: -5,
    positioning: 12, anticipation: 10, composure: 10, decisions: 8, jumpingReach: 11,
    strength: 8, balance: 7, aerialReach: 17, commandOfArea: 12, communication: 10,
    handling: 15, kicking: 8, oneOnOnes: 14, reflexes: 16, rushingOut: 9,
    punching: 8, throwing: 9,
  },
  RB: {
    crossing: 16, dribbling: 7, passing: 6, technique: 5, marking: 8, tackling: 9,
    offBall: 7, positioning: 8, teamwork: 8, workRate: 12, acceleration: 11,
    pace: 11, stamina: 13, finishing: -9, heading: -4,
  },
  CB: {
    heading: 14, marking: 15, tackling: 14, anticipation: 13, bravery: 12,
    concentration: 12, decisions: 7, positioning: 16, jumpingReach: 14,
    strength: 14, composure: 6, passing: 1, crossing: -12, dribbling: -9,
    finishing: -13, offBall: -8, acceleration: -4, agility: -5,
  },
  LB: {
    crossing: 16, dribbling: 7, passing: 6, technique: 5, marking: 8, tackling: 9,
    offBall: 7, positioning: 8, teamwork: 8, workRate: 12, acceleration: 11,
    pace: 11, stamina: 13, finishing: -9, heading: -4,
  },
  DM: {
    passing: 8, tackling: 13, marking: 12, anticipation: 12, bravery: 9,
    concentration: 10, decisions: 12, positioning: 14, teamwork: 12,
    workRate: 11, stamina: 10, strength: 8, finishing: -8, crossing: -5,
  },
  CM: {
    passing: 14, technique: 11, vision: 12, decisions: 11, firstTouch: 10,
    teamwork: 10, offBall: 6, positioning: 5, stamina: 9, workRate: 8,
    longShots: 5, finishing: 1,
  },
  AM: {
    passing: 11, technique: 14, vision: 15, decisions: 9, firstTouch: 13,
    dribbling: 13, flair: 14, offBall: 12, finishing: 7, acceleration: 7,
    agility: 9, positioning: -5, marking: -9, tackling: -10,
  },
  RW: {
    crossing: 13, dribbling: 15, technique: 12, vision: 7, firstTouch: 10,
    flair: 11, offBall: 15, finishing: 9, acceleration: 14, agility: 12,
    pace: 14, stamina: 6, positioning: -7, marking: -9, tackling: -11,
  },
  LW: {
    crossing: 13, dribbling: 15, technique: 12, vision: 7, firstTouch: 10,
    flair: 11, offBall: 15, finishing: 9, acceleration: 14, agility: 12,
    pace: 14, stamina: 6, positioning: -7, marking: -9, tackling: -11,
  },
  ST: {
    finishing: 18, heading: 13, technique: 8, firstTouch: 10, anticipation: 10,
    bravery: 10, composure: 14, offBall: 18, jumpingReach: 11, strength: 11,
    acceleration: 7, passing: -4, crossing: -12, marking: -13, tackling: -16,
    positioning: -8,
  },
};

function clampAttribute(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function createAttributes(position: MatchPosition, variation: number): PlayerAttributes {
  const adjustments = POSITION_ADJUSTMENTS[position];
  return Object.freeze(Object.fromEntries(PLAYER_ATTRIBUTE_KEYS.map((attribute) => {
    const base = GOALKEEPER_ATTRIBUTES.has(attribute)
      ? position === "GK" ? 57 : 8
      : position === "GK" ? 41 : 53;
    return [attribute, clampAttribute(base + variation + (adjustments[attribute] ?? 0))];
  }))) as unknown as PlayerAttributes;
}

function createFeet(position: MatchPosition, index: number): FootProfile {
  if (["LB", "LW"].includes(position)) {
    return Object.freeze({ left: 850, right: 560 + index % 3 * 25, avoidsWeakFoot: true });
  }
  if (["RB", "RW"].includes(position)) {
    return Object.freeze({ left: 560 + index % 3 * 25, right: 850, avoidsWeakFoot: true });
  }
  if (index === 6) return Object.freeze({ left: 790, right: 820, avoidsWeakFoot: false });
  const rightDominant = index % 3 !== 0;
  return Object.freeze(rightDominant
    ? { left: 590 + index % 2 * 35, right: 830, avoidsWeakFoot: true }
    : { left: 825, right: 600 + index % 2 * 35, avoidsWeakFoot: true });
}

function createBody(position: MatchPosition, index: number): BodyProfile {
  const base = position === "GK"
    ? [191, 84]
    : position === "CB"
      ? [187, 82]
      : position === "ST"
        ? [184, 80]
        : [177, 72];
  return Object.freeze({
    heightCm: base[0] + index % 3 - 1,
    massKg: base[1] + index % 4 - 2,
  });
}

function createPositionFamiliarity(position: MatchPosition): PositionFamiliarity {
  const related: Partial<Record<MatchPosition, number>> = { [position]: 100 };
  if (position === "RB") Object.assign(related, { LB: 55, RW: 62, CB: 38 });
  if (position === "LB") Object.assign(related, { RB: 55, LW: 62, CB: 38 });
  if (position === "CB") Object.assign(related, { DM: 58, RB: 36, LB: 36 });
  if (position === "DM") Object.assign(related, { CM: 78, CB: 55, AM: 34 });
  if (position === "CM") Object.assign(related, { DM: 76, AM: 72, RW: 30, LW: 30 });
  if (position === "AM") Object.assign(related, { CM: 74, ST: 58, RW: 52, LW: 52 });
  if (position === "RW") Object.assign(related, { LW: 68, AM: 58, RB: 45, ST: 42 });
  if (position === "LW") Object.assign(related, { RW: 68, AM: 58, LB: 45, ST: 42 });
  if (position === "ST") Object.assign(related, { AM: 57, RW: 38, LW: 38 });
  return Object.freeze(related);
}

function createTraits(position: MatchPosition, index: number): readonly PlayerTrait[] {
  if (position === "GK") return Object.freeze(["plays_out_of_pressure"]);
  if (position === "RB" || position === "LB") return Object.freeze(["keeps_width", "early_crosses"]);
  if (position === "CB") return Object.freeze(index % 2 === 0 ? ["plays_out_of_pressure"] : ["stays_back"]);
  if (position === "DM") return Object.freeze(["stays_back", "presses_aggressively"]);
  if (position === "CM") return Object.freeze(["dictates_tempo", "switches_play"]);
  if (position === "AM") return Object.freeze(["tries_killer_balls", "seeks_one_twos"]);
  if (position === "RW") return Object.freeze(["keeps_width", "runs_with_ball"]);
  if (position === "LW") return Object.freeze(["cuts_inside", "runs_with_ball"]);
  return Object.freeze(["places_shots", "plays_with_back_to_goal"]);
}

function createPlayers(
  teamId: string,
  names: readonly string[],
  positions: readonly MatchPosition[],
  teamVariation: number,
  idOffset = 0,
) {
  return Object.freeze(positions.map((position, index) => {
    const globalIndex = index + idOffset;
    return Object.freeze({
      id: `${teamId}-p${globalIndex + 1}`,
      teamId,
      name: names[index],
      position,
      attributes: createAttributes(position, teamVariation + globalIndex % 3 - 1),
      feet: createFeet(position, globalIndex),
      body: createBody(position, globalIndex),
      condition: 100,
      positionFamiliarity: createPositionFamiliarity(position),
      traits: createTraits(position, globalIndex),
    }) satisfies MatchPlayer;
  }));
}

function createInstructions(position: MatchPosition, role: PlayerRole): IndividualInstructions {
  const wide = ["RB", "LB", "RW", "LW"].includes(position);
  const attacking = ["AM", "RW", "LW", "ST"].includes(position);
  return Object.freeze({
    risk: role === "advanced_playmaker" || role === "inside_forward" ? 64 : 50,
    dribble: ["wide_winger", "inside_forward", "advanced_playmaker"].includes(role) ? 64 : 45,
    cross: ["support_fullback", "attacking_wingback", "wide_winger"].includes(role) ? 66 : 42,
    shoot: ["poacher", "mobile_forward", "inside_forward", "shadow_striker"].includes(role) ? 67 : 45,
    pressing: role === "ball_winning_midfielder" ? 68 : attacking ? 56 : 50,
    width: wide && role !== "inside_forward" ? "wide" : role === "inside_forward" ? "narrow" : "balanced",
    movement: role === "central_defender" || role === "ball_winning_midfielder"
      ? "hold"
      : attacking || role === "support_fullback"
        ? "get_forward"
        : "balanced",
  });
}

function startingRole(position: MatchPosition, index: number): PlayerRole {
  if (position === "CB") return index % 2 === 0 ? "central_defender" : "ball_playing_defender";
  if (position === "RW") return "wide_winger";
  if (position === "LW") return "inside_forward";
  return defaultRoleForPosition(position);
}

function createAssignments(players: readonly MatchPlayer[]): readonly RoleAssignment[] {
  return Object.freeze(players.map((player, index) => {
    const role = startingRole(player.position, index);
    return Object.freeze({
      playerId: player.id,
      position: player.position,
      role,
      tacticalFamiliarity: 88 + index % 4 * 2,
      instructions: createInstructions(player.position, role),
    });
  }));
}

function createTeam(
  id: string,
  name: string,
  names: readonly string[],
  benchNames: readonly string[],
  variation: number,
): TeamSnapshot {
  const players = createPlayers(id, names, POSITIONS, variation);
  return Object.freeze({
    id,
    name,
    players,
    bench: createPlayers(id, benchNames, BENCH_POSITIONS, variation - 2, POSITIONS.length),
    assignments: createAssignments(players),
    tactics: Object.freeze({
      formation: "4-2-3-1",
      mentality: "balanced" as const,
      risk: 50,
      tempo: 50,
      width: 50,
      defensiveLine: 50,
      pressingLine: 50,
      pressingIntensity: 50,
      passingStyle: "mixed" as const,
      attackingFocus: "balanced" as const,
      transitionStyle: "balanced" as const,
      creativeFreedom: 50,
    }),
  });
}

export function createPrototypeMatchInput(seed: string, possessionsPerPeriod = 45): MatchInput {
  return Object.freeze({
    context: Object.freeze({
      matchId: `prototype-${seed}`,
      competitionId: "prototype-league",
      seed,
      homeAdvantage: 3,
      possessionsPerPeriod,
      importance: 55,
    }),
    home: createTeam("aurora", "Aurora FC", HOME_NAMES, HOME_BENCH_NAMES, 1),
    away: createTeam("ferro-azul", "Ferroviário Azul", AWAY_NAMES, AWAY_BENCH_NAMES, 0),
    interventions: Object.freeze([]),
  });
}

function adjustPlayer(
  team: TeamSnapshot,
  playerId: string,
  transform: (player: MatchPlayer) => MatchPlayer,
): TeamSnapshot {
  if (![...team.players, ...team.bench].some((player) => player.id === playerId)) {
    throw new Error(`Jogador desconhecido em ${team.name}: ${playerId}.`);
  }
  return Object.freeze({
    ...team,
    players: Object.freeze(team.players.map((player) => player.id === playerId ? transform(player) : player)),
    bench: Object.freeze(team.bench.map((player) => player.id === playerId ? transform(player) : player)),
  });
}

export function adjustPlayerAttributes(
  team: TeamSnapshot,
  playerId: string,
  deltas: Partial<Record<PlayerAttribute, number>>,
): TeamSnapshot {
  return adjustPlayer(team, playerId, (player) => Object.freeze({
    ...player,
    attributes: Object.freeze(Object.fromEntries(PLAYER_ATTRIBUTE_KEYS.map((attribute) => [
      attribute,
      clampAttribute(player.attributes[attribute] + (deltas[attribute] ?? 0)),
    ]))) as unknown as PlayerAttributes,
  }));
}

export function adjustPlayerFeet(
  team: TeamSnapshot,
  playerId: string,
  feet: Partial<FootProfile>,
): TeamSnapshot {
  return adjustPlayer(team, playerId, (player) => Object.freeze({
    ...player,
    feet: Object.freeze({ ...player.feet, ...feet }),
  }));
}

export function adjustPlayerCondition(team: TeamSnapshot, playerId: string, condition: number): TeamSnapshot {
  return adjustPlayer(team, playerId, (player) => Object.freeze({
    ...player,
    condition: Math.min(100, Math.max(0, condition)),
  }));
}

export function adjustPlayerTraits(
  team: TeamSnapshot,
  playerId: string,
  traits: readonly PlayerTrait[],
): TeamSnapshot {
  return adjustPlayer(team, playerId, (player) => Object.freeze({
    ...player,
    traits: Object.freeze([...traits]),
  }));
}

export function adjustRoleAssignment(
  team: TeamSnapshot,
  playerId: string,
  changes: Partial<Omit<RoleAssignment, "playerId" | "instructions">>
    & Readonly<{ instructions?: Partial<IndividualInstructions> }>,
): TeamSnapshot {
  if (!team.assignments.some((assignment) => assignment.playerId === playerId)) {
    throw new Error(`Jogador sem função em ${team.name}: ${playerId}.`);
  }
  return Object.freeze({
    ...team,
    assignments: Object.freeze(team.assignments.map((assignment) => assignment.playerId === playerId
      ? Object.freeze({
        ...assignment,
        ...changes,
        instructions: Object.freeze({ ...assignment.instructions, ...(changes.instructions ?? {}) }),
      })
      : assignment)),
  });
}

export function adjustTacticalPlan(team: TeamSnapshot, changes: Partial<TacticalPlan>): TeamSnapshot {
  return Object.freeze({
    ...team,
    tactics: Object.freeze({ ...team.tactics, ...changes }),
  });
}

export function scheduleMatchInterventions(
  input: MatchInput,
  interventions: readonly MatchIntervention[],
): MatchInput {
  return Object.freeze({
    ...input,
    interventions: Object.freeze(interventions.map((intervention) => intervention.type === "substitution"
      ? Object.freeze({
        ...intervention,
        assignment: Object.freeze({
          ...intervention.assignment,
          instructions: Object.freeze({ ...intervention.assignment.instructions }),
        }),
      })
      : Object.freeze({
        ...intervention,
        changes: Object.freeze({ ...intervention.changes }),
        assignmentChanges: Object.freeze(intervention.assignmentChanges.map((assignment) => Object.freeze({
          ...assignment,
          instructions: Object.freeze({ ...assignment.instructions }),
        }))),
      }))),
  });
}

export function adjustTeamAttributes(
  team: TeamSnapshot,
  deltas: Partial<Record<PlayerAttribute, number>>,
): TeamSnapshot {
  return Object.freeze({
    ...team,
    players: Object.freeze(team.players.map((player) => Object.freeze({
      ...player,
      attributes: Object.freeze(Object.fromEntries(PLAYER_ATTRIBUTE_KEYS.map((attribute) => [
        attribute,
        clampAttribute(player.attributes[attribute] + (deltas[attribute] ?? 0)),
      ]))) as unknown as PlayerAttributes,
    }))),
    bench: Object.freeze(team.bench.map((player) => Object.freeze({
      ...player,
      attributes: Object.freeze(Object.fromEntries(PLAYER_ATTRIBUTE_KEYS.map((attribute) => [
        attribute,
        clampAttribute(player.attributes[attribute] + (deltas[attribute] ?? 0)),
      ]))) as unknown as PlayerAttributes,
    }))),
  });
}
