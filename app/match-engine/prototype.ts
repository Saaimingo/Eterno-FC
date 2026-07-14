import {
  CORE_ATTRIBUTE_KEYS,
  type CoreAttribute,
  type CoreAttributes,
  type MatchInput,
  type MatchPlayer,
  type MatchPosition,
  type TeamSnapshot,
} from "./contracts";

const POSITIONS: readonly MatchPosition[] = [
  "GK", "RB", "CB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST",
];

const HOME_NAMES = [
  "Caio Nobre", "Luan Serra", "Ícaro Luz", "Davi Rocha", "Rui Vale", "Nilo Prado",
  "Theo Campos", "Gael Reis", "Yuri Sol", "Breno Lima", "Alex Viana",
];

const AWAY_NAMES = [
  "Otávio Melo", "Raul Torres", "César Moura", "Enzo Vidal", "Alan Freire", "Noah Pires",
  "Levi Ramos", "Hugo Neves", "Ian Leal", "Vitor Leme", "Samuel Paes",
];

const POSITION_ADJUSTMENTS: Record<MatchPosition, Partial<Record<CoreAttribute, number>>> = {
  GK: { positioning: 18, anticipation: 14, composure: 10, technique: 4, passing: -2, finishing: -30, tackling: -12, offBall: -18 },
  RB: { passing: 5, technique: 4, vision: 2, offBall: 8, positioning: 8, tackling: 9, stamina: 13, finishing: -8 },
  CB: { passing: 1, decisions: 7, positioning: 15, anticipation: 13, tackling: 15, composure: 7, stamina: 5, finishing: -12, offBall: -8 },
  LB: { passing: 5, technique: 4, vision: 2, offBall: 8, positioning: 8, tackling: 9, stamina: 13, finishing: -8 },
  DM: { passing: 7, vision: 6, decisions: 12, positioning: 13, anticipation: 11, tackling: 13, composure: 7, stamina: 10, finishing: -7 },
  CM: { passing: 12, technique: 10, vision: 11, decisions: 10, firstTouch: 9, offBall: 5, positioning: 5, stamina: 8, finishing: 1 },
  AM: { passing: 11, technique: 13, vision: 15, decisions: 9, firstTouch: 12, offBall: 11, finishing: 7, positioning: -4, tackling: -9 },
  RW: { passing: 7, technique: 12, vision: 8, decisions: 5, firstTouch: 10, offBall: 15, finishing: 9, positioning: -6, tackling: -10, stamina: 6 },
  LW: { passing: 7, technique: 12, vision: 8, decisions: 5, firstTouch: 10, offBall: 15, finishing: 9, positioning: -6, tackling: -10, stamina: 6 },
  ST: { passing: -3, technique: 9, vision: 2, decisions: 7, firstTouch: 10, offBall: 18, finishing: 18, positioning: -8, tackling: -15, composure: 13, stamina: 4 },
};

function clampAttribute(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function createAttributes(position: MatchPosition, variation: number): CoreAttributes {
  const adjustments = POSITION_ADJUSTMENTS[position];
  return Object.freeze(Object.fromEntries(CORE_ATTRIBUTE_KEYS.map((attribute) => [
    attribute,
    clampAttribute(55 + variation + (adjustments[attribute] ?? 0)),
  ])) as unknown as CoreAttributes);
}

function createPlayers(teamId: string, names: readonly string[], teamVariation: number) {
  return Object.freeze(POSITIONS.map((position, index) => Object.freeze({
    id: `${teamId}-p${index + 1}`,
    teamId,
    name: names[index],
    position,
    attributes: createAttributes(position, teamVariation + index % 3 - 1),
    condition: 100,
  }) satisfies MatchPlayer));
}

function createTeam(
  id: string,
  name: string,
  names: readonly string[],
  variation: number,
): TeamSnapshot {
  return Object.freeze({
    id,
    name,
    players: createPlayers(id, names, variation),
    tactics: Object.freeze({
      formation: "4-2-3-1",
      mentality: "balanced" as const,
      risk: 50,
      tempo: 50,
    }),
  });
}

export function createPrototypeMatchInput(seed: string, possessionsPerPeriod = 30): MatchInput {
  return Object.freeze({
    context: Object.freeze({
      matchId: `prototype-${seed}`,
      competitionId: "prototype-league",
      seed,
      homeAdvantage: 3,
      possessionsPerPeriod,
    }),
    home: createTeam("aurora", "Aurora FC", HOME_NAMES, 1),
    away: createTeam("ferro-azul", "Ferroviário Azul", AWAY_NAMES, 0),
  });
}

export function adjustTeamAttributes(
  team: TeamSnapshot,
  deltas: Partial<Record<CoreAttribute, number>>,
): TeamSnapshot {
  return Object.freeze({
    ...team,
    players: Object.freeze(team.players.map((player) => Object.freeze({
      ...player,
      attributes: Object.freeze(Object.fromEntries(CORE_ATTRIBUTE_KEYS.map((attribute) => [
        attribute,
        clampAttribute(player.attributes[attribute] + (deltas[attribute] ?? 0)),
      ])) as unknown as CoreAttributes),
    }))),
  });
}
