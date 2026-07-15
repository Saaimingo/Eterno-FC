import type {
  CanonicalMatchEvent,
  EventAudit,
  MatchEventType,
  MatchPeriod,
  PitchPoint,
  PossessionPhase,
  Score,
} from "./contracts";

const MAX_EVENT_CLOCK_MS = 7_200_000;

export type EventDraft = Readonly<{
  clockMs: number;
  period: MatchPeriod;
  type: MatchEventType;
  teamId: string | null;
  actorId?: string;
  targetId?: string;
  opponentIds?: readonly string[];
  phase?: PossessionPhase;
  origin?: PitchPoint;
  destination?: PitchPoint;
  outcome?: string;
  tags?: readonly string[];
  causes?: readonly string[];
  rngTraceId?: string;
  audit?: EventAudit;
}>;

function freezeScore(home: number, away: number): Score {
  return Object.freeze([home, away]) as Score;
}

function freezePoint(point?: PitchPoint) {
  return point ? Object.freeze({ ...point }) : undefined;
}

function freezeAudit(audit?: EventAudit) {
  if (!audit) return undefined;
  return Object.freeze({
    ...audit,
    components: audit.components ? Object.freeze({ ...audit.components }) : undefined,
    details: audit.details ? Object.freeze({ ...audit.details }) : undefined,
  });
}

function scoresMatch(left: Score, right: Score) {
  return left[0] === right[0] && left[1] === right[1];
}

export class EventLedger {
  readonly #events: CanonicalMatchEvent[] = [];
  readonly #eventIds = new Set<string>();
  #score: [number, number] = [0, 0];
  #closed = false;

  constructor(
    readonly matchId: string,
    readonly homeTeamId: string,
    readonly awayTeamId: string,
  ) {
    if (!matchId || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      throw new Error("Identidade inválida para o EventLedger.");
    }
  }

