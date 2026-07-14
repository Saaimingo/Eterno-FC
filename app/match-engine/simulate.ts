import {
  MATCH_ENGINE_VERSION,
  type CanonicalMatchEvent,
  type MatchInput,
  type MatchPeriod,
  type MatchPlayer,
  type MatchResult,
  type MatchState,
  type PitchPoint,
  type PossessionPhase,
  type TeamSnapshot,
  validateMatchInput,
} from "./contracts";
import { EventLedger } from "./ledger";
import {
  calculateGoalProbability,
  calculatePassProbability,
  calculateShotOnTargetProbability,
  calculateTeamControl,
} from "./probabilities";
import { SeededRng } from "./rng";
import { projectStatistics } from "./statistics";

const PERIOD_DURATION_MS = 2_700_000;
const MATCH_DURATION_MS = PERIOD_DURATION_MS * 2;
const PASS_PHASES: readonly PossessionPhase[] = ["buildup", "progression", "creation"];
const PHASE_X: Record<PossessionPhase, number> = {
  restart: 8,
  buildup: 24,
  progression: 50,
  creation: 73,
  danger: 88,
  transition: 42,
};

function laneFor(player: MatchPlayer) {
  const hash = [...player.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return 18 + hash % 65;
}

function pointFor(player: MatchPlayer, phase: PossessionPhase): PitchPoint {
  return Object.freeze({ x: PHASE_X[phase], y: laneFor(player) });
}

function attackingHomeAdvantage(team: TeamSnapshot, input: MatchInput) {
  return team.id === input.home.id ? input.context.homeAdvantage : 0;
}

function receiverWeight(player: MatchPlayer, phase: PossessionPhase) {
  const positionBonus = phase === "buildup"
    ? ["CB", "LB", "RB", "DM", "CM"].includes(player.position) ? 38 : 4
    : phase === "progression"
      ? ["DM", "CM", "AM", "LW", "RW"].includes(player.position) ? 38 : 6
      : ["AM", "LW", "RW", "ST"].includes(player.position) ? 44 : 3;
  return 8 + positionBonus + player.attributes.offBall * 0.45 + player.attributes.firstTouch * 0.25;
}

function defenderWeight(player: MatchPlayer, phase: PossessionPhase) {
  if (player.position === "GK") return 0;
  const positionBonus = phase === "buildup"
    ? ["ST", "AM", "LW", "RW"].includes(player.position) ? 34 : 8
    : phase === "progression"
      ? ["DM", "CM", "AM", "LB", "RB"].includes(player.position) ? 36 : 10
      : ["DM", "CB", "LB", "RB"].includes(player.position) ? 44 : 5;
  return 8 + positionBonus + player.attributes.positioning * 0.35 + player.attributes.anticipation * 0.25;
}

function pickInitialCarrier(team: TeamSnapshot, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK");
  return rng.weightedPick(
    candidates,
    (player) => 10
      + (["CB", "DM", "CM"].includes(player.position) ? 45 : 5)
      + player.attributes.decisions * 0.25
      + player.attributes.passing * 0.2,
    label,
  ).item;
}

function pickReceiver(
  team: TeamSnapshot,
  carrier: MatchPlayer,
  phase: PossessionPhase,
  rng: SeededRng,
  label: string,
) {
  const candidates = team.players.filter((player) => player.position !== "GK" && player.id !== carrier.id);
  return rng.weightedPick(candidates, (player) => receiverWeight(player, phase), label).item;
}

function pickDefender(team: TeamSnapshot, phase: PossessionPhase, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK");
  return rng.weightedPick(candidates, (player) => defenderWeight(player, phase), label).item;
}

function opponentOf(team: TeamSnapshot, input: MatchInput) {
  return team.id === input.home.id ? input.away : input.home;
}

function selectPossessionTeam(input: MatchInput, rng: SeededRng, label: string) {
  const homeControl = calculateTeamControl(input.home) + input.context.homeAdvantage * 0.8;
  const awayControl = calculateTeamControl(input.away);
  return rng.weightedPick(
    [input.home, input.away],
    (team) => team.id === input.home.id ? homeControl : awayControl,
    label,
  ).item;
}

function auditComponents(breakdown: { attack: number; defense: number; context: number }) {
  return Object.freeze({
    attack: Number(breakdown.attack.toFixed(4)),
    defense: Number(breakdown.defense.toFixed(4)),
    context: Number(breakdown.context.toFixed(6)),
  });
}

function simulatePossession(input: {
  matchInput: MatchInput;
  ledger: EventLedger;
  rng: SeededRng;
  team: TeamSnapshot;
  period: MatchPeriod;
  clockMs: number;
  causeEventId: string;
  possessionIndex: number;
}) {
  const { matchInput, ledger, rng, team, period, possessionIndex } = input;
  const opponent = opponentOf(team, matchInput);
  let clockMs = input.clockMs;
  let carrier = pickInitialCarrier(team, rng, `p${period}.${possessionIndex}.carrier`);
  const possession = ledger.append({
    clockMs,
    period,
    type: "possession_start",
    teamId: team.id,
    actorId: carrier.id,
    phase: "restart",
    origin: pointFor(carrier, "restart"),
    outcome: "controlled",
    tags: ["possession"],
    causes: [input.causeEventId],
  });
  let causeEventId = possession.eventId;

  for (const phase of PASS_PHASES) {
    clockMs += 650;
    const receiver = pickReceiver(team, carrier, phase, rng, `p${period}.${possessionIndex}.${phase}.receiver`);
    const defender = pickDefender(opponent, phase, rng, `p${period}.${possessionIndex}.${phase}.defender`);
    const breakdown = calculatePassProbability({
      passer: carrier,
      receiver,
      defender,
      phase,
      tactics: team.tactics,
      homeAdvantage: attackingHomeAdvantage(team, matchInput),
    });
    const chance = rng.chance(breakdown.probability, `p${period}.${possessionIndex}.${phase}.pass`);
    const attempt = ledger.append({
      clockMs,
      period,
      type: "pass_attempt",
      teamId: team.id,
      actorId: carrier.id,
      targetId: receiver.id,
      opponentIds: [defender.id],
      phase,
      origin: pointFor(carrier, phase === "buildup" ? "restart" : PASS_PHASES[PASS_PHASES.indexOf(phase) - 1]),
      destination: pointFor(receiver, phase),
      outcome: chance.success ? "executed" : "misplaced",
      tags: [phase],
      causes: [causeEventId],
      rngTraceId: chance.traceId,
      audit: {
        probability: chance.probability,
        roll: chance.roll,
        components: auditComponents(breakdown),
      },
    });
    clockMs += 650;

    if (!chance.success) {
      const failed = ledger.append({
        clockMs,
        period,
        type: "pass_failed",
        teamId: team.id,
        actorId: carrier.id,
        targetId: receiver.id,
        opponentIds: [defender.id],
        phase,
        destination: pointFor(defender, phase),
        outcome: "intercepted",
        tags: [phase, "turnover"],
        causes: [attempt.eventId],
        rngTraceId: chance.traceId,
      });
      clockMs += 650;
      const interception = ledger.append({
        clockMs,
        period,
        type: "interception",
        teamId: opponent.id,
        actorId: defender.id,
        targetId: carrier.id,
        opponentIds: [receiver.id],
        phase: "transition",
        origin: pointFor(defender, phase),
        outcome: "won",
        tags: ["turnover"],
        causes: [failed.eventId],
        rngTraceId: chance.traceId,
      });
      return Object.freeze({ terminalEvent: interception, goalTeamId: null });
    }

    const completed = ledger.append({
      clockMs,
      period,
      type: "pass_completed",
      teamId: team.id,
      actorId: carrier.id,
      targetId: receiver.id,
      opponentIds: [defender.id],
      phase,
      origin: pointFor(carrier, phase === "buildup" ? "restart" : PASS_PHASES[PASS_PHASES.indexOf(phase) - 1]),
      destination: pointFor(receiver, phase),
      outcome: "completed",
      tags: [phase],
      causes: [attempt.eventId],
      rngTraceId: chance.traceId,
    });
    carrier = receiver;
    causeEventId = completed.eventId;
  }

  clockMs += 700;
  const marker = pickDefender(opponent, "creation", rng, `p${period}.${possessionIndex}.shot.marker`);
  const shotBreakdown = calculateShotOnTargetProbability({
    shooter: carrier,
    marker,
    tactics: team.tactics,
    homeAdvantage: attackingHomeAdvantage(team, matchInput),
  });
  const onTarget = rng.chance(shotBreakdown.probability, `p${period}.${possessionIndex}.shot.on_target`);
  const goalkeeper = opponent.players.find((player) => player.position === "GK");
  if (!goalkeeper) throw new Error(`${opponent.name} está sem goleiro.`);
  const shot = ledger.append({
    clockMs,
    period,
    type: "shot",
    teamId: team.id,
    actorId: carrier.id,
    targetId: goalkeeper.id,
    opponentIds: [marker.id, goalkeeper.id],
    phase: "danger",
    origin: pointFor(carrier, "danger"),
    destination: Object.freeze({ x: 100, y: 50 }),
    outcome: onTarget.success ? "on_target" : "off_target",
    tags: ["dangerous_attack"],
    causes: [causeEventId],
    rngTraceId: onTarget.traceId,
    audit: {
      probability: onTarget.probability,
      roll: onTarget.roll,
      components: auditComponents(shotBreakdown),
    },
  });
  if (!onTarget.success) return Object.freeze({ terminalEvent: shot, goalTeamId: null });

  clockMs += 700;
  const goalBreakdown = calculateGoalProbability({
    shooter: carrier,
    goalkeeper,
    homeAdvantage: attackingHomeAdvantage(team, matchInput),
  });
  const goalChance = rng.chance(goalBreakdown.probability, `p${period}.${possessionIndex}.shot.goal`);
  if (goalChance.success) {
    const goal = ledger.append({
      clockMs,
      period,
      type: "goal",
      teamId: team.id,
      actorId: carrier.id,
      targetId: goalkeeper.id,
      opponentIds: [marker.id, goalkeeper.id],
      phase: "danger",
      destination: Object.freeze({ x: 100, y: 50 }),
      outcome: "scored",
      tags: ["dangerous_attack", "confirmed_goal"],
      causes: [shot.eventId],
      rngTraceId: goalChance.traceId,
      audit: {
        probability: goalChance.probability,
        roll: goalChance.roll,
        components: auditComponents(goalBreakdown),
      },
    });
    return Object.freeze({ terminalEvent: goal, goalTeamId: team.id });
  }

  const save = ledger.append({
    clockMs,
    period,
    type: "save",
    teamId: opponent.id,
    actorId: goalkeeper.id,
    targetId: carrier.id,
    opponentIds: [carrier.id],
    phase: "danger",
    origin: Object.freeze({ x: 100, y: 50 }),
    outcome: "saved",
    tags: ["save"],
    causes: [shot.eventId],
    rngTraceId: goalChance.traceId,
    audit: {
      probability: 1 - goalChance.probability,
      roll: 1 - goalChance.roll,
      components: auditComponents(goalBreakdown),
    },
  });
  return Object.freeze({ terminalEvent: save, goalTeamId: null });
}

function buildPlayerStates(input: MatchInput, events: readonly CanonicalMatchEvent[]) {
  const actions = new Map<string, number>();
  for (const event of events) {
    if (event.actorId) actions.set(event.actorId, (actions.get(event.actorId) ?? 0) + 1);
  }
  return Object.freeze([...input.home.players, ...input.away.players].map((player) => Object.freeze({
    playerId: player.id,
    fatigue: Number(Math.min(100, (actions.get(player.id) ?? 0) * (105 - player.attributes.stamina) / 80).toFixed(2)),
  })));
}

function buildResult(input: MatchInput, ledger: EventLedger, rng: SeededRng): MatchResult {
  ledger.assertComplete();
  const events = ledger.events();
  const finalState: MatchState = Object.freeze({
    engineVersion: MATCH_ENGINE_VERSION,
    status: "finished",
    period: 2,
    clockMs: MATCH_DURATION_MS,
    score: ledger.score(),
    possessionTeamId: null,
    players: buildPlayerStates(input, events),
  });
  return Object.freeze({
    engineVersion: MATCH_ENGINE_VERSION,
    input,
    finalState,
    events,
    rngTraces: rng.traces(),
    statistics: projectStatistics(events, input.home.id, input.away.id),
  });
}

export function simulateEmptyMatch(input: MatchInput): MatchResult {
  validateMatchInput(input);
  const ledger = new EventLedger(input.context.matchId, input.home.id, input.away.id);
  const rng = new SeededRng(input.context.seed);
  const firstKickoff = ledger.append({
    clockMs: 0,
    period: 1,
    type: "kickoff",
    teamId: input.home.id,
    phase: "restart",
    outcome: "started",
  });
  const firstEnd = ledger.append({
    clockMs: PERIOD_DURATION_MS,
    period: 1,
    type: "period_end",
    teamId: null,
    outcome: "ended",
    causes: [firstKickoff.eventId],
  });
  const secondKickoff = ledger.append({
    clockMs: PERIOD_DURATION_MS,
    period: 2,
    type: "kickoff",
    teamId: input.away.id,
    phase: "restart",
    outcome: "started",
    causes: [firstEnd.eventId],
  });
  const secondEnd = ledger.append({
    clockMs: MATCH_DURATION_MS,
    period: 2,
    type: "period_end",
    teamId: null,
    outcome: "ended",
    causes: [secondKickoff.eventId],
  });
  ledger.append({
    clockMs: MATCH_DURATION_MS,
    period: 2,
    type: "match_end",
    teamId: null,
    outcome: "finished",
    causes: [secondEnd.eventId],
  });
  return buildResult(input, ledger, rng);
}

export function simulateMatch(input: MatchInput): MatchResult {
  validateMatchInput(input);
  const ledger = new EventLedger(input.context.matchId, input.home.id, input.away.id);
  const rng = new SeededRng(input.context.seed);
  let previousEvent: CanonicalMatchEvent | undefined;

  for (const period of [1, 2] as const) {
    const periodStart = (period - 1) * PERIOD_DURATION_MS;
    const kickoffTeam = period === 1 ? input.home : input.away;
    const kickoff = ledger.append({
      clockMs: periodStart,
      period,
      type: "kickoff",
      teamId: kickoffTeam.id,
      phase: "restart",
      outcome: "started",
      causes: previousEvent ? [previousEvent.eventId] : [],
    });
    previousEvent = kickoff;
    let forcedPossessionTeam: TeamSnapshot | null = kickoffTeam;

    for (let index = 0; index < input.context.possessionsPerPeriod; index += 1) {
      const possessionClock = periodStart + Math.floor((index + 0.5) * PERIOD_DURATION_MS / input.context.possessionsPerPeriod);
      let possessionTeam = forcedPossessionTeam
        ?? selectPossessionTeam(input, rng, `p${period}.${index}.possession_team`);

      if (previousEvent.type === "goal") {
        possessionTeam = previousEvent.teamId === input.home.id ? input.away : input.home;
        previousEvent = ledger.append({
          clockMs: possessionClock,
          period,
          type: "kickoff",
          teamId: possessionTeam.id,
          phase: "restart",
          outcome: "restarted_after_goal",
          tags: ["restart_after_goal"],
          causes: [previousEvent.eventId],
        });
      }

      const result = simulatePossession({
        matchInput: input,
        ledger,
        rng,
        team: possessionTeam,
        period,
        clockMs: previousEvent.type === "kickoff" && previousEvent.clockMs === possessionClock
          ? possessionClock + 450
          : possessionClock,
        causeEventId: previousEvent.eventId,
        possessionIndex: index,
      });
      previousEvent = result.terminalEvent;
      forcedPossessionTeam = result.goalTeamId
        ? result.goalTeamId === input.home.id ? input.away : input.home
        : null;
    }

    previousEvent = ledger.append({
      clockMs: periodStart + PERIOD_DURATION_MS,
      period,
      type: "period_end",
      teamId: null,
      outcome: "ended",
      causes: [previousEvent.eventId],
    });
  }

  if (!previousEvent) throw new Error("A partida terminou sem evento anterior.");
  ledger.append({
    clockMs: MATCH_DURATION_MS,
    period: 2,
    type: "match_end",
    teamId: null,
    outcome: "finished",
    causes: [previousEvent.eventId],
  });
  return buildResult(input, ledger, rng);
}
