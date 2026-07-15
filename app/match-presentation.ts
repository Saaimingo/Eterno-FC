import { clamp } from "./domain/random";
import type {
  Fixture,
  GameState,
  MatchEvent,
  MatchEventType,
  MatchPhase,
  MatchPlan,
  PitchCoordinate,
  ShadowMatchComparison,
} from "./domain/types";
import type { CanonicalMatchEvent, MatchResult } from "./match-engine";

const DISPLAY_EVENT_TYPES = new Set([
  "kickoff",
  "dribble_won",
  "cross_completed",
  "goalkeeper_claim",
  "goalkeeper_punch",
  "foul",
  "yellow_card",
  "red_card",
  "offside",
  "free_kick",
  "corner",
  "penalty_kick",
  "shot",
  "save",
  "rebound",
  "goal",
  "substitution",
  "tactical_change",
  "stoppage_time",
  "period_end",
  "shootout_kick",
  "shootout_end",
  "match_end",
]);

function scoreOutcome(score: readonly [number, number]) {
  return score[0] > score[1] ? "home" : score[0] < score[1] ? "away" : "draw";
}

function isSingleLegKnockout(game: GameState, fixture: Fixture) {
  const competition = game.competitions.find((candidate) => candidate.id === fixture.competitionId);
  return Boolean(
    competition
      && (competition.type === "cup" || competition.type === "continental")
      && fixture.stage !== "Fase de grupos"
      && !fixture.tieId,
  );
}

export function candidateCanDriveMatch(game: GameState, fixture: Fixture, result: MatchResult) {
  const finalEvent = result.events.at(-1);
  const score = result.finalState.score;
  const goalCount = result.events.filter((event) => event.type === "goal").length;
  const validLedger = finalEvent?.type === "match_end"
    && finalEvent.scoreAfter[0] === score[0]
    && finalEvent.scoreAfter[1] === score[1]
    && goalCount === score[0] + score[1]
    && result.statistics.home.goals === score[0]
    && result.statistics.away.goals === score[1];
  if (!validLedger) return false;
  const decisionWinner = result.decision.winnerTeamId;
  const winnerBelongsToMatch = !decisionWinner || decisionWinner === fixture.homeId || decisionWinner === fixture.awayId;
  if (!winnerBelongsToMatch) return false;
  if (scoreOutcome(score) === "home" && decisionWinner !== fixture.homeId) return false;
  if (scoreOutcome(score) === "away" && decisionWinner !== fixture.awayId) return false;
  if (isSingleLegKnockout(game, fixture)) {
    if (!decisionWinner || result.decision.method === "draw") return false;
    if (result.decision.method === "penalties") {
      const shootoutEnd = result.events.find((event) => event.type === "shootout_end");
      if (!shootoutEnd || shootoutEnd.teamId !== decisionWinner || !result.decision.shootoutScore) return false;
    }
  } else if (scoreOutcome(score) === "draw" && (decisionWinner || result.decision.method !== "draw")) return false;
  return true;
}

function minuteFor(event: CanonicalMatchEvent) {
  const natural = Math.max(1, Math.floor(event.clockMs / 60_000) + 1);
  if (event.period === 1) return Math.min(45, natural);
  if (event.period === 2) return Math.min(90, natural);
  if (event.period === 3) return Math.min(105, Math.max(91, natural));
  return Math.min(120, Math.max(106, natural));
}

function minuteLabelFor(event: CanonicalMatchEvent) {
  if (event.type === "shootout_kick") return `PÊN. ${Number(event.audit?.details?.teamKick ?? 1)}`;
  if (event.type === "shootout_end") return "PÊN.";
  const minute = minuteFor(event);
  const periodEnd = event.period === 1 ? 45 : event.period === 2 ? 90 : event.period === 3 ? 105 : 120;
  const periodEndMs = event.period === 1 ? 2_700_000 : event.period === 2 ? 5_400_000 : event.period === 3 ? 6_300_000 : 7_200_000;
  const stoppage = event.tags.includes("stoppage_time")
    || (periodEndMs - event.clockMs < 9_000 && !["period_end", "match_end"].includes(event.type));
  return stoppage ? `${periodEnd}+'` : `${minute}'`;
}

