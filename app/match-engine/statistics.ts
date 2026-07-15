import type {
  CanonicalMatchEvent,
  MatchStatistics,
  TeamStatistics,
} from "./contracts";

type MutableTeamStatistics = {
  -readonly [Key in keyof TeamStatistics]: TeamStatistics[Key];
};

function createTeamStatistics(teamId: string): MutableTeamStatistics {
  return {
    teamId,
    possessions: 0,
    possessionPercentage: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    interceptions: 0,
    dribblesAttempted: 0,
    dribblesWon: 0,
    tacklesAttempted: 0,
    tacklesWon: 0,
    crossesAttempted: 0,
    crossesCompleted: 0,
    aerialDuels: 0,
    aerialDuelsWon: 0,
    goalkeeperClaims: 0,
    goalkeeperPunches: 0,
    shots: 0,
    shotsOnTarget: 0,
    headedShots: 0,
    saves: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    yellowCards: 0,
    redCards: 0,
    offsides: 0,
    freeKicks: 0,
    corners: 0,
    penalties: 0,
    rebounds: 0,
    reboundsWon: 0,
    goals: 0,
  };
}

function freezeTeamStatistics(statistics: MutableTeamStatistics) {
  return Object.freeze({ ...statistics }) as TeamStatistics;
}

export function projectStatistics(
  events: readonly CanonicalMatchEvent[],
  homeTeamId: string,
  awayTeamId: string,
): MatchStatistics {
  const home = createTeamStatistics(homeTeamId);
  const away = createTeamStatistics(awayTeamId);
  const byTeam = new Map([
    [homeTeamId, home],
    [awayTeamId, away],
  ]);

  for (const event of events) {
    if (!event.teamId) continue;
    const statistics = byTeam.get(event.teamId);
    if (!statistics) throw new Error(`Evento estatístico associado a equipe desconhecida: ${event.teamId}.`);
    if (event.type === "possession_start") statistics.possessions += 1;
    if (event.type === "pass_attempt") statistics.passesAttempted += 1;
    if (event.type === "pass_completed") statistics.passesCompleted += 1;
    if (event.type === "interception") statistics.interceptions += 1;
    if (event.type === "dribble_attempt") statistics.dribblesAttempted += 1;
    if (event.type === "dribble_won") statistics.dribblesWon += 1;
    if (event.type === "tackle") {
      statistics.tacklesAttempted += 1;
      if (event.outcome === "won") statistics.tacklesWon += 1;
    }
    if (event.type === "cross_attempt") statistics.crossesAttempted += 1;
    if (event.type === "cross_completed") statistics.crossesCompleted += 1;
    if (event.type === "aerial_duel") {
      home.aerialDuels += 1;
      away.aerialDuels += 1;
      statistics.aerialDuelsWon += 1;
    }
    if (event.type === "goalkeeper_claim") statistics.goalkeeperClaims += 1;
    if (event.type === "goalkeeper_punch") statistics.goalkeeperPunches += 1;
    if (event.type === "shot") {
      statistics.shots += 1;
      if (event.outcome === "on_target") statistics.shotsOnTarget += 1;
      if (event.tags.includes("header")) statistics.headedShots += 1;
    }
    if (event.type === "save") statistics.saves += 1;
    if (event.type === "foul") {
      statistics.foulsCommitted += 1;
      const opponent = event.teamId === homeTeamId ? away : home;
      opponent.foulsSuffered += 1;
    }
    if (event.type === "yellow_card") statistics.yellowCards += 1;
    if (event.type === "red_card") statistics.redCards += 1;
    if (event.type === "offside") statistics.offsides += 1;
    if (event.type === "free_kick") statistics.freeKicks += 1;
    if (event.type === "corner") statistics.corners += 1;
    if (event.type === "penalty_kick") statistics.penalties += 1;
    if (event.type === "rebound") {
      home.rebounds += 1;
      away.rebounds += 1;
      statistics.reboundsWon += 1;
    }
    if (event.type === "goal") statistics.goals += 1;
  }

  const totalPossessions = home.possessions + away.possessions;
  home.possessionPercentage = totalPossessions ? Number((home.possessions / totalPossessions * 100).toFixed(1)) : 50;
  away.possessionPercentage = Number((100 - home.possessionPercentage).toFixed(1));

  const finalEvent = events.at(-1);
  if (finalEvent && (home.goals !== finalEvent.scoreAfter[0] || away.goals !== finalEvent.scoreAfter[1])) {
    throw new Error("As estatísticas reconstruídas divergem do placar do ledger.");
  }

  return Object.freeze({
    home: freezeTeamStatistics(home),
    away: freezeTeamStatistics(away),
  });
}
