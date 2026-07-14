import {
  createPrototypeMatchInput,
  simulateMatch,
} from "../app/match-engine/index.ts";

const requestedMatches = Number(process.argv[2] ?? 10_000);
if (!Number.isInteger(requestedMatches) || requestedMatches < 1 || requestedMatches > 100_000) {
  throw new Error("Informe uma quantidade inteira entre 1 e 100000 partidas.");
}

const aggregate = {
  matches: requestedMatches,
  homeWins: 0,
  draws: 0,
  awayWins: 0,
  homeGoals: 0,
  awayGoals: 0,
  shots: 0,
  headedShots: 0,
  passesAttempted: 0,
  passesCompleted: 0,
  crossesAttempted: 0,
  crossesCompleted: 0,
  dribblesAttempted: 0,
  dribblesWon: 0,
  tacklesAttempted: 0,
  tacklesWon: 0,
  aerialDuels: 0,
  goalkeeperInterventions: 0,
  saves: 0,
  totalFinalFatigue: 0,
  maxFinalFatigue: 0,
  maxHomeGoals: 0,
  maxAwayGoals: 0,
  maxTotalGoals: 0,
};

for (let index = 0; index < requestedMatches; index += 1) {
  const result = simulateMatch(createPrototypeMatchInput(`calibration-${index}`));
  const [homeGoals, awayGoals] = result.finalState.score;
  if (homeGoals > awayGoals) aggregate.homeWins += 1;
  else if (homeGoals < awayGoals) aggregate.awayWins += 1;
  else aggregate.draws += 1;
  aggregate.homeGoals += homeGoals;
  aggregate.awayGoals += awayGoals;
  aggregate.shots += result.statistics.home.shots + result.statistics.away.shots;
  aggregate.headedShots += result.statistics.home.headedShots + result.statistics.away.headedShots;
  aggregate.passesAttempted += result.statistics.home.passesAttempted + result.statistics.away.passesAttempted;
  aggregate.passesCompleted += result.statistics.home.passesCompleted + result.statistics.away.passesCompleted;
  aggregate.crossesAttempted += result.statistics.home.crossesAttempted + result.statistics.away.crossesAttempted;
  aggregate.crossesCompleted += result.statistics.home.crossesCompleted + result.statistics.away.crossesCompleted;
  aggregate.dribblesAttempted += result.statistics.home.dribblesAttempted + result.statistics.away.dribblesAttempted;
  aggregate.dribblesWon += result.statistics.home.dribblesWon + result.statistics.away.dribblesWon;
  aggregate.tacklesAttempted += result.statistics.home.tacklesAttempted + result.statistics.away.tacklesAttempted;
  aggregate.tacklesWon += result.statistics.home.tacklesWon + result.statistics.away.tacklesWon;
  aggregate.aerialDuels += result.statistics.home.aerialDuels + result.statistics.away.aerialDuels;
  aggregate.goalkeeperInterventions += result.statistics.home.goalkeeperClaims
    + result.statistics.away.goalkeeperClaims
    + result.statistics.home.goalkeeperPunches
    + result.statistics.away.goalkeeperPunches;
  aggregate.saves += result.statistics.home.saves + result.statistics.away.saves;
  for (const player of result.finalState.players) {
    aggregate.totalFinalFatigue += player.fatigue;
    aggregate.maxFinalFatigue = Math.max(aggregate.maxFinalFatigue, player.fatigue);
  }
  aggregate.maxHomeGoals = Math.max(aggregate.maxHomeGoals, homeGoals);
  aggregate.maxAwayGoals = Math.max(aggregate.maxAwayGoals, awayGoals);
  aggregate.maxTotalGoals = Math.max(aggregate.maxTotalGoals, homeGoals + awayGoals);
}

const replayInput = createPrototypeMatchInput("calibration-replay");
const firstReplay = simulateMatch(replayInput);
const secondReplay = simulateMatch(replayInput);
const replayIsExact = JSON.stringify(firstReplay.events) === JSON.stringify(secondReplay.events)
  && JSON.stringify(firstReplay.rngTraces) === JSON.stringify(secondReplay.rngTraces);

console.log(JSON.stringify({
  engineVersion: firstReplay.engineVersion,
  matches: aggregate.matches,
  resultShare: {
    homeWin: Number((aggregate.homeWins / aggregate.matches).toFixed(4)),
    draw: Number((aggregate.draws / aggregate.matches).toFixed(4)),
    awayWin: Number((aggregate.awayWins / aggregate.matches).toFixed(4)),
  },
  averages: {
    homeGoals: Number((aggregate.homeGoals / aggregate.matches).toFixed(4)),
    awayGoals: Number((aggregate.awayGoals / aggregate.matches).toFixed(4)),
    totalGoals: Number(((aggregate.homeGoals + aggregate.awayGoals) / aggregate.matches).toFixed(4)),
    shots: Number((aggregate.shots / aggregate.matches).toFixed(4)),
    headedShots: Number((aggregate.headedShots / aggregate.matches).toFixed(4)),
    passCompletion: Number((aggregate.passesCompleted / aggregate.passesAttempted).toFixed(4)),
    crosses: Number((aggregate.crossesAttempted / aggregate.matches).toFixed(4)),
    crossCompletion: Number((aggregate.crossesCompleted / aggregate.crossesAttempted).toFixed(4)),
    dribbles: Number((aggregate.dribblesAttempted / aggregate.matches).toFixed(4)),
    dribbleSuccess: Number((aggregate.dribblesWon / aggregate.dribblesAttempted).toFixed(4)),
    tackleSuccess: Number((aggregate.tacklesWon / aggregate.tacklesAttempted).toFixed(4)),
    aerialDuels: Number((aggregate.aerialDuels / 2 / aggregate.matches).toFixed(4)),
    goalkeeperCrossInterventions: Number((aggregate.goalkeeperInterventions / aggregate.matches).toFixed(4)),
    saves: Number((aggregate.saves / aggregate.matches).toFixed(4)),
    finalFatiguePerPlayer: Number((aggregate.totalFinalFatigue / aggregate.matches / 22).toFixed(4)),
  },
  extremes: {
    maxHomeGoals: aggregate.maxHomeGoals,
    maxAwayGoals: aggregate.maxAwayGoals,
    maxTotalGoals: aggregate.maxTotalGoals,
    maxFinalFatigue: aggregate.maxFinalFatigue,
  },
  replayIsExact,
}, null, 2));