  append(draft: EventDraft) {
    if (this.#closed) throw new Error("Não é permitido registrar eventos após match_end.");
    if (!Number.isInteger(draft.clockMs) || draft.clockMs < 0 || draft.clockMs > MAX_EVENT_CLOCK_MS) {
      throw new Error("Relógio de evento inválido.");
    }
    if (draft.teamId !== null && draft.teamId !== this.homeTeamId && draft.teamId !== this.awayTeamId) {
      throw new Error(`Equipe desconhecida no evento: ${draft.teamId}.`);
    }

    const previous = this.#events.at(-1);
    if (!previous && (draft.type !== "kickoff" || draft.clockMs !== 0 || draft.period !== 1)) {
      throw new Error("O primeiro evento deve ser o kickoff do primeiro período no instante zero.");
    }
    if (previous && draft.clockMs < previous.clockMs) throw new Error("O relógio do ledger não pode retroceder.");
    if (previous && draft.period < previous.period) throw new Error("O período do ledger não pode retroceder.");

    const causes = Object.freeze([...(draft.causes ?? [])]);
    for (const cause of causes) {
      if (!this.#eventIds.has(cause)) throw new Error(`Causa inexistente ou futura: ${cause}.`);
    }

    const scoreBefore = freezeScore(this.#score[0], this.#score[1]);
    if (draft.type === "goal") {
      if (!draft.teamId) throw new Error("Todo gol deve pertencer a uma equipe.");
      this.#score[draft.teamId === this.homeTeamId ? 0 : 1] += 1;
    }
    const scoreAfter = freezeScore(this.#score[0], this.#score[1]);
    const sequence = this.#events.length + 1;
    const eventId = `${this.matchId}:evt:${String(sequence).padStart(5, "0")}`;
    const event = Object.freeze({
      eventId,
      matchId: this.matchId,
      sequence,
      clockMs: draft.clockMs,
      period: draft.period,
      type: draft.type,
      teamId: draft.teamId,
      actorId: draft.actorId,
      targetId: draft.targetId,
      opponentIds: Object.freeze([...(draft.opponentIds ?? [])]),
      phase: draft.phase,
      origin: freezePoint(draft.origin),
      destination: freezePoint(draft.destination),
      outcome: draft.outcome,
      scoreBefore,
      scoreAfter,
      tags: Object.freeze([...(draft.tags ?? [])]),
      causes,
      rngTraceId: draft.rngTraceId,
      audit: freezeAudit(draft.audit),
    }) satisfies CanonicalMatchEvent;

    this.#events.push(event);
    this.#eventIds.add(eventId);
    if (draft.type === "match_end") this.#closed = true;
    return event;
  }

  score() {
    return freezeScore(this.#score[0], this.#score[1]);
  }

  events() {
    return Object.freeze([...this.#events]);
  }

  assertComplete() {
    assertLedgerInvariants(this.events(), this.homeTeamId, this.awayTeamId);
    const finalEvent = this.#events.at(-1);
    if (finalEvent?.type !== "match_end") throw new Error("Ledger sem encerramento de partida.");
    const periodEnds = this.#events.filter((event) => event.type === "period_end");
    const endedPeriods = periodEnds.map((event) => event.period);
    const regulation = endedPeriods.length === 2 && endedPeriods[0] === 1 && endedPeriods[1] === 2;
    const extraTime = endedPeriods.length === 4
      && endedPeriods.every((period, index) => period === index + 1);
    if (!regulation && !extraTime) {
      throw new Error("Ledger sem encerramento válido dos períodos disputados.");
    }
  }
}

export function assertLedgerInvariants(
  events: readonly CanonicalMatchEvent[],
  homeTeamId: string,
  awayTeamId: string,
) {
  if (events.length === 0) throw new Error("O ledger não pode ser vazio.");
  if (events[0].type !== "kickoff" || events[0].clockMs !== 0 || events[0].period !== 1) {
    throw new Error("O ledger deve começar com kickoff no instante zero do primeiro período.");
  }

  const knownIds = new Set<string>();
  const knownEvents = new Map<string, CanonicalMatchEvent>();
  let score = freezeScore(0, 0);
  let clockMs = 0;
  let period: MatchPeriod = 1;
  let ended = false;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (ended) throw new Error("Há eventos registrados depois de match_end.");
    if (event.sequence !== index + 1) throw new Error("Sequência não contígua no ledger.");
    if (knownIds.has(event.eventId)) throw new Error(`Evento duplicado: ${event.eventId}.`);
    if (event.matchId !== events[0].matchId) throw new Error("Eventos de partidas diferentes no mesmo ledger.");
    if (event.clockMs < clockMs || event.period < period) throw new Error("Ordem temporal inválida no ledger.");
    if (!scoresMatch(event.scoreBefore, score)) throw new Error("score_before diverge do evento anterior.");
    for (const cause of event.causes) {
      if (!knownIds.has(cause)) throw new Error(`Causa não aponta para evento anterior: ${cause}.`);
    }
    const causeTypes = event.causes.map((cause) => knownEvents.get(cause)?.type);
    if (["pass_completed", "pass_failed"].includes(event.type) && !causeTypes.includes("pass_attempt")) {
      throw new Error(`${event.type} deve ser causado por pass_attempt.`);
    }
    if (event.type === "interception" && !causeTypes.includes("pass_failed")) {
      throw new Error("interception deve ser causada por pass_failed.");
    }
    if (event.type === "tackle" && !causeTypes.includes("dribble_attempt")) {
      throw new Error("tackle deve ser causado por dribble_attempt.");
    }
    if (event.type === "dribble_won" && !causeTypes.includes("tackle")) {
      throw new Error("dribble_won deve ser causado por tackle.");
    }
    if (["cross_completed", "cross_failed"].includes(event.type) && !causeTypes.includes("cross_attempt")) {
      throw new Error(`${event.type} deve ser causado por cross_attempt.`);
    }
    if (["goalkeeper_claim", "goalkeeper_punch"].includes(event.type)
      && !causeTypes.some((type) => ["cross_completed", "corner", "free_kick"].includes(type ?? ""))) {
      throw new Error(`${event.type} deve ser causado por cruzamento ou bola parada entregue.`);
    }
    if (event.type === "aerial_duel"
      && !causeTypes.some((type) => ["cross_completed", "corner", "free_kick"].includes(type ?? ""))) {
      throw new Error("aerial_duel deve ser causado por cruzamento ou bola parada entregue.");
    }
    if (["save", "goal"].includes(event.type) && !causeTypes.includes("shot")) {
      throw new Error(`${event.type} deve ser causado por shot.`);
    }
    if (["substitution", "tactical_change"].includes(event.type) && event.causes.length !== 1) {
      throw new Error(`${event.type} deve ter exatamente uma causa anterior.`);
    }
    if (event.type === "substitution"
      && (!event.teamId || !event.actorId || !event.targetId || event.actorId === event.targetId)) {
      throw new Error("substitution deve identificar equipe, jogador que sai e jogador que entra.");
    }
    if (event.type === "tactical_change" && !event.teamId) {
      throw new Error("tactical_change deve pertencer a uma equipe.");
    }
    if (event.type === "foul"
      && (!event.teamId || !event.actorId || !event.targetId || event.actorId === event.targetId || event.causes.length !== 1)) {
      throw new Error("foul deve identificar infrator, vítima e uma causa anterior.");
    }
    if (event.type === "offside" && !causeTypes.includes("pass_attempt")) {
      throw new Error("offside deve ser causado por pass_attempt.");
    }
    if (event.type === "yellow_card" && !causeTypes.includes("foul")) {
      throw new Error("yellow_card deve ser causado por foul.");
    }
    if (event.type === "red_card" && !causeTypes.some((type) => type === "foul" || type === "yellow_card")) {
      throw new Error("red_card deve ser causado por foul ou yellow_card.");
    }
    if (event.type === "free_kick"
      && !causeTypes.some((type) => ["foul", "yellow_card", "red_card"].includes(type ?? ""))) {
      throw new Error("free_kick deve nascer de uma infração disciplinar.");
    }
    if (event.type === "penalty_kick"
      && !causeTypes.some((type) => ["foul", "yellow_card", "red_card"].includes(type ?? ""))) {
      throw new Error("penalty_kick deve nascer de uma infração disciplinar.");
    }
    if (event.type === "corner" && !causeTypes.some((type) => ["cross_failed", "save", "shot"].includes(type ?? ""))) {
      throw new Error("corner deve ser causado por desvio defensivo confirmado.");
    }
    if (event.type === "rebound" && !causeTypes.includes("save")) {
      throw new Error("rebound deve ser causado por save.");
    }
    if (event.type === "stoppage_time" && event.causes.length !== 1) {
      throw new Error("stoppage_time deve ter exatamente uma causa anterior.");
    }
    if (event.type === "shootout_kick"
      && (!event.teamId || !event.actorId || !event.targetId || event.causes.length !== 1)) {
      throw new Error("shootout_kick deve identificar equipe, cobrador, goleiro e uma causa anterior.");
    }
    if (event.type === "shootout_end"
      && (!event.teamId || event.causes.length !== 1 || !causeTypes.includes("shootout_kick"))) {
      throw new Error("shootout_end deve identificar o vencedor e nascer da última cobrança.");
    }
    if (event.type === "match_end"
      && !causeTypes.some((type) => type === "period_end" || type === "shootout_end")) {
      throw new Error("match_end deve ser causado pelo fim de um período ou da disputa por pênaltis.");
    }

    const expectedAfter: Score = event.type === "goal"
      ? event.teamId === homeTeamId
        ? freezeScore(score[0] + 1, score[1])
        : event.teamId === awayTeamId
          ? freezeScore(score[0], score[1] + 1)
          : (() => { throw new Error("Gol associado a equipe inválida."); })()
      : score;
    if (!scoresMatch(event.scoreAfter, expectedAfter)) throw new Error("Alteração de placar inválida.");

    score = event.scoreAfter;
    clockMs = event.clockMs;
    period = event.period;
    knownIds.add(event.eventId);
    knownEvents.set(event.eventId, event);
    ended = event.type === "match_end";
  }
}

export function traceCausalChain(events: readonly CanonicalMatchEvent[], eventId: string) {
  const byId = new Map(events.map((event) => [event.eventId, event]));
  if (!byId.has(eventId)) throw new Error(`Evento desconhecido: ${eventId}.`);
  const visited = new Set<string>();
  const ordered: CanonicalMatchEvent[] = [];

  function visit(currentId: string) {
    if (visited.has(currentId)) return;
    const event = byId.get(currentId);
    if (!event) throw new Error(`Cadeia causal quebrada em ${currentId}.`);
    for (const cause of event.causes) visit(cause);
    visited.add(currentId);
    ordered.push(event);
  }

  visit(eventId);
  return Object.freeze(ordered);
}
