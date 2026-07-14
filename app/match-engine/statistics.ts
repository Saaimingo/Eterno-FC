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
    shots: 0,
    shotsOnTarget: 0,
    saves: 0,
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
    if (event.type === "shot") {
      statistics.shots += 1;
      if (event.outcome === "on_target") statistics.shotsOnTarget += 1;
    }
    if (event.type === "save") statistics.saves += 1;
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