function normalizePoint(point: CanonicalMatchEvent["origin"], event: CanonicalMatchEvent, fixture: Fixture): PitchCoordinate | undefined {
  if (!point) return undefined;
  const mirroredX = event.teamId === fixture.awayId ? 100 - point.x : point.x;
  return Object.freeze({ x: clamp(mirroredX, 1.5, 98.5), y: clamp(point.y, 3, 97) });
}

function displayType(event: CanonicalMatchEvent): MatchEventType {
  if (event.type === "goal") return "goal";
  if (event.type === "yellow_card" || event.type === "red_card") return "card";
  if (event.type === "foul" || event.type === "free_kick") return "foul";
  if (event.type === "offside") return "offside";
  if (["save", "goalkeeper_claim", "goalkeeper_punch"].includes(event.type)) return "save";
  if (event.type === "corner") return "corner";
  if (event.type === "penalty_kick") return "penalty";
  if (event.type === "rebound") return "rebound";
  if (event.type === "substitution") return "substitution";
  if (event.type === "shootout_kick" || event.type === "shootout_end") return "shootout";
  if (["shot", "dribble_won", "cross_completed"].includes(event.type)) return "chance";
  return "comment";
}

function findCreator(goal: CanonicalMatchEvent, eventsById: ReadonlyMap<string, CanonicalMatchEvent>) {
  const pending = [...goal.causes];
  const visited = new Set<string>();
  let depth = 0;
  while (pending.length && depth < 8) {
    const eventId = pending.shift()!;
    if (visited.has(eventId)) continue;
    visited.add(eventId);
    const cause = eventsById.get(eventId);
    if (!cause) continue;
    if (["pass_completed", "cross_completed"].includes(cause.type)
      && cause.teamId === goal.teamId
      && cause.actorId
      && cause.actorId !== goal.actorId) return cause.actorId;
    pending.push(...cause.causes);
    depth += 1;
  }
  return undefined;
}

