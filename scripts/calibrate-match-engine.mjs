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
  passesAttempted: 0,
  passesCompleted: 0,
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
  aggregate.passesAttempted += result.statistics.home.passesAttempted + result.statistics.away.passesAttempted;
  aggregate.passesCompleted += result.statistics.home.passesCompleted + result.statistics.away.passesCompleted;
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
    passCompletion: Number((aggregate.passesCompleted / aggregate.passesAttempted).toFixed(4)),
  },
  extremes: {
    maxHomeGoals: aggregate.maxHomeGoals,
    maxAwayGoals: aggregate.maxAwayGoals,
    maxTotalGoals: aggregate.maxTotalGoals,
  },
  replayIsExact,
}, null, 2));
