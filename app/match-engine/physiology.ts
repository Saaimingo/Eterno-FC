import type {
  MatchContext,
  MatchPeriod,
  MatchPlayer,
  PossessionPhase,
  Score,
} from "./contracts";

const MATCH_DURATION_MS = 5_400_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export class FatigueTracker {
  readonly #fatigue = new Map<string, number>();

  constructor(players: readonly MatchPlayer[]) {
    for (const player of players) {
      this.#fatigue.set(player.id, clamp((100 - player.condition) * 0.22, 0, 100));
    }
  }

  value(player: MatchPlayer) {
    return this.#fatigue.get(player.id) ?? 0;
  }

  exert(player: MatchPlayer, load: number) {
    const current = this.value(player);
    const staminaFactor = 1.22 - player.attributes.stamina / 230;
    const fitnessFactor = 1.08 - player.attributes.naturalFitness / 900;
    const increment = Math.max(0, load) * staminaFactor * fitnessFactor;
    const next = clamp(current + increment, 0, 100);
    this.#fatigue.set(player.id, next);
    return next;
  }

  exertMany(players: readonly MatchPlayer[], load: number) {
    for (const player of players) this.exert(player, load);
  }

}

const PHASE_PRESSURE: Record<PossessionPhase, number> = {
  restart: 8,
  buildup: 18,
  progression: 29,
  creation: 42,
  danger: 58,
  transition: 36,
};

export function calculateActionPressure(input: {
  context: MatchContext;
  period: MatchPeriod;
  clockMs: number;
  phase: PossessionPhase;
  score: Score;
  attackingTeamId: string;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const {
    context,
    clockMs,
    phase,
    score,
    attackingTeamId,
    homeTeamId,
    awayTeamId,
  } = input;
  const elapsed = clamp(clockMs / MATCH_DURATION_MS, 0, 1);
  const closeGame = Math.abs(score[0] - score[1]) <= 1;
  const latePressure = elapsed > 0.72 && closeGame ? (elapsed - 0.72) * 72 : 0;
  const attackingScore = attackingTeamId === homeTeamId
    ? score[0]
    : attackingTeamId === awayTeamId
      ? score[1]
      : 0;
  const defendingScore = attackingTeamId === homeTeamId ? score[1] : score[0];
  const trailingPressure = attackingScore < defendingScore ? 7 : 0;

  return Number(clamp(
    PHASE_PRESSURE[phase]
      + context.importance * 0.18
      + latePressure
      + trailingPressure,
    0,
    100,
  ).toFixed(2));
}