function narration(
  event: CanonicalMatchEvent,
  game: GameState,
  fixture: Fixture,
  eventsById: ReadonlyMap<string, CanonicalMatchEvent>,
) {
  const playerName = (id?: string) => game.players.find((player) => player.id === id)?.name ?? "um jogador";
  const teamName = game.clubs.find((club) => club.id === event.teamId)?.name ?? "a equipe";
  const actor = playerName(event.actorId);
  const target = playerName(event.targetId);
  if (event.type === "kickoff") {
    if (event.outcome === "restarted_after_goal") return `${teamName} recoloca a bola em jogo.`;
    if (event.period === 1) return "A bola está rolando.";
    if (event.period === 2) return "Começa o segundo tempo.";
    if (event.period === 3) return "Começa a prorrogação.";
    return "Começa o segundo tempo da prorrogação.";
  }
  if (event.type === "goal") {
    const creator = findCreator(event, eventsById);
    const finish = event.tags.includes("header")
      ? "ganha pelo alto e testa para a rede"
      : event.tags.includes("penalty")
        ? "desloca o goleiro na cobrança"
        : event.tags.includes("free_kick")
          ? "acerta uma cobrança perfeita"
          : "finaliza a jogada e balança a rede";
    return `GOOOL DO ${teamName.toUpperCase()}! ${actor} ${finish}${creator ? `, após passe de ${playerName(creator)}` : ""}.`;
  }
  if (event.type === "shot") {
    if (event.outcome === "on_target") return `${actor} finaliza no alvo. A defesa precisa responder.`;
    if (event.outcome === "deflected_out") return `${actor} bate, a bola desvia e sai para escanteio.`;
    return `${actor} arrisca, mas a bola passa para fora.`;
  }
  if (event.type === "save") return event.outcome === "parried"
    ? `${actor} espalma! A bola continua viva na área.`
    : `${actor} segura firme e encerra o perigo.`;
  if (event.type === "goalkeeper_claim") return `${actor} sai do gol e fica com o cruzamento.`;
  if (event.type === "goalkeeper_punch") return `${actor} soca a bola para longe da área.`;
  if (event.type === "foul") return `${actor} interrompe ${target} com falta.`;
  if (event.type === "yellow_card") return `Cartão amarelo para ${actor}.`;
  if (event.type === "red_card") return event.outcome === "second_yellow"
    ? `EXPULSO! ${actor} recebe o segundo amarelo e deixa o campo.`
    : `CARTÃO VERMELHO! ${actor} está expulso.`;
  if (event.type === "offside") return `${actor} é flagrado em impedimento.`;
  if (event.type === "free_kick") return event.outcome === "direct"
    ? `${actor} posiciona a bola para uma falta perigosa.`
    : `${teamName} cobra a falta curta e reorganiza o ataque.`;
  if (event.type === "corner") return `Escanteio para ${teamName}. ${actor} vai para a cobrança.`;
  if (event.type === "penalty_kick") return `PÊNALTI PARA ${teamName.toUpperCase()}! ${actor} assume a responsabilidade.`;
  if (event.type === "rebound") return event.outcome === "attacker_recovered"
    ? `${teamName} fica com a sobra e ganha uma segunda chance.`
    : `A defesa afasta a sobra da área.`;
  if (event.type === "dribble_won") return `${actor} vence o marcador no drible e acelera a jogada.`;
  if (event.type === "cross_completed") return `${actor} encontra espaço e coloca a bola na área.`;
  if (event.type === "substitution") return `${playerName(event.targetId)} entra no lugar de ${actor}.`;
  if (event.type === "tactical_change") return `${teamName} muda seu desenho tático.`;
  if (event.type === "shootout_kick") {
    if (event.outcome === "scored") return `${actor} converte a cobrança para ${teamName}.`;
    if (event.outcome === "saved") return `${target} defende a cobrança de ${actor}!`;
    return `${actor} manda para fora na disputa por pênaltis.`;
  }
  if (event.type === "shootout_end") return `${teamName.toUpperCase()} VENCE A DISPUTA POR PÊNALTIS!`;
  if (event.type === "stoppage_time") {
    const seconds = Number(event.audit?.details?.addedSeconds ?? 0);
    return `A arbitragem indica ${Math.max(1, Math.round(seconds / 60))} minuto(s) de acréscimo.`;
  }
  if (event.type === "period_end") {
    if (event.period === 1) return "Fim do primeiro tempo.";
    if (event.period === 2) return event.tags.includes("extra_time_required") ? "Fim do tempo regulamentar. Teremos prorrogação." : "Fim do tempo regulamentar.";
    if (event.period === 3) return "Intervalo da prorrogação.";
    return "Fim da prorrogação.";
  }
  if (event.type === "match_end") return event.tags.includes("penalty_shootout")
    ? "Fim de jogo após a disputa por pênaltis."
    : event.tags.includes("extra_time") ? "Fim de jogo após a prorrogação." : "Apita o árbitro. Fim de jogo.";
  return `${teamName} avança e mantém a pressão.`;
}

function projectEvents(game: GameState, fixture: Fixture, result: MatchResult) {
  const byId = new Map(result.events.map((event) => [event.eventId, event]));
  return Object.freeze(result.events.filter((event) => DISPLAY_EVENT_TYPES.has(event.type)).map((event) => {
    const assistPlayerId = event.type === "goal" ? findCreator(event, byId) : undefined;
    return Object.freeze({
      id: event.eventId,
      sequence: event.sequence,
      minute: minuteFor(event),
      minuteLabel: minuteLabelFor(event),
      type: displayType(event),
      teamId: event.teamId ?? fixture.homeId,
      playerId: event.actorId,
      assistPlayerId,
      text: narration(event, game, fixture, byId),
      detail: event.type,
      origin: normalizePoint(event.origin, event, fixture),
      destination: normalizePoint(event.destination, event, fixture),
      scoreAfter: event.scoreAfter,
    }) satisfies MatchEvent;
  }));
}

