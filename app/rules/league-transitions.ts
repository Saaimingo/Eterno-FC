export type LeagueTransitionRule = {
  upper: string;
  lower: string;
  relegated: number;
  promoted: number;
};

export type RankedClub = { clubId: string };

export function resolveLeagueTransitions(
  rules: readonly LeagueTransitionRule[],
  tables: ReadonlyMap<string, readonly RankedClub[]>,
) {
  const moves = new Map<string, string>();

  for (const rule of rules) {
    const upperTable = tables.get(rule.upper) ?? [];
    const lowerTable = tables.get(rule.lower) ?? [];

    upperTable.slice(-rule.relegated).forEach((row) => moves.set(row.clubId, rule.lower));
    lowerTable.slice(0, rule.promoted).forEach((row) => moves.set(row.clubId, rule.upper));
  }

  return moves;
}

export function divisionShortfall(
  divisionId: string,
  currentClubIds: readonly string[],
  clubDivisionsAfterMoves: ReadonlyMap<string, string>,
) {
  const currentSize = currentClubIds.length;
  const nextSize = [...clubDivisionsAfterMoves.values()].filter((division) => division === divisionId).length;
  return Math.max(0, currentSize - nextSize);
}
