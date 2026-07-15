import { buildLegacyMatchPlan, createNewGame, nextUserFixture } from "../app/game.ts";
import { runShadowMatch } from "../app/match-adapter.ts";

const requestedMatches = Number(process.argv[2] ?? 250);
if (!Number.isInteger(requestedMatches) || requestedMatches < 1 || requestedMatches > 2_000) {
  throw new Error("Informe uma quantidade inteira entre 1 e 2000 partidas.");
}

const sample = {
  ready: 0,
  failed: 0,
  outcomeAgreement: 0,
  legacyGoals: 0,
  candidateGoals: 0,
  legacyShots: 0,
  candidateShots: 0,
  absolutePossessionDelta: 0,
  exactReplays: 0,
};

for (let index = 0; index < requestedMatches; index += 1) {
  const game = createNewGame("Calibrador", "florianopolis", `shadow-calibration-${index}`);
  const scheduledFixture = nextUserFixture(game);
  if (!scheduledFixture) throw new Error("Carreira de calibração sem partida.");
  const fixture = { ...scheduledFixture, id: `${scheduledFixture.id}-shadow-${index}` };
  const legacy = buildLegacyMatchPlan(game, fixture);
  const first = runShadowMatch(
    game,
    fixture,
    [legacy.homeGoals, legacy.awayGoals],
    [legacy.homeShots, legacy.awayShots],
    legacy.homePossession,
  );
  const replay = runShadowMatch(
    game,
    fixture,
    [legacy.homeGoals, legacy.awayGoals],
    [legacy.homeShots, legacy.awayShots],
    legacy.homePossession,
  );
  if (first.status === "failed" || !first.candidateScore || !first.shotDelta) {
    sample.failed += 1;
    continue;
  }
  sample.ready += 1;
  sample.outcomeAgreement += Number(first.outcomeAgreement);
  sample.legacyGoals += legacy.homeGoals + legacy.awayGoals;
  sample.candidateGoals += first.candidateScore[0] + first.candidateScore[1];
  sample.legacyShots += legacy.homeShots + legacy.awayShots;
  sample.candidateShots += legacy.homeShots + legacy.awayShots + first.shotDelta[0] + first.shotDelta[1];
  sample.absolutePossessionDelta += Math.abs(first.possessionDelta ?? 0);
  sample.exactReplays += Number(first.candidateFingerprint === replay.candidateFingerprint);
}

const divisor = Math.max(1, sample.ready);
console.log(JSON.stringify({
  matches: requestedMatches,
  ready: sample.ready,
  failed: sample.failed,
  outcomeAgreement: Number((sample.outcomeAgreement / divisor).toFixed(4)),
  goalsPerMatch: {
    legacy: Number((sample.legacyGoals / divisor).toFixed(4)),
    candidate: Number((sample.candidateGoals / divisor).toFixed(4)),
  },
  shotsPerMatch: {
    legacy: Number((sample.legacyShots / divisor).toFixed(4)),
    candidate: Number((sample.candidateShots / divisor).toFixed(4)),
  },
  meanAbsolutePossessionDelta: Number((sample.absolutePossessionDelta / divisor).toFixed(4)),
  exactReplayRate: Number((sample.exactReplays / divisor).toFixed(4)),
}, null, 2));