function zoneFor(event: CanonicalMatchEvent): MatchPhase["zone"] {
  if (event.phase === "danger" || event.phase === "creation") return "ataque";
  if (event.phase === "progression" || event.phase === "transition") return "meio";
  return "saída";
}

function projectPhases(fixture: Fixture, result: MatchResult): readonly MatchPhase[] {
  const timeline = result.events.filter((event) => event.teamId && event.type !== "period_end" && event.type !== "match_end");
  const playerIndexes = new Map([
    ...result.input.home.players.map((player, index) => [player.id, index] as const),
    ...result.input.away.players.map((player, index) => [player.id, index] as const),
  ]);
  const phases: MatchPhase[] = [];
  let cursor = 0;
  let current = timeline[0];
  const durationMinutes = result.decision.method === "extra_time" || result.decision.method === "penalties" ? 120 : 90;
  for (let minute = 1; minute <= durationMinutes; minute += 1) {
    while (cursor < timeline.length && minuteFor(timeline[cursor]) <= minute) {
      current = timeline[cursor];
      cursor += 1;
    }
    const teamId = current?.teamId ?? fixture.homeId;
    const carrierId = current?.actorId && playerIndexes.has(current.actorId)
      ? current.actorId
      : current?.targetId && playerIndexes.has(current.targetId)
        ? current.targetId
        : undefined;
    const origin = current ? normalizePoint(current.origin, current, fixture) : undefined;
    const destination = current ? normalizePoint(current.destination, current, fixture) : undefined;
    const defaultBall = teamId === fixture.homeId
      ? { x: zoneFor(current) === "ataque" ? 78 : zoneFor(current) === "meio" ? 53 : 27, y: 50 }
      : { x: zoneFor(current) === "ataque" ? 22 : zoneFor(current) === "meio" ? 47 : 73, y: 50 };
    phases.push(Object.freeze({
      start: minute - 1,
      end: minute,
      teamId,
      zone: zoneFor(current),
      carrier: carrierId ? playerIndexes.get(carrierId) ?? 1 : 1,
      carrierId,
      eventId: current?.eventId,
      ball: destination ?? origin ?? defaultBall,
    }));
  }
  return Object.freeze(phases);
}

export function projectVNextMatchPlan(
  game: GameState,
  fixture: Fixture,
  result: MatchResult,
  shadow: ShadowMatchComparison,
): MatchPlan {
  if (!candidateCanDriveMatch(game, fixture, result)) {
    throw new Error("A timeline candidata não passou pelo portão de promoção desta partida.");
  }
  const score = result.finalState.score;
  const events = projectEvents(game, fixture, result);
  const goals = events.filter((event) => event.type === "goal");
  if (goals.length !== score[0] + score[1]) throw new Error("A apresentação perdeu um gol canônico.");
  return Object.freeze({
    fixtureId: fixture.id,
    engineSource: "vnext",
    engineVersion: result.engineVersion,
    homeGoals: score[0],
    awayGoals: score[1],
    durationMinutes: result.decision.method === "extra_time" || result.decision.method === "penalties" ? 120 : 90,
    decisionMethod: result.decision.method,
    winnerTeamId: result.decision.winnerTeamId ?? undefined,
    shootoutScore: result.decision.shootoutScore,
    events,
    phases: projectPhases(fixture, result),
    homePossession: Math.round(result.statistics.home.possessionPercentage),
    homeShots: result.statistics.home.shots,
    awayShots: result.statistics.away.shots,
    homeCorners: result.statistics.home.corners,
    awayCorners: result.statistics.away.corners,
    homeCards: result.statistics.home.yellowCards + result.statistics.home.redCards,
    awayCards: result.statistics.away.yellowCards + result.statistics.away.redCards,
    shadow,
  });
}
