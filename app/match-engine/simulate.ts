import {
  MATCH_ENGINE_VERSION,
  type CanonicalMatchEvent,
  type Foot,
  type MatchDecision,
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
import { footTags, resolveFootUse } from "./feet";
import { EventLedger } from "./ledger";
import { calculateActionPressure, FatigueTracker } from "./physiology";
import {
  calculateAerialDuelProbability,
  calculateCrossProbability,
  calculateDribbleProbability,
  calculateGoalkeeperCrossProbability,
  calculateGoalProbability,
  calculatePassProbability,
  calculateShotOnTargetProbability,
  calculateTeamControl,
  type ProbabilityBreakdown,
  type ShotType,
} from "./probabilities";
import { SeededRng } from "./rng";
import {
  calculateFoulProbability,
  calculateOffsideProbability,
  calculatePenaltyAwardProbability,
  calculateReboundProbability,
  calculateSanctionProbabilities,
  calculateSetPieceDeliveryProbability,
  calculateStoppageSeconds,
  DisciplineTracker,
  type RuleProbabilityBreakdown,
} from "./rules";
import { TeamMatchRuntime } from "./runtime";
import { projectStatistics } from "./statistics";
import {
  aerialTargetModifier,
  assignmentFor,
  attackActionModifier,
  defenderModifier,
  effectiveFamiliarity,
  initialCarrierModifier,
  passTargetModifier,
  receiverModifier,
  relevantActionTraits,
  tacticalAudit,
} from "./tactics";

const PERIOD_DURATION_MS = 2_700_000;
const MATCH_DURATION_MS = PERIOD_DURATION_MS * 2;
const EXTRA_TIME_PERIOD_MS = 900_000;
const MAX_MATCH_DURATION_MS = MATCH_DURATION_MS + EXTRA_TIME_PERIOD_MS * 2;
const PASS_PHASES: readonly PossessionPhase[] = ["buildup", "progression", "creation"];
const PHASE_X: Record<PossessionPhase, number> = {
  restart: 8,
  buildup: 24,
  progression: 50,
  creation: 73,
  danger: 88,
  transition: 42,
};

type ResolutionContext = Readonly<{
  matchInput: MatchInput;
  ledger: EventLedger;
  rng: SeededRng;
  fatigue: FatigueTracker;
  team: TeamSnapshot;
  opponent: TeamSnapshot;
  period: MatchPeriod;
  clockMs: number;
  causeEventId: string;
  possessionIndex: number;
  carrier: MatchPlayer;
  marker: MatchPlayer;
  discipline: DisciplineTracker;
  runtimes: ReadonlyMap<string, TeamMatchRuntime>;
  reboundDepth?: number;
  restartDepth?: number;
}>;

type PossessionResolution = Readonly<{
  terminalEvent: CanonicalMatchEvent;
  goalTeamId: string | null;
}>;

function laneFor(player: MatchPlayer) {
  const hash = [...player.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return 18 + hash % 65;
}

function pointFor(player: MatchPlayer, phase: PossessionPhase): PitchPoint {
  return Object.freeze({ x: PHASE_X[phase], y: laneFor(player) });
}

function requestedFootFor(player: MatchPlayer, action: "cross" | "shot"): Foot | "either" {
  const lane = laneFor(player);
  if (action === "cross") return lane <= 50 ? "left" : "right";
  if (lane < 42) return "right";
  if (lane > 58) return "left";
  return "either";
}

function resolvePlayerFootUse(
  player: MatchPlayer,
  requested: Foot | "either" = "either",
  essential = false,
) {
  if (!player.traits.includes("avoids_weak_foot") || player.feet.avoidsWeakFoot) {
    return resolveFootUse(player, requested, essential);
  }
  return resolveFootUse({
    ...player,
    feet: { ...player.feet, avoidsWeakFoot: true },
  }, requested, essential);
}

function attackingHomeAdvantage(team: TeamSnapshot, input: MatchInput) {
  return team.id === input.home.id ? input.context.homeAdvantage : 0;
}

function receiverWeight(
  team: TeamSnapshot,
  player: MatchPlayer,
  carrier: MatchPlayer,
  phase: PossessionPhase,
) {
  const positionBonus = phase === "buildup"
    ? ["CB", "LB", "RB", "DM", "CM"].includes(player.position) ? 38 : 4
    : phase === "progression"
      ? ["DM", "CM", "AM", "LW", "RW"].includes(player.position) ? 38 : 6
      : ["AM", "LW", "RW", "ST"].includes(player.position)
        ? 44
        : ["LB", "RB"].includes(player.position) ? 18 : 3;
  return Math.max(1, 8
    + positionBonus
    + player.attributes.offBall * 0.35
    + player.attributes.firstTouch * 0.2
    + player.attributes.anticipation * 0.12
    + receiverModifier(team, player, phase)
    + passTargetModifier(carrier, player, phase));
}

function defenderWeight(team: TeamSnapshot, player: MatchPlayer, phase: PossessionPhase) {
  if (player.position === "GK") return 0;
  const positionBonus = phase === "buildup"
    ? ["ST", "AM", "LW", "RW"].includes(player.position) ? 34 : 8
    : phase === "progression"
      ? ["DM", "CM", "AM", "LB", "RB"].includes(player.position) ? 36 : 10
      : ["DM", "CB", "LB", "RB"].includes(player.position) ? 44 : 5;
  return Math.max(1, 8
    + positionBonus
    + player.attributes.positioning * 0.28
    + player.attributes.anticipation * 0.2
    + player.attributes.marking * 0.15
    + defenderModifier(team, player, phase));
}

function pickInitialCarrier(team: TeamSnapshot, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK");
  return rng.weightedPick(
    candidates,
    (player) => Math.max(1, 10
      + (["CB", "DM", "CM"].includes(player.position) ? 45 : 5)
      + player.attributes.decisions * 0.25
      + player.attributes.passing * 0.2
      + initialCarrierModifier(team, player)),
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
  return rng.weightedPick(candidates, (player) => receiverWeight(team, player, carrier, phase), label).item;
}

function pickDefender(team: TeamSnapshot, phase: PossessionPhase, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK");
  return rng.weightedPick(candidates, (player) => defenderWeight(team, player, phase), label).item;
}

function pickAerialTarget(team: TeamSnapshot, crosser: MatchPlayer, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK" && player.id !== crosser.id);
  return rng.weightedPick(candidates, (player) => {
    const positionBonus = player.position === "ST" ? 68 : player.position === "AM" ? 27 : ["RW", "LW"].includes(player.position) ? 18 : 3;
    return Math.max(1, 5
      + positionBonus
      + player.attributes.offBall * 0.25
      + player.attributes.anticipation * 0.15
      + player.attributes.jumpingReach * 0.12
      + aerialTargetModifier(team, player));
  }, label).item;
}

function pickAerialDefender(team: TeamSnapshot, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK");
  return rng.weightedPick(candidates, (player) => {
    const positionBonus = player.position === "CB" ? 64 : player.position === "DM" ? 30 : ["LB", "RB"].includes(player.position) ? 18 : 2;
    return Math.max(1, 5
      + positionBonus
      + player.attributes.marking * 0.25
      + player.attributes.positioning * 0.2
      + player.attributes.jumpingReach * 0.14
      + defenderModifier(team, player, "creation"));
  }, label).item;
}

function selectPossessionTeam(
  input: MatchInput,
  home: TeamSnapshot,
  away: TeamSnapshot,
  rng: SeededRng,
  label: string,
) {
  const homeControl = calculateTeamControl(home) + input.context.homeAdvantage * 0.8;
  const awayControl = calculateTeamControl(away);
  return rng.weightedPick(
    [home, away],
    (team) => team.id === home.id ? homeControl : awayControl,
    label,
  ).item;
}

function auditComponents(breakdown: ProbabilityBreakdown | RuleProbabilityBreakdown) {
  return Object.freeze({
    attack: Number(breakdown.attack.toFixed(4)),
    defense: Number(breakdown.defense.toFixed(4)),
    context: Number(breakdown.context.toFixed(6)),
  });
}

function familiarityFor(team: TeamSnapshot, player: MatchPlayer) {
  return effectiveFamiliarity(player, assignmentFor(team, player.id));
}

function tacticalDetails(team: TeamSnapshot, player: MatchPlayer) {
  return tacticalAudit(team, player);
}

function runtimeFor(runtimes: ReadonlyMap<string, TeamMatchRuntime>, teamId: string) {
  const runtime = runtimes.get(teamId);
  if (!runtime) throw new Error(`Runtime desconhecido para ${teamId}.`);
  return runtime;
}

function pickSetPieceTaker(
  team: TeamSnapshot,
  kind: "corner" | "free_kick" | "penalty",
  rng: SeededRng,
  label: string,
) {
  const candidates = team.players.filter((player) => player.position !== "GK");
  return rng.weightedPick(candidates, (player) => {
    const specialty = kind === "corner" ? player.attributes.corners
      : kind === "free_kick" ? player.attributes.freeKick
        : player.attributes.penalties;
    return Math.max(1,
      specialty * 0.62
        + player.attributes.technique * 0.15
        + player.attributes.composure * 0.13
        + player.attributes.decisions * 0.1,
    );
  }, label).item;
}

function pickReboundAttacker(team: TeamSnapshot, shooter: MatchPlayer, rng: SeededRng, label: string) {
  const candidates = team.players.filter((player) => player.position !== "GK" && player.id !== shooter.id);
  return rng.weightedPick(candidates, (player) => {
    const positionBonus = player.position === "ST" ? 54 : ["AM", "LW", "RW"].includes(player.position) ? 30 : 6;
    return Math.max(1, positionBonus
      + player.attributes.anticipation * 0.24
      + player.attributes.offBall * 0.2
      + player.attributes.acceleration * 0.12);
  }, label).item;
}

function pressureFor(input: {
  matchInput: MatchInput;
  ledger: EventLedger;
  period: MatchPeriod;
  clockMs: number;
  phase: PossessionPhase;
  team: TeamSnapshot;
}) {
  return calculateActionPressure({
    context: input.matchInput.context,
    period: input.period,
    clockMs: input.clockMs,
    phase: input.phase,
    score: input.ledger.score(),
    attackingTeamId: input.team.id,
    homeTeamId: input.matchInput.home.id,
    awayTeamId: input.matchInput.away.id,
  });
}

function pickAttackAction(carrier: MatchPlayer, team: TeamSnapshot, rng: SeededRng, label: string) {
  return rng.weightedPick(
    ["shot", "dribble", "cross"] as const,
    (action) => {
      if (action === "cross") {
        const positionBonus = ["RW", "LW"].includes(carrier.position) ? 52 : ["RB", "LB"].includes(carrier.position) ? 38 : 5;
        return Math.max(1, 6 + positionBonus + carrier.attributes.decisions * 0.08
          + team.tactics.risk * 0.04 + attackActionModifier(team, carrier, action));
      }
      if (action === "dribble") {
        const positionBonus = ["RW", "LW", "AM"].includes(carrier.position) ? 34 : carrier.position === "ST" ? 13 : 5;
        return Math.max(1, 7 + positionBonus + carrier.attributes.flair * 0.1
          + carrier.attributes.decisions * 0.06 + attackActionModifier(team, carrier, action));
      }
      const positionBonus = carrier.position === "ST" ? 58 : carrier.position === "AM" ? 34 : ["RW", "LW"].includes(carrier.position) ? 22 : 9;
      return Math.max(1, 8 + positionBonus + carrier.attributes.decisions * 0.1
        + team.tactics.risk * 0.05 + attackActionModifier(team, carrier, action));
    },
    label,
  ).item;
}

function resolveSetPieceDelivery(
  input: ResolutionContext,
  kind: "corner" | "free_kick",
): PossessionResolution {
  const { matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex, carrier } = input;
  let clockMs = input.clockMs + 350;
  const target = pickAerialTarget(team, carrier, rng, `p${period}.${possessionIndex}.${kind}.target`);
  const defender = pickAerialDefender(opponent, rng, `p${period}.${possessionIndex}.${kind}.defender`);
  const goalkeeper = opponent.players.find((player) => player.position === "GK");
  if (!goalkeeper) throw new Error(`${opponent.name} está sem goleiro.`);
  const pressure = pressureFor({ matchInput, ledger, period, clockMs, phase: "danger", team });
  const takerFatigue = fatigue.value(carrier);
  const deliveryBreakdown = calculateSetPieceDeliveryProbability({
    taker: carrier,
    marker: defender,
    kind,
    takerFatigue,
    pressure,
    familiarity: familiarityFor(team, carrier),
  });
  const deliveryChance = rng.chance(deliveryBreakdown.probability, `p${period}.${possessionIndex}.${kind}.delivery`);
  fatigue.exert(carrier, 0.55);
  const delivery = ledger.append({
    clockMs,
    period,
    type: kind,
    teamId: team.id,
    actorId: carrier.id,
    targetId: target.id,
    opponentIds: [defender.id, goalkeeper.id],
    phase: "danger",
    origin: kind === "corner" ? Object.freeze({ x: 100, y: laneFor(carrier) < 50 ? 0 : 100 }) : pointFor(carrier, "creation"),
    destination: pointFor(target, "danger"),
    outcome: deliveryChance.success ? "delivered" : "overhit",
    tags: ["set_piece", kind, deliveryChance.success ? "delivered" : "turnover"],
    causes: [input.causeEventId],
    rngTraceId: deliveryChance.traceId,
    audit: {
      probability: deliveryChance.probability,
      roll: deliveryChance.roll,
      components: auditComponents(deliveryBreakdown),
      details: {
        action: kind,
        fatigue: Number(takerFatigue.toFixed(2)),
        pressure,
        ...tacticalDetails(team, carrier),
      },
    },
  });
  if (!deliveryChance.success) return Object.freeze({ terminalEvent: delivery, goalTeamId: null });

  clockMs += 350;
  const goalkeeperFatigue = fatigue.value(goalkeeper);
  const goalkeeperBreakdown = calculateGoalkeeperCrossProbability({
    goalkeeper,
    crosser: carrier,
    target,
    goalkeeperFatigue,
    crosserFatigue: takerFatigue,
    pressure,
    goalkeeperFamiliarity: familiarityFor(opponent, goalkeeper),
    crosserFamiliarity: familiarityFor(team, carrier),
  });
  const goalkeeperChance = rng.chance(goalkeeperBreakdown.probability, `p${period}.${possessionIndex}.${kind}.goalkeeper`);
  if (goalkeeperChance.success) {
    fatigue.exert(goalkeeper, 0.65);
    const action = rng.weightedPick(
      ["goalkeeper_claim", "goalkeeper_punch"] as const,
      (candidate) => candidate === "goalkeeper_claim"
        ? goalkeeper.attributes.handling + goalkeeper.attributes.composure * 0.3
        : goalkeeper.attributes.punching + goalkeeper.attributes.bravery * 0.25,
      `p${period}.${possessionIndex}.${kind}.goalkeeper_action`,
    ).item;
    const intervention = ledger.append({
      clockMs,
      period,
      type: action,
      teamId: opponent.id,
      actorId: goalkeeper.id,
      targetId: target.id,
      opponentIds: [target.id],
      phase: "danger",
      outcome: action === "goalkeeper_claim" ? "claimed" : "punched_clear",
      tags: ["goalkeeper_intervention", "set_piece", kind],
      causes: [delivery.eventId],
      rngTraceId: goalkeeperChance.traceId,
      audit: {
        probability: goalkeeperChance.probability,
        roll: goalkeeperChance.roll,
        components: auditComponents(goalkeeperBreakdown),
      },
    });
    return Object.freeze({ terminalEvent: intervention, goalTeamId: null });
  }

  const attackerFatigue = fatigue.value(target);
  const defenderFatigue = fatigue.value(defender);
  const aerialBreakdown = calculateAerialDuelProbability({
    attacker: target,
    defender,
    attackerFatigue,
    defenderFatigue,
    pressure,
    attackerFamiliarity: familiarityFor(team, target),
    defenderFamiliarity: familiarityFor(opponent, defender),
  });
  const aerialChance = rng.chance(aerialBreakdown.probability, `p${period}.${possessionIndex}.${kind}.aerial`);
  fatigue.exert(target, 0.9);
  fatigue.exert(defender, 0.9);
  clockMs += 400;
  const winner = aerialChance.success ? target : defender;
  const loser = aerialChance.success ? defender : target;
  const duel = ledger.append({
    clockMs,
    period,
    type: "aerial_duel",
    teamId: aerialChance.success ? team.id : opponent.id,
    actorId: winner.id,
    targetId: loser.id,
    opponentIds: [loser.id],
    phase: "danger",
    outcome: aerialChance.success ? "attacker_won" : "defender_won",
    tags: ["aerial", "set_piece", kind, aerialChance.success ? "chance_created" : "cleared"],
    causes: [delivery.eventId],
    rngTraceId: aerialChance.traceId,
    audit: {
      probability: aerialChance.probability,
      roll: aerialChance.roll,
      components: auditComponents(aerialBreakdown),
    },
  });
  if (!aerialChance.success) return Object.freeze({ terminalEvent: duel, goalTeamId: null });
  return resolveShot({
    ...input,
    clockMs,
    causeEventId: duel.eventId,
    carrier: target,
    marker: defender,
  }, "header", kind === "corner" ? 10 : 8);
}

function resolvePenalty(input: ResolutionContext): PossessionResolution {
  const { ledger, rng, team, opponent, period, possessionIndex } = input;
  const taker = pickSetPieceTaker(team, "penalty", rng, `p${period}.${possessionIndex}.penalty.taker`);
  const marker = pickDefender(opponent, "danger", rng, `p${period}.${possessionIndex}.penalty.marker`);
  const clockMs = input.clockMs + 400;
  const penalty = ledger.append({
    clockMs,
    period,
    type: "penalty_kick",
    teamId: team.id,
    actorId: taker.id,
    targetId: opponent.players.find((player) => player.position === "GK")?.id,
    opponentIds: [marker.id],
    phase: "danger",
    origin: Object.freeze({ x: 89, y: 50 }),
    destination: Object.freeze({ x: 100, y: 50 }),
    outcome: "taken",
    tags: ["set_piece", "penalty"],
    causes: [input.causeEventId],
  });
  return resolveShot({
    ...input,
    carrier: taker,
    marker,
    clockMs,
    causeEventId: penalty.eventId,
  }, "penalty", 18);
}

function resolveFreeKick(input: ResolutionContext, phase: PossessionPhase): PossessionResolution {
  const { ledger, rng, team, opponent, period, possessionIndex } = input;
  const taker = pickSetPieceTaker(team, "free_kick", rng, `p${period}.${possessionIndex}.free_kick.taker`);
  const marker = pickDefender(opponent, phase, rng, `p${period}.${possessionIndex}.free_kick.marker`);
  if (phase === "buildup" || phase === "progression") {
    const restart = ledger.append({
      clockMs: input.clockMs + 300,
      period,
      type: "free_kick",
      teamId: team.id,
      actorId: taker.id,
      opponentIds: [marker.id],
      phase: "restart",
      origin: pointFor(taker, phase),
      outcome: "short_restart",
      tags: ["set_piece", "free_kick", "retained_possession"],
      causes: [input.causeEventId],
    });
    return Object.freeze({ terminalEvent: restart, goalTeamId: null });
  }

  const directProbability = phase === "danger"
    ? 0.7
    : Math.min(0.58, 0.2 + taker.attributes.freeKick / 240 + taker.attributes.longShots / 520);
  const direct = rng.chance(directProbability, `p${period}.${possessionIndex}.free_kick.choice`);
  if (!direct.success) {
    return resolveSetPieceDelivery({ ...input, carrier: taker, marker }, "free_kick");
  }
  const clockMs = input.clockMs + 350;
  const freeKick = ledger.append({
    clockMs,
    period,
    type: "free_kick",
    teamId: team.id,
    actorId: taker.id,
    targetId: opponent.players.find((player) => player.position === "GK")?.id,
    opponentIds: [marker.id],
    phase: "danger",
    origin: pointFor(taker, phase),
    destination: Object.freeze({ x: 100, y: 50 }),
    outcome: "direct",
    tags: ["set_piece", "free_kick", "direct"],
    causes: [input.causeEventId],
    rngTraceId: direct.traceId,
    audit: { probability: direct.probability, roll: direct.roll },
  });
  return resolveShot({
    ...input,
    carrier: taker,
    marker,
    clockMs,
    causeEventId: freeKick.eventId,
  }, "free_kick", phase === "danger" ? 8 : 2);
}

function resolveCommittedFoul(input: ResolutionContext & Readonly<{
  victim: MatchPlayer;
  offender: MatchPlayer;
  phase: PossessionPhase;
  foulBreakdown: RuleProbabilityBreakdown;
  foulTrace: Readonly<{ probability: number; roll: number; traceId: string }>;
  contestedDribble: boolean;
}>): PossessionResolution {
  const {
    matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex,
    victim, offender, phase, foulBreakdown, foulTrace,
  } = input;
  let clockMs = input.clockMs + 250;
  const pressure = pressureFor({ matchInput, ledger, period, clockMs, phase, team });
  const foul = ledger.append({
    clockMs,
    period,
    type: "foul",
    teamId: opponent.id,
    actorId: offender.id,
    targetId: victim.id,
    opponentIds: [victim.id],
    phase,
    origin: pointFor(victim, phase),
    outcome: "called",
    tags: ["foul", phase, input.contestedDribble ? "challenge" : "pressing_contact"],
    causes: [input.causeEventId],
    rngTraceId: foulTrace.traceId,
    audit: {
      probability: foulTrace.probability,
      roll: foulTrace.roll,
      components: auditComponents(foulBreakdown),
      details: {
        action: "foul",
        pressure,
        offenderFatigue: Number(fatigue.value(offender).toFixed(2)),
        ...tacticalDetails(opponent, offender),
      },
    },
  });

  const sanctions = calculateSanctionProbabilities({
    defender: offender,
    phase,
    referee: matchInput.context.referee,
    defenderFatigue: fatigue.value(offender),
    pressure,
    deniedGoalOpportunity: phase === "danger" && input.contestedDribble,
  });
  const sanctionRoll = rng.next(`p${period}.${possessionIndex}.foul.sanction`);
  let latestCause = foul;
  const straightRed = sanctionRoll.value < sanctions.straightRed;
  const yellow = !straightRed && sanctionRoll.value < sanctions.straightRed + sanctions.yellow;
  const defendingRuntime = runtimeFor(input.runtimes, opponent.id);
  if (straightRed) {
    input.discipline.sendOff(offender.id);
    defendingRuntime.dismissPlayer(offender.id, clockMs + 180);
    latestCause = ledger.append({
      clockMs: clockMs + 180,
      period,
      type: "red_card",
      teamId: opponent.id,
      actorId: offender.id,
      targetId: victim.id,
      opponentIds: [victim.id],
      phase,
      outcome: "straight_red",
      tags: ["discipline", "dismissal", "straight_red"],
      causes: [foul.eventId],
      rngTraceId: sanctionRoll.traceId,
      audit: {
        probability: sanctions.straightRed,
        roll: sanctionRoll.value,
        details: { severity: Number(sanctions.severity.toFixed(2)) },
      },
    });
    clockMs = latestCause.clockMs;
  } else if (yellow) {
    const yellowTotal = input.discipline.issueYellow(offender.id);
    const card = ledger.append({
      clockMs: clockMs + 160,
      period,
      type: "yellow_card",
      teamId: opponent.id,
      actorId: offender.id,
      targetId: victim.id,
      opponentIds: [victim.id],
      phase,
      outcome: yellowTotal >= 2 ? "second_yellow" : "booked",
      tags: ["discipline", yellowTotal >= 2 ? "second_yellow" : "yellow"],
      causes: [foul.eventId],
      rngTraceId: sanctionRoll.traceId,
      audit: {
        probability: sanctions.yellow,
        roll: sanctionRoll.value,
        details: { severity: Number(sanctions.severity.toFixed(2)), yellowTotal },
      },
    });
    latestCause = card;
    clockMs = card.clockMs;
    if (yellowTotal >= 2 && matchInput.context.rules.secondYellowDismissal) {
      input.discipline.sendOff(offender.id);
      defendingRuntime.dismissPlayer(offender.id, clockMs + 140);
      latestCause = ledger.append({
        clockMs: clockMs + 140,
        period,
        type: "red_card",
        teamId: opponent.id,
        actorId: offender.id,
        targetId: victim.id,
        opponentIds: [victim.id],
        phase,
        outcome: "second_yellow",
        tags: ["discipline", "dismissal", "second_yellow"],
        causes: [card.eventId],
      });
      clockMs = latestCause.clockMs;
    }
  }

  if (phase === "danger" && input.contestedDribble) {
    const penaltyProbability = calculatePenaltyAwardProbability({
      offender,
      referee: matchInput.context.referee,
      pressure,
    });
    const penalty = rng.chance(penaltyProbability, `p${period}.${possessionIndex}.foul.penalty`);
    if (penalty.success) {
      return resolvePenalty({
        ...input,
        team: runtimeFor(input.runtimes, team.id).snapshot(),
        opponent: defendingRuntime.snapshot(),
        clockMs,
        causeEventId: latestCause.eventId,
      });
    }
  }
  return resolveFreeKick({
    ...input,
    team: runtimeFor(input.runtimes, team.id).snapshot(),
    opponent: defendingRuntime.snapshot(),
    clockMs,
    causeEventId: latestCause.eventId,
  }, phase);
}

function tryResolveFoul(input: ResolutionContext & Readonly<{
  victim: MatchPlayer;
  offender: MatchPlayer;
  phase: PossessionPhase;
  contestedDribble: boolean;
}>): PossessionResolution | null {
  const pressure = pressureFor({
    matchInput: input.matchInput,
    ledger: input.ledger,
    period: input.period,
    clockMs: input.clockMs,
    phase: input.phase,
    team: input.team,
  });
  const breakdown = calculateFoulProbability({
    defender: input.offender,
    victim: input.victim,
    defendingTeam: input.opponent,
    context: input.matchInput.context,
    phase: input.phase,
    defenderFatigue: input.fatigue.value(input.offender),
    pressure,
    contestedDribble: input.contestedDribble,
  });
  const chance = input.rng.chance(
    breakdown.probability,
    `p${input.period}.${input.possessionIndex}.${input.phase}.foul`,
  );
  if (!chance.success) return null;
  return resolveCommittedFoul({
    ...input,
    foulBreakdown: breakdown,
    foulTrace: chance,
  });
}

function resolveRebound(
  input: ResolutionContext,
  save: CanonicalMatchEvent,
  shooter: MatchPlayer,
  goalkeeper: MatchPlayer,
): PossessionResolution {
  const { ledger, rng, fatigue, team, opponent, period, possessionIndex } = input;
  const attacker = pickReboundAttacker(team, shooter, rng, `p${period}.${possessionIndex}.rebound.attacker`);
  const defender = pickAerialDefender(opponent, rng, `p${period}.${possessionIndex}.rebound.defender`);
  const breakdown = calculateReboundProbability({
    attacker,
    defender,
    goalkeeper,
    attackerFatigue: fatigue.value(attacker),
    defenderFatigue: fatigue.value(defender),
  });
  const chance = rng.chance(breakdown.probability, `p${period}.${possessionIndex}.rebound.recovery`);
  fatigue.exert(attacker, 0.65);
  fatigue.exert(defender, 0.55);
  const winner = chance.success ? attacker : defender;
  const loser = chance.success ? defender : attacker;
  const rebound = ledger.append({
    clockMs: save.clockMs + 320,
    period,
    type: "rebound",
    teamId: chance.success ? team.id : opponent.id,
    actorId: winner.id,
    targetId: loser.id,
    opponentIds: [loser.id, goalkeeper.id],
    phase: "danger",
    origin: Object.freeze({ x: 94, y: 50 }),
    outcome: chance.success ? "attacker_recovered" : "defender_cleared",
    tags: ["second_ball", chance.success ? "chance_created" : "cleared"],
    causes: [save.eventId],
    rngTraceId: chance.traceId,
    audit: {
      probability: chance.probability,
      roll: chance.roll,
      components: auditComponents(breakdown),
    },
  });
  if (!chance.success) return Object.freeze({ terminalEvent: rebound, goalTeamId: null });
  return resolveShot({
    ...input,
    clockMs: rebound.clockMs,
    causeEventId: rebound.eventId,
    carrier: attacker,
    marker: defender,
    reboundDepth: (input.reboundDepth ?? 0) + 1,
  }, "foot", 16);
}

function resolveShot(
  input: ResolutionContext,
  shotType: ShotType,
  chanceQuality = 0,
) {
  const {
    matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex, carrier, marker,
  } = input;
  let clockMs = input.clockMs + 500;
  const pressure = pressureFor({ matchInput, ledger, period, clockMs, phase: "danger", team });
  const foot = shotType !== "header"
    ? resolvePlayerFootUse(carrier, requestedFootFor(carrier, "shot"), true)
    : undefined;
  const shooterFatigue = fatigue.value(carrier);
  const markerFatigue = fatigue.value(marker);
  const goalkeeper = opponent.players.find((player) => player.position === "GK");
  if (!goalkeeper) throw new Error(`${opponent.name} está sem goleiro.`);
  const goalkeeperFatigue = fatigue.value(goalkeeper);
  const shotBreakdown = calculateShotOnTargetProbability({
    shooter: carrier,
    marker,
    tactics: team.tactics,
    homeAdvantage: attackingHomeAdvantage(team, matchInput),
    shotType,
    shooterFatigue,
    markerFatigue,
    pressure,
    foot,
    chanceQuality,
    shooterFamiliarity: familiarityFor(team, carrier),
    markerFamiliarity: familiarityFor(opponent, marker),
  });
  const reboundLabel = input.reboundDepth ? `.rebound${input.reboundDepth}` : "";
  const onTarget = rng.chance(shotBreakdown.probability, `p${period}.${possessionIndex}.${shotType}${reboundLabel}.on_target`);
  const missFraction = !onTarget.success
    ? (onTarget.roll - onTarget.probability) / Math.max(0.0001, 1 - onTarget.probability)
    : 1;
  const deflectedOut = !onTarget.success
    && shotType !== "penalty"
    && (input.restartDepth ?? 0) < 1
    && missFraction < 0.17;
  fatigue.exert(carrier, shotType === "header" ? 0.85 : shotType === "penalty" ? 0.35 : 0.7);
  fatigue.exert(marker, 0.35);
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
    outcome: onTarget.success ? "on_target" : deflectedOut ? "deflected_out" : "off_target",
    tags: [
      "dangerous_attack",
      shotType,
      ...(shotType === "free_kick" || shotType === "penalty" ? ["set_piece"] : []),
      ...(input.reboundDepth ? ["rebound_shot"] : []),
      ...(deflectedOut ? ["corner_awarded"] : []),
      `role:${assignmentFor(team, carrier.id).role}`,
      ...relevantActionTraits(carrier, "shot").map((trait) => `trait:${trait}`),
      ...(foot ? footTags(foot) : []),
    ],
    causes: [input.causeEventId],
    rngTraceId: onTarget.traceId,
    audit: {
      probability: onTarget.probability,
      roll: onTarget.roll,
      components: auditComponents(shotBreakdown),
      details: {
        action: shotType === "header" ? "header" : shotType,
        fatigue: Number(shooterFatigue.toFixed(2)),
        pressure,
        chanceQuality,
        ...tacticalDetails(team, carrier),
        ...(foot ? { usedFoot: foot.foot, footProficiency: foot.proficiency } : {}),
      },
    },
  });
  if (!onTarget.success) {
    if (deflectedOut) {
      const taker = pickSetPieceTaker(team, "corner", rng, `p${period}.${possessionIndex}.corner_after_shot.taker`);
      return resolveSetPieceDelivery({
        ...input,
        clockMs,
        causeEventId: shot.eventId,
        carrier: taker,
        restartDepth: (input.restartDepth ?? 0) + 1,
      }, "corner");
    }
    return Object.freeze({ terminalEvent: shot, goalTeamId: null });
  }

  clockMs += 650;
  const goalBreakdown = calculateGoalProbability({
    shooter: carrier,
    goalkeeper,
    homeAdvantage: attackingHomeAdvantage(team, matchInput),
    shotType,
    shooterFatigue,
    goalkeeperFatigue,
    pressure,
    foot,
    chanceQuality,
    shooterFamiliarity: familiarityFor(team, carrier),
    goalkeeperFamiliarity: familiarityFor(opponent, goalkeeper),
  });
  const goalChance = rng.chance(goalBreakdown.probability, `p${period}.${possessionIndex}.${shotType}${reboundLabel}.goal`);
  fatigue.exert(goalkeeper, 0.55);
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
      tags: ["dangerous_attack", "confirmed_goal", shotType, ...(foot ? footTags(foot) : [])],
      causes: [shot.eventId],
      rngTraceId: goalChance.traceId,
      audit: {
        probability: goalChance.probability,
        roll: goalChance.roll,
        components: auditComponents(goalBreakdown),
        details: {
          action: shotType === "header" ? "headed_goal" : shotType === "foot" ? "goal" : `${shotType}_goal`,
          fatigue: Number(shooterFatigue.toFixed(2)),
          goalkeeperFatigue: Number(goalkeeperFatigue.toFixed(2)),
          pressure,
          ...tacticalDetails(team, carrier),
          ...(foot ? { usedFoot: foot.foot, footProficiency: foot.proficiency } : {}),
        },
      },
    });
    return Object.freeze({ terminalEvent: goal, goalTeamId: team.id });
  }

  const saveStyle = rng.weightedPick(
    ["caught", "parried"] as const,
    (style) => style === "caught"
      ? goalkeeper.attributes.handling + goalkeeper.attributes.composure * 0.35
      : 45 + goalkeeper.attributes.reflexes * 0.45,
    `p${period}.${possessionIndex}.${shotType}${reboundLabel}.save_style`,
  ).item;
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
    outcome: saveStyle,
    tags: ["save", saveStyle, shotType],
    causes: [shot.eventId],
    rngTraceId: goalChance.traceId,
    audit: {
      probability: 1 - goalChance.probability,
      roll: 1 - goalChance.roll,
      components: auditComponents(goalBreakdown),
      details: {
        action: "save",
        style: saveStyle,
        fatigue: Number(goalkeeperFatigue.toFixed(2)),
        pressure,
        ...tacticalDetails(opponent, goalkeeper),
      },
    },
  });
  if (saveStyle === "parried") {
    if ((input.reboundDepth ?? 0) < 1) return resolveRebound(input, save, carrier, goalkeeper);
    const secured = ledger.append({
      clockMs: save.clockMs + 260,
      period,
      type: "rebound",
      teamId: opponent.id,
      actorId: goalkeeper.id,
      targetId: carrier.id,
      opponentIds: [carrier.id],
      phase: "danger",
      origin: Object.freeze({ x: 98, y: 50 }),
      outcome: "goalkeeper_recovered",
      tags: ["second_ball", "secured", "rebound_limit"],
      causes: [save.eventId],
    });
    return Object.freeze({ terminalEvent: secured, goalTeamId: null });
  }
  return Object.freeze({ terminalEvent: save, goalTeamId: null });
}

function resolveDribble(input: ResolutionContext) {
  const { matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex, carrier, marker } = input;
  let clockMs = input.clockMs + 350;
  const pressure = pressureFor({ matchInput, ledger, period, clockMs, phase: "danger", team });
  const foot = resolvePlayerFootUse(carrier);
  const dribblerFatigue = fatigue.value(carrier);
  const defenderFatigue = fatigue.value(marker);
  const breakdown = calculateDribbleProbability({
    dribbler: carrier,
    defender: marker,
    homeAdvantage: attackingHomeAdvantage(team, matchInput),
    dribblerFatigue,
    defenderFatigue,
    pressure,
    foot,
    dribblerFamiliarity: familiarityFor(team, carrier),
    defenderFamiliarity: familiarityFor(opponent, marker),
  });
  const chance = rng.chance(breakdown.probability, `p${period}.${possessionIndex}.dribble`);
  const attempt = ledger.append({
    clockMs,
    period,
    type: "dribble_attempt",
    teamId: team.id,
    actorId: carrier.id,
    targetId: marker.id,
    opponentIds: [marker.id],
    phase: "danger",
    origin: pointFor(carrier, "creation"),
    destination: pointFor(carrier, "danger"),
    outcome: "contested",
    tags: [
      "one_v_one",
      `role:${assignmentFor(team, carrier.id).role}`,
      ...relevantActionTraits(carrier, "dribble").map((trait) => `trait:${trait}`),
      ...footTags(foot),
    ],
    causes: [input.causeEventId],
    rngTraceId: chance.traceId,
    audit: {
      probability: chance.probability,
      roll: chance.roll,
      components: auditComponents(breakdown),
      details: {
        action: "dribble",
        fatigue: Number(dribblerFatigue.toFixed(2)),
        pressure,
        usedFoot: foot.foot,
        footProficiency: foot.proficiency,
        ...tacticalDetails(team, carrier),
      },
    },
  });
  fatigue.exert(carrier, 1.05);
  fatigue.exert(marker, 0.85);
  const foulResolution = tryResolveFoul({
    ...input,
    clockMs,
    causeEventId: attempt.eventId,
    victim: carrier,
    offender: marker,
    phase: "danger",
    contestedDribble: true,
  });
  if (foulResolution) return foulResolution;
  clockMs += 350;
  const tackle = ledger.append({
    clockMs,
    period,
    type: "tackle",
    teamId: opponent.id,
    actorId: marker.id,
    targetId: carrier.id,
    opponentIds: [carrier.id],
    phase: "danger",
    origin: pointFor(marker, "danger"),
    outcome: chance.success ? "failed" : "won",
    tags: ["one_v_one", chance.success ? "beaten" : "turnover"],
    causes: [attempt.eventId],
    rngTraceId: chance.traceId,
    audit: {
      probability: 1 - chance.probability,
      roll: 1 - chance.roll,
      components: auditComponents(breakdown),
      details: {
        action: "tackle",
        fatigue: Number(defenderFatigue.toFixed(2)),
        pressure,
        ...tacticalDetails(opponent, marker),
      },
    },
  });
  if (!chance.success) return Object.freeze({ terminalEvent: tackle, goalTeamId: null });

  clockMs += 300;
  const won = ledger.append({
    clockMs,
    period,
    type: "dribble_won",
    teamId: team.id,
    actorId: carrier.id,
    targetId: marker.id,
    opponentIds: [marker.id],
    phase: "danger",
    destination: pointFor(carrier, "danger"),
    outcome: "won",
    tags: ["one_v_one", "line_broken", ...footTags(foot)],
    causes: [tackle.eventId],
    rngTraceId: chance.traceId,
  });
  return resolveShot({ ...input, clockMs, causeEventId: won.eventId }, "foot", 12);
}

function resolveCross(input: ResolutionContext) {
  const { matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex, carrier } = input;
  let clockMs = input.clockMs + 400;
  const target = pickAerialTarget(team, carrier, rng, `p${period}.${possessionIndex}.cross.target`);
  const defender = pickAerialDefender(opponent, rng, `p${period}.${possessionIndex}.cross.defender`);
  const goalkeeper = opponent.players.find((player) => player.position === "GK");
  if (!goalkeeper) throw new Error(`${opponent.name} está sem goleiro.`);
  const pressure = pressureFor({ matchInput, ledger, period, clockMs, phase: "danger", team });
  const foot = resolvePlayerFootUse(carrier, requestedFootFor(carrier, "cross"), true);
  const crosserFatigue = fatigue.value(carrier);
  const markerFatigue = fatigue.value(input.marker);
  const crossBreakdown = calculateCrossProbability({
    crosser: carrier,
    marker: input.marker,
    homeAdvantage: attackingHomeAdvantage(team, matchInput),
    crosserFatigue,
    markerFatigue,
    pressure,
    foot,
    crosserFamiliarity: familiarityFor(team, carrier),
    markerFamiliarity: familiarityFor(opponent, input.marker),
  });
  const crossChance = rng.chance(crossBreakdown.probability, `p${period}.${possessionIndex}.cross.delivery`);
  const attempt = ledger.append({
    clockMs,
    period,
    type: "cross_attempt",
    teamId: team.id,
    actorId: carrier.id,
    targetId: target.id,
    opponentIds: [input.marker.id, defender.id, goalkeeper.id],
    phase: "danger",
    origin: pointFor(carrier, "creation"),
    destination: pointFor(target, "danger"),
    outcome: "attempted",
    tags: [
      "wide_attack",
      `role:${assignmentFor(team, carrier.id).role}`,
      ...relevantActionTraits(carrier, "cross").map((trait) => `trait:${trait}`),
      ...footTags(foot),
    ],
    causes: [input.causeEventId],
    rngTraceId: crossChance.traceId,
    audit: {
      probability: crossChance.probability,
      roll: crossChance.roll,
      components: auditComponents(crossBreakdown),
      details: {
        action: "cross",
        fatigue: Number(crosserFatigue.toFixed(2)),
        pressure,
        usedFoot: foot.foot,
        footProficiency: foot.proficiency,
        ...tacticalDetails(team, carrier),
      },
    },
  });
  fatigue.exert(carrier, 0.7);
  fatigue.exert(input.marker, 0.4);
  clockMs += 350;
  if (!crossChance.success) {
    const missRoll = (crossChance.roll - crossChance.probability) / Math.max(0.0001, 1 - crossChance.probability);
    const blockedOut = missRoll < 0.55;
    const failed = ledger.append({
      clockMs,
      period,
      type: "cross_failed",
      teamId: team.id,
      actorId: carrier.id,
      targetId: target.id,
      opponentIds: [input.marker.id],
      phase: "danger",
      outcome: blockedOut ? "blocked_out" : "blocked",
      tags: ["wide_attack", "turnover", ...(blockedOut ? ["corner_awarded"] : []), ...footTags(foot)],
      causes: [attempt.eventId],
      rngTraceId: crossChance.traceId,
    });
    if (blockedOut) {
      const taker = pickSetPieceTaker(team, "corner", rng, `p${period}.${possessionIndex}.corner.taker`);
      return resolveSetPieceDelivery({
        ...input,
        clockMs,
        causeEventId: failed.eventId,
        carrier: taker,
        marker: defender,
      }, "corner");
    }
    return Object.freeze({ terminalEvent: failed, goalTeamId: null });
  }

  const completed = ledger.append({
    clockMs,
    period,
    type: "cross_completed",
    teamId: team.id,
    actorId: carrier.id,
    targetId: target.id,
    opponentIds: [defender.id, goalkeeper.id],
    phase: "danger",
    destination: pointFor(target, "danger"),
    outcome: "delivered",
    tags: ["wide_attack", ...footTags(foot)],
    causes: [attempt.eventId],
    rngTraceId: crossChance.traceId,
  });

  clockMs += 350;
  const goalkeeperFatigue = fatigue.value(goalkeeper);
  const goalkeeperBreakdown = calculateGoalkeeperCrossProbability({
    goalkeeper,
    crosser: carrier,
    target,
    goalkeeperFatigue,
    crosserFatigue,
    pressure,
    foot,
    goalkeeperFamiliarity: familiarityFor(opponent, goalkeeper),
    crosserFamiliarity: familiarityFor(team, carrier),
  });
  const goalkeeperChance = rng.chance(goalkeeperBreakdown.probability, `p${period}.${possessionIndex}.cross.goalkeeper`);
  if (goalkeeperChance.success) {
    fatigue.exert(goalkeeper, 0.7);
    const action = rng.weightedPick(
      ["goalkeeper_claim", "goalkeeper_punch"] as const,
      (kind) => kind === "goalkeeper_claim"
        ? goalkeeper.attributes.handling + goalkeeper.attributes.composure * 0.3
        : goalkeeper.attributes.punching + goalkeeper.attributes.bravery * 0.25,
      `p${period}.${possessionIndex}.cross.goalkeeper_action`,
    ).item;
    const intervention = ledger.append({
      clockMs,
      period,
      type: action,
      teamId: opponent.id,
      actorId: goalkeeper.id,
      targetId: target.id,
      opponentIds: [target.id],
      phase: "danger",
      origin: Object.freeze({ x: 96, y: 50 }),
      outcome: action === "goalkeeper_claim" ? "claimed" : "punched_clear",
      tags: ["goalkeeper_intervention", action === "goalkeeper_claim" ? "caught" : "punched"],
      causes: [completed.eventId],
      rngTraceId: goalkeeperChance.traceId,
      audit: {
        probability: goalkeeperChance.probability,
        roll: goalkeeperChance.roll,
        components: auditComponents(goalkeeperBreakdown),
        details: {
          action,
          fatigue: Number(goalkeeperFatigue.toFixed(2)),
          pressure,
          ...tacticalDetails(opponent, goalkeeper),
        },
      },
    });
    return Object.freeze({ terminalEvent: intervention, goalTeamId: null });
  }

  const attackerFatigue = fatigue.value(target);
  const defenderFatigue = fatigue.value(defender);
  const aerialBreakdown = calculateAerialDuelProbability({
    attacker: target,
    defender,
    attackerFatigue,
    defenderFatigue,
    pressure,
    attackerFamiliarity: familiarityFor(team, target),
    defenderFamiliarity: familiarityFor(opponent, defender),
  });
  const aerialChance = rng.chance(aerialBreakdown.probability, `p${period}.${possessionIndex}.cross.aerial`);
  fatigue.exert(target, 0.95);
  fatigue.exert(defender, 0.95);
  clockMs += 400;
  const winner = aerialChance.success ? target : defender;
  const loser = aerialChance.success ? defender : target;
  const duel = ledger.append({
    clockMs,
    period,
    type: "aerial_duel",
    teamId: aerialChance.success ? team.id : opponent.id,
    actorId: winner.id,
    targetId: loser.id,
    opponentIds: [loser.id],
    phase: "danger",
    origin: pointFor(target, "danger"),
    outcome: aerialChance.success ? "attacker_won" : "defender_won",
    tags: ["aerial", aerialChance.success ? "chance_created" : "cleared"],
    causes: [completed.eventId],
    rngTraceId: aerialChance.traceId,
    audit: {
      probability: aerialChance.probability,
      roll: aerialChance.roll,
      components: auditComponents(aerialBreakdown),
      details: {
        action: "aerial_duel",
        attackerFatigue: Number(attackerFatigue.toFixed(2)),
        defenderFatigue: Number(defenderFatigue.toFixed(2)),
        pressure,
        attackerRole: assignmentFor(team, target.id).role,
        defenderRole: assignmentFor(opponent, defender.id).role,
        attackerFamiliarity: familiarityFor(team, target),
        defenderFamiliarity: familiarityFor(opponent, defender),
      },
    },
  });
  if (!aerialChance.success) return Object.freeze({ terminalEvent: duel, goalTeamId: null });

  return resolveShot({
    ...input,
    clockMs,
    causeEventId: duel.eventId,
    carrier: target,
    marker: defender,
  }, "header", 8);
}

function simulatePossession(input: {
  matchInput: MatchInput;
  ledger: EventLedger;
  rng: SeededRng;
  fatigue: FatigueTracker;
  team: TeamSnapshot;
  opponent: TeamSnapshot;
  period: MatchPeriod;
  clockMs: number;
  causeEventId: string;
  possessionIndex: number;
  discipline: DisciplineTracker;
  runtimes: ReadonlyMap<string, TeamMatchRuntime>;
  stoppage?: boolean;
}) {
  const { matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex, discipline, runtimes } = input;
  const transitionLoad = team.tactics.transitionStyle === "counter" ? 0.035 : team.tactics.transitionStyle === "hold" ? -0.015 : 0;
  fatigue.exertMany(team.players, 0.12 + team.tactics.tempo / 1_100 + transitionLoad);
  fatigue.exertMany(opponent.players, 0.09 + opponent.tactics.pressingIntensity / 950);
  for (const player of opponent.players) {
    const assignment = assignmentFor(opponent, player.id);
    fatigue.exert(player, assignment.instructions.pressing / 5_000
      + (player.traits.includes("presses_aggressively") ? 0.018 : 0));
  }
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
    tags: ["possession", ...(input.stoppage ? ["stoppage_time"] : [])],
    causes: [input.causeEventId],
  });
  let causeEventId = possession.eventId;

  for (const phase of PASS_PHASES) {
    clockMs += 650;
    const receiver = pickReceiver(team, carrier, phase, rng, `p${period}.${possessionIndex}.${phase}.receiver`);
    const defender = pickDefender(opponent, phase, rng, `p${period}.${possessionIndex}.${phase}.defender`);
    const foulResolution = tryResolveFoul({
      matchInput,
      ledger,
      rng,
      fatigue,
      team,
      opponent,
      period,
      clockMs,
      causeEventId,
      possessionIndex,
      carrier,
      marker: defender,
      discipline,
      runtimes,
      victim: carrier,
      offender: defender,
      phase,
      contestedDribble: false,
    });
    if (foulResolution) return foulResolution;
    const pressure = pressureFor({ matchInput, ledger, period, clockMs, phase, team });
    const foot = resolvePlayerFootUse(carrier);
    const passerFatigue = fatigue.value(carrier);
    const defenderFatigue = fatigue.value(defender);
    const breakdown = calculatePassProbability({
      passer: carrier,
      receiver,
      defender,
      phase,
      tactics: team.tactics,
      homeAdvantage: attackingHomeAdvantage(team, matchInput),
      passerFatigue,
      defenderFatigue,
      pressure,
      foot,
      passerFamiliarity: familiarityFor(team, carrier),
      receiverFamiliarity: familiarityFor(team, receiver),
      defenderFamiliarity: familiarityFor(opponent, defender),
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
      tags: [phase, ...footTags(foot)],
      causes: [causeEventId],
      rngTraceId: chance.traceId,
      audit: {
        probability: chance.probability,
        roll: chance.roll,
        components: auditComponents(breakdown),
        details: {
          action: "pass",
          fatigue: Number(passerFatigue.toFixed(2)),
          pressure,
          usedFoot: foot.foot,
          footProficiency: foot.proficiency,
          ...tacticalDetails(team, carrier),
          receiverRole: assignmentFor(team, receiver.id).role,
          receiverFamiliarity: familiarityFor(team, receiver),
        },
      },
    });
    fatigue.exert(carrier, 0.35);
    fatigue.exert(receiver, 0.18);
    fatigue.exert(defender, 0.2);
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
        tags: [phase, "turnover", ...footTags(foot)],
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

    if (matchInput.context.rules.offsideEnabled && (phase === "progression" || phase === "creation")) {
      const offsideBreakdown = calculateOffsideProbability({
        attackingTeam: team,
        defendingTeam: opponent,
        passer: carrier,
        receiver,
        defender,
        phase,
      });
      const offsideChance = rng.chance(
        offsideBreakdown.probability,
        `p${period}.${possessionIndex}.${phase}.offside`,
      );
      if (offsideChance.success) {
        const offside = ledger.append({
          clockMs,
          period,
          type: "offside",
          teamId: team.id,
          actorId: receiver.id,
          targetId: carrier.id,
          opponentIds: [defender.id],
          phase,
          origin: pointFor(receiver, phase),
          outcome: "called",
          tags: ["offside", "turnover", phase],
          causes: [attempt.eventId],
          rngTraceId: offsideChance.traceId,
          audit: {
            probability: offsideChance.probability,
            roll: offsideChance.roll,
            components: auditComponents(offsideBreakdown),
            details: {
              receiverRole: assignmentFor(team, receiver.id).role,
              defensiveLine: opponent.tactics.defensiveLine,
            },
          },
        });
        return Object.freeze({ terminalEvent: offside, goalTeamId: null });
      }
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
      tags: [phase, ...footTags(foot)],
      causes: [attempt.eventId],
      rngTraceId: chance.traceId,
    });
    carrier = receiver;
    causeEventId = completed.eventId;
  }

  const marker = pickDefender(opponent, "creation", rng, `p${period}.${possessionIndex}.final.marker`);
  const action = pickAttackAction(carrier, team, rng, `p${period}.${possessionIndex}.final.action`);
  const resolution: ResolutionContext = {
    matchInput,
    ledger,
    rng,
    fatigue,
    team,
    opponent,
    period,
    clockMs,
    causeEventId,
    possessionIndex,
    carrier,
    marker,
    discipline,
    runtimes,
  };
  if (action === "cross") return resolveCross(resolution);
  if (action === "dribble") return resolveDribble(resolution);
  return resolveShot(resolution, "foot");
}

function buildResult(
  input: MatchInput,
  ledger: EventLedger,
  rng: SeededRng,
  fatigue: FatigueTracker,
  discipline: DisciplineTracker,
  homeRuntime: TeamMatchRuntime,
  awayRuntime: TeamMatchRuntime,
  decision: MatchDecision,
  finalPeriod: MatchPeriod,
  finalClockMs: number,
): MatchResult {
  ledger.assertComplete();
  const events = ledger.events();
  const finalState: MatchState = Object.freeze({
    engineVersion: MATCH_ENGINE_VERSION,
    status: "finished",
    period: finalPeriod,
    clockMs: finalClockMs,
    score: ledger.score(),
    possessionTeamId: null,
    players: Object.freeze([
      ...homeRuntime.states(fatigue, discipline),
      ...awayRuntime.states(fatigue, discipline),
    ]),
  });
  return Object.freeze({
    engineVersion: MATCH_ENGINE_VERSION,
    input,
    finalState,
    decision: Object.freeze({
      ...decision,
      regulationScore: Object.freeze([...decision.regulationScore]) as MatchDecision["regulationScore"],
      finalScore: Object.freeze([...decision.finalScore]) as MatchDecision["finalScore"],
      shootoutScore: decision.shootoutScore
        ? Object.freeze([...decision.shootoutScore]) as MatchDecision["shootoutScore"]
        : undefined,
    }),
    events,
    rngTraces: rng.traces(),
    statistics: projectStatistics(events, input.home.id, input.away.id),
  });
}

export function simulateEmptyMatch(input: MatchInput): MatchResult {
  validateMatchInput(input);
  const ledger = new EventLedger(input.context.matchId, input.home.id, input.away.id);
  const rng = new SeededRng(input.context.seed);
  const homeRuntime = new TeamMatchRuntime(input.home);
  const awayRuntime = new TeamMatchRuntime(input.away);
  const fatigue = new FatigueTracker([...homeRuntime.allPlayers(), ...awayRuntime.allPlayers()]);
  const discipline = new DisciplineTracker([...homeRuntime.allPlayers(), ...awayRuntime.allPlayers()]);
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
  const regulationScore = ledger.score();
  let previousEvent = secondEnd;
  let finalPeriod: MatchPeriod = 2;
  let method: MatchDecision["method"] = "draw";
  let winnerTeamId: string | null = null;
  let shootoutScore: MatchDecision["shootoutScore"];

  if (input.context.rules.drawResolution === "extra_time_and_penalties") {
    const firstExtraKickoff = ledger.append({
      clockMs: MATCH_DURATION_MS,
      period: 3,
      type: "kickoff",
      teamId: input.home.id,
      phase: "restart",
      outcome: "extra_time_started",
      tags: ["extra_time"],
      causes: [previousEvent.eventId],
    });
    const firstExtraEnd = ledger.append({
      clockMs: MATCH_DURATION_MS + EXTRA_TIME_PERIOD_MS,
      period: 3,
      type: "period_end",
      teamId: null,
      outcome: "ended",
      tags: ["extra_time"],
      causes: [firstExtraKickoff.eventId],
    });
    const secondExtraKickoff = ledger.append({
      clockMs: MATCH_DURATION_MS + EXTRA_TIME_PERIOD_MS,
      period: 4,
      type: "kickoff",
      teamId: input.away.id,
      phase: "restart",
      outcome: "extra_time_started",
      tags: ["extra_time"],
      causes: [firstExtraEnd.eventId],
    });
    previousEvent = ledger.append({
      clockMs: MAX_MATCH_DURATION_MS,
      period: 4,
      type: "period_end",
      teamId: null,
      outcome: "ended",
      tags: ["extra_time"],
      causes: [secondExtraKickoff.eventId],
    });
    const shootout = resolvePenaltyShootout({
      matchInput: input,
      ledger,
      rng,
      fatigue,
      home: homeRuntime.snapshot(),
      away: awayRuntime.snapshot(),
      previousEvent,
    });
    previousEvent = shootout.previousEvent;
    winnerTeamId = shootout.winnerTeamId;
    shootoutScore = shootout.shootoutScore;
    method = "penalties";
    finalPeriod = 5;
  }

  ledger.append({
    clockMs: input.context.rules.drawResolution === "extra_time_and_penalties" ? MAX_MATCH_DURATION_MS : MATCH_DURATION_MS,
    period: finalPeriod,
    type: "match_end",
    teamId: null,
    outcome: method === "penalties" ? "finished_after_penalties" : "finished",
    tags: method === "penalties" ? ["penalty_shootout"] : [],
    causes: [previousEvent.eventId],
  });
  const finalScore = ledger.score();
  return buildResult(
    input,
    ledger,
    rng,
    fatigue,
    discipline,
    homeRuntime,
    awayRuntime,
    Object.freeze({
      method,
      winnerTeamId,
      regulationScore,
      finalScore,
      shootoutScore,
    }),
    finalPeriod,
    input.context.rules.drawResolution === "extra_time_and_penalties" ? MAX_MATCH_DURATION_MS : MATCH_DURATION_MS,
  );
}

function interventionPeriod(clockMs: number): MatchPeriod {
  if (clockMs < PERIOD_DURATION_MS) return 1;
  if (clockMs < MATCH_DURATION_MS) return 2;
  if (clockMs < MATCH_DURATION_MS + EXTRA_TIME_PERIOD_MS) return 3;
  return 4;
}

function applyIntervention(input: {
  intervention: MatchInput["interventions"][number];
  ledger: EventLedger;
  runtime: TeamMatchRuntime;
  previousEvent: CanonicalMatchEvent;
}) {
  const { intervention, ledger, runtime, previousEvent } = input;
  const clockMs = Math.max(intervention.clockMs, previousEvent.clockMs);
  if (intervention.type === "substitution") {
    if (!runtime.isActive(intervention.playerOutId)) {
      return ledger.append({
        clockMs,
        period: interventionPeriod(clockMs),
        type: "substitution",
        teamId: intervention.teamId,
        actorId: intervention.playerOutId,
        targetId: intervention.playerInId,
        outcome: "cancelled_player_unavailable",
        tags: ["coach_intervention", "cancelled", "player_unavailable"],
        causes: [previousEvent.eventId],
        audit: { details: { interventionId: intervention.id, scheduledClockMs: intervention.clockMs } },
      });
    }
    const outgoingAssignment = runtime.assignment(intervention.playerOutId);
    runtime.applySubstitution({ ...intervention, clockMs });
    return ledger.append({
      clockMs,
      period: interventionPeriod(clockMs),
      type: "substitution",
      teamId: intervention.teamId,
      actorId: intervention.playerOutId,
      targetId: intervention.playerInId,
      outcome: "completed",
      tags: ["coach_intervention", `role:${intervention.assignment.role}`],
      causes: [previousEvent.eventId],
      audit: {
        details: {
          interventionId: intervention.id,
          scheduledClockMs: intervention.clockMs,
          playerOutRole: outgoingAssignment.role,
          playerInRole: intervention.assignment.role,
          playerInPosition: intervention.assignment.position,
          familiarity: intervention.assignment.tacticalFamiliarity,
        },
      },
    });
  }

  runtime.applyTacticalChange(intervention);
  return ledger.append({
    clockMs,
    period: interventionPeriod(clockMs),
    type: "tactical_change",
    teamId: intervention.teamId,
    outcome: "applied",
    tags: ["coach_intervention", "future_only"],
    causes: [previousEvent.eventId],
    audit: {
      details: {
        interventionId: intervention.id,
        scheduledClockMs: intervention.clockMs,
        changes: JSON.stringify(intervention.changes),
        assignmentChanges: JSON.stringify(intervention.assignmentChanges.map((assignment) => ({
          playerId: assignment.playerId,
          position: assignment.position,
          role: assignment.role,
        }))),
      },
    },
  });
}

function penaltyOrder(team: TeamSnapshot) {
  const outfield = team.players.filter((player) => player.position !== "GK");
  const candidates = outfield.length ? outfield : [...team.players];
  return [...candidates].sort((left, right) => {
    const score = (player: MatchPlayer) => player.attributes.penalties * 0.5
      + player.attributes.composure * 0.25
      + player.attributes.technique * 0.1
      + player.attributes.decisions * 0.1
      + player.attributes.finishing * 0.05;
    return score(right) - score(left) || left.id.localeCompare(right.id);
  });
}

function shootoutGoalkeeper(team: TeamSnapshot) {
  return team.players.find((player) => player.position === "GK")
    ?? [...team.players].sort((left, right) => {
      const score = (player: MatchPlayer) => player.attributes.oneOnOnes * 0.34
        + player.attributes.reflexes * 0.28
        + player.attributes.anticipation * 0.16
        + player.attributes.composure * 0.12
        + player.attributes.handling * 0.1;
      return score(right) - score(left) || left.id.localeCompare(right.id);
    })[0];
}

function resolvePenaltyShootout(input: {
  matchInput: MatchInput;
  ledger: EventLedger;
  rng: SeededRng;
  fatigue: FatigueTracker;
  home: TeamSnapshot;
  away: TeamSnapshot;
  previousEvent: CanonicalMatchEvent;
}) {
  const { matchInput, ledger, rng, fatigue, home, away } = input;
  const homeGoalkeeper = shootoutGoalkeeper(home);
  const awayGoalkeeper = shootoutGoalkeeper(away);
  if (!homeGoalkeeper || !awayGoalkeeper) throw new Error("Disputa por pênaltis exige um goleiro em cada equipe.");
  const orders = new Map([
    [home.id, penaltyOrder(home)],
    [away.id, penaltyOrder(away)],
  ]);
  let previousEvent = input.previousEvent;
  let homeGoals = 0;
  let awayGoals = 0;
  let homeTaken = 0;
  let awayTaken = 0;
  let winnerTeamId: string | null = null;
  let kickNumber = 0;

  function takeKick(team: TeamSnapshot, opponent: TeamSnapshot, goalkeeper: MatchPlayer) {
    kickNumber += 1;
    const isHome = team.id === home.id;
    const teamTaken = isHome ? homeTaken : awayTaken;
    const takers = orders.get(team.id)!;
    const taker = takers[teamTaken % takers.length];
    const suddenDeath = homeTaken >= 5 && awayTaken >= 5;
    const pressure = Math.min(100, 42 + matchInput.context.importance * 0.3 + kickNumber * 1.4 + (suddenDeath ? 12 : 0));
    const foot = resolvePlayerFootUse(taker, "either", true);
    const breakdown = calculateGoalProbability({
      shooter: taker,
      goalkeeper,
      homeAdvantage: 0,
      shotType: "penalty",
      shooterFatigue: fatigue.value(taker),
      goalkeeperFatigue: fatigue.value(goalkeeper),
      pressure,
      foot,
      shooterFamiliarity: familiarityFor(team, taker),
      goalkeeperFamiliarity: familiarityFor(opponent, goalkeeper),
    });
    const conversion = rng.chance(breakdown.probability, `shootout.${kickNumber}.${team.id}.conversion`);
    const saved = conversion.success
      ? false
      : rng.chance(0.68, `shootout.${kickNumber}.${team.id}.saved`).success;
    const outcome = conversion.success ? "scored" : saved ? "saved" : "missed";
    if (isHome) {
      homeTaken += 1;
      if (conversion.success) homeGoals += 1;
    } else {
      awayTaken += 1;
      if (conversion.success) awayGoals += 1;
    }
    fatigue.exert(taker, 0.18);
    fatigue.exert(goalkeeper, 0.12);
    previousEvent = ledger.append({
      clockMs: MAX_MATCH_DURATION_MS,
      period: 5,
      type: "shootout_kick",
      teamId: team.id,
      actorId: taker.id,
      targetId: goalkeeper.id,
      opponentIds: [goalkeeper.id],
      phase: "danger",
      origin: { x: 88, y: 50 },
      destination: { x: 100, y: 50 },
      outcome,
      tags: ["penalty_shootout", suddenDeath ? "sudden_death" : "opening_five", ...footTags(foot)],
      causes: [previousEvent.eventId],
      rngTraceId: conversion.traceId,
      audit: {
        probability: conversion.probability,
        roll: conversion.roll,
        components: auditComponents(breakdown),
        details: {
          kickNumber,
          round: Math.max(homeTaken, awayTaken),
          teamKick: isHome ? homeTaken : awayTaken,
          homeShootoutGoals: homeGoals,
          awayShootoutGoals: awayGoals,
          suddenDeath,
          pressure: Number(pressure.toFixed(2)),
        },
      },
    });
  }

  for (let round = 1; round <= 100 && !winnerTeamId; round += 1) {
    takeKick(home, away, awayGoalkeeper);
    if (homeGoals > awayGoals + Math.max(0, 5 - awayTaken)) {
      winnerTeamId = home.id;
      break;
    }
    if (awayGoals > homeGoals + Math.max(0, 5 - homeTaken)) {
      winnerTeamId = away.id;
      break;
    }

    takeKick(away, home, homeGoalkeeper);
    if (homeGoals > awayGoals + Math.max(0, 5 - awayTaken)) winnerTeamId = home.id;
    else if (awayGoals > homeGoals + Math.max(0, 5 - homeTaken)) winnerTeamId = away.id;
    else if (homeTaken >= 5 && awayTaken >= 5 && homeTaken === awayTaken && homeGoals !== awayGoals) {
      winnerTeamId = homeGoals > awayGoals ? home.id : away.id;
    }
  }
  if (!winnerTeamId) throw new Error("A disputa por pênaltis excedeu o limite de segurança sem vencedor.");

  const end = ledger.append({
    clockMs: MAX_MATCH_DURATION_MS,
    period: 5,
    type: "shootout_end",
    teamId: winnerTeamId,
    outcome: "decided",
    tags: ["penalty_shootout", "winner_confirmed"],
    causes: [previousEvent.eventId],
    audit: { details: { homeShootoutGoals: homeGoals, awayShootoutGoals: awayGoals, kicks: kickNumber } },
  });
  return Object.freeze({
    previousEvent: end,
    winnerTeamId,
    shootoutScore: Object.freeze([homeGoals, awayGoals]) as readonly [number, number],
  });
}

export function simulateMatch(input: MatchInput): MatchResult {
  validateMatchInput(input);
  const ledger = new EventLedger(input.context.matchId, input.home.id, input.away.id);
  const rng = new SeededRng(input.context.seed);
  const homeRuntime = new TeamMatchRuntime(input.home);
  const awayRuntime = new TeamMatchRuntime(input.away);
  const runtimes = new Map([
    [homeRuntime.id, homeRuntime],
    [awayRuntime.id, awayRuntime],
  ]);
  const fatigue = new FatigueTracker([...homeRuntime.allPlayers(), ...awayRuntime.allPlayers()]);
  const discipline = new DisciplineTracker([...homeRuntime.allPlayers(), ...awayRuntime.allPlayers()]);
  const interventions = [...input.interventions].map((intervention, index) => ({ intervention, index }))
    .sort((left, right) => left.intervention.clockMs - right.intervention.clockMs || left.index - right.index);
  let nextIntervention = 0;
  let previousEvent: CanonicalMatchEvent | undefined;

  function applyDueInterventions(
    limitClockMs: number,
    includeLimit: boolean,
    cause: CanonicalMatchEvent,
  ) {
    let latest = cause;
    while (nextIntervention < interventions.length) {
      const scheduled = interventions[nextIntervention].intervention;
      const due = includeLimit ? scheduled.clockMs <= limitClockMs : scheduled.clockMs < limitClockMs;
      if (!due) break;
      const runtime = runtimes.get(scheduled.teamId);
      if (!runtime) throw new Error(`Equipe desconhecida na intervenção ${scheduled.id}.`);
      latest = applyIntervention({ intervention: scheduled, ledger, runtime, previousEvent: latest });
      nextIntervention += 1;
    }
    return latest;
  }

  function simulatePeriod(
    period: MatchPeriod,
    periodStart: number,
    periodDuration: number,
    possessions: number,
    stoppageEnabled: boolean,
  ) {
    const periodEventStart = ledger.events().length;
    const kickoffTeamId = period === 1 || period === 3 ? input.home.id : input.away.id;
    const kickoff = ledger.append({
      clockMs: periodStart,
      period,
      type: "kickoff",
      teamId: kickoffTeamId,
      phase: "restart",
      outcome: period <= 2 ? "started" : "extra_time_started",
      tags: period <= 2 ? [] : ["extra_time"],
      causes: previousEvent ? [previousEvent.eventId] : [],
    });
    previousEvent = kickoff;
    let forcedPossessionTeamId: string | null = kickoffTeamId;
    let restartAfterGoal = false;

    for (let index = 0; index < possessions; index += 1) {
      const possessionClock = periodStart + Math.floor((index + 0.5) * periodDuration / possessions);
      previousEvent = applyDueInterventions(possessionClock, true, previousEvent);
      const currentHome = homeRuntime.snapshot();
      const currentAway = awayRuntime.snapshot();
      const possessionTeam = forcedPossessionTeamId
        ? forcedPossessionTeamId === currentHome.id ? currentHome : currentAway
        : selectPossessionTeam(input, currentHome, currentAway, rng, `p${period}.${index}.possession_team`);
      const opponent = possessionTeam.id === currentHome.id ? currentAway : currentHome;

      if (restartAfterGoal) {
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
        restartAfterGoal = false;
      }

      const result = simulatePossession({
        matchInput: input,
        ledger,
        rng,
        fatigue,
        team: possessionTeam,
        opponent,
        period,
        clockMs: previousEvent.type === "kickoff" && previousEvent.clockMs === possessionClock
          ? possessionClock + 450
          : possessionClock,
        causeEventId: previousEvent.eventId,
        possessionIndex: index,
        discipline,
        runtimes,
      });
      previousEvent = result.terminalEvent;
      forcedPossessionTeamId = result.goalTeamId
        ? result.goalTeamId === input.home.id ? input.away.id : input.home.id
        : null;
      restartAfterGoal = Boolean(result.goalTeamId);
    }

    previousEvent = applyDueInterventions(periodStart + periodDuration, false, previousEvent);
    if (input.context.rules.stoppageTimeEnabled && stoppageEnabled) {
      const periodEvents = ledger.events().slice(periodEventStart);
      const goals = periodEvents.filter((event) => event.type === "goal").length;
      const fouls = periodEvents.filter((event) => event.type === "foul").length;
      const cards = periodEvents.filter((event) => event.type === "yellow_card" || event.type === "red_card").length;
      const substitutions = periodEvents.filter((event) => event.type === "substitution" && event.outcome === "completed").length;
      const stoppageTrace = rng.next(`p${period}.stoppage_time`);
      const addedSeconds = calculateStoppageSeconds({
        period: period as 1 | 2,
        goals,
        fouls,
        cards,
        substitutions,
        referee: input.context.referee,
        randomValue: stoppageTrace.value,
      });
      previousEvent = ledger.append({
        clockMs: previousEvent.clockMs,
        period,
        type: "stoppage_time",
        teamId: null,
        phase: "restart",
        outcome: "announced",
        tags: ["stoppage_time", period === 1 ? "first_half" : period === 2 ? "second_half" : "extra_time"],
        causes: [previousEvent.eventId],
        rngTraceId: stoppageTrace.traceId,
        audit: {
          details: {
            addedSeconds,
            addedMinutes: Number((addedSeconds / 60).toFixed(2)),
            goals,
            fouls,
            cards,
            substitutions,
          },
        },
      });

      const requestedExtraPossessions = Math.max(1, Math.min(4, Math.round(addedSeconds / 110)));
      for (let extraIndex = 0; extraIndex < requestedExtraPossessions; extraIndex += 1) {
        const periodEndClock = periodStart + periodDuration;
        if (periodEndClock - previousEvent.clockMs < 8_500) break;
        const possessionClock = previousEvent.clockMs + 120;
        const currentHome = homeRuntime.snapshot();
        const currentAway = awayRuntime.snapshot();
        const possessionTeam = forcedPossessionTeamId
          ? forcedPossessionTeamId === currentHome.id ? currentHome : currentAway
          : selectPossessionTeam(input, currentHome, currentAway, rng, `p${period}.stoppage.${extraIndex}.possession_team`);
        const opponent = possessionTeam.id === currentHome.id ? currentAway : currentHome;
        if (restartAfterGoal) {
          previousEvent = ledger.append({
            clockMs: possessionClock,
            period,
            type: "kickoff",
            teamId: possessionTeam.id,
            phase: "restart",
            outcome: "restarted_after_goal",
            tags: ["restart_after_goal", "stoppage_time"],
            causes: [previousEvent.eventId],
          });
          restartAfterGoal = false;
        }
        const result = simulatePossession({
          matchInput: input,
          ledger,
          rng,
          fatigue,
          team: possessionTeam,
          opponent,
          period,
          clockMs: previousEvent.type === "kickoff" ? previousEvent.clockMs + 120 : possessionClock,
          causeEventId: previousEvent.eventId,
          possessionIndex: possessions + extraIndex,
          discipline,
          runtimes,
          stoppage: true,
        });
        previousEvent = result.terminalEvent;
        forcedPossessionTeamId = result.goalTeamId
          ? result.goalTeamId === input.home.id ? input.away.id : input.home.id
          : null;
        restartAfterGoal = Boolean(result.goalTeamId);
      }
    }
    previousEvent = ledger.append({
      clockMs: periodStart + periodDuration,
      period,
      type: "period_end",
      teamId: null,
      outcome: "ended",
      tags: period === 2
        && input.context.rules.drawResolution === "extra_time_and_penalties"
        && ledger.score()[0] === ledger.score()[1]
        ? ["extra_time_required"]
        : period <= 2 ? [] : ["extra_time"],
      causes: [previousEvent.eventId],
    });
  }

  simulatePeriod(1, 0, PERIOD_DURATION_MS, input.context.possessionsPerPeriod, true);
  simulatePeriod(2, PERIOD_DURATION_MS, PERIOD_DURATION_MS, input.context.possessionsPerPeriod, true);
  if (!previousEvent) throw new Error("A partida terminou sem evento anterior.");
  const regulationScore = ledger.score();
  let finalPeriod: MatchPeriod = 2;
  let finalClockMs = MATCH_DURATION_MS;
  let winnerTeamId: string | null = regulationScore[0] > regulationScore[1]
    ? input.home.id
    : regulationScore[1] > regulationScore[0]
      ? input.away.id
      : null;
  let method: MatchDecision["method"] = winnerTeamId ? "regulation" : "draw";
  let shootoutScore: MatchDecision["shootoutScore"];

  if (!winnerTeamId && input.context.rules.drawResolution === "extra_time_and_penalties") {
    const extraPossessions = Math.max(5, Math.round(input.context.possessionsPerPeriod / 3));
    simulatePeriod(3, MATCH_DURATION_MS, EXTRA_TIME_PERIOD_MS, extraPossessions, false);
    simulatePeriod(4, MATCH_DURATION_MS + EXTRA_TIME_PERIOD_MS, EXTRA_TIME_PERIOD_MS, extraPossessions, false);
    if (!previousEvent) throw new Error("A prorrogação terminou sem evento anterior.");
    finalPeriod = 4;
    finalClockMs = MAX_MATCH_DURATION_MS;
    const extraTimeScore = ledger.score();
    winnerTeamId = extraTimeScore[0] > extraTimeScore[1]
      ? input.home.id
      : extraTimeScore[1] > extraTimeScore[0]
        ? input.away.id
        : null;
    method = winnerTeamId ? "extra_time" : "penalties";
    if (!winnerTeamId) {
      const shootout = resolvePenaltyShootout({
        matchInput: input,
        ledger,
        rng,
        fatigue,
        home: homeRuntime.snapshot(),
        away: awayRuntime.snapshot(),
        previousEvent,
      });
      previousEvent = shootout.previousEvent;
      winnerTeamId = shootout.winnerTeamId;
      shootoutScore = shootout.shootoutScore;
      finalPeriod = 5;
    }
  }

  const finalScore = ledger.score();
  ledger.append({
    clockMs: finalClockMs,
    period: finalPeriod,
    type: "match_end",
    teamId: null,
    outcome: method === "penalties" ? "finished_after_penalties" : method === "extra_time" ? "finished_after_extra_time" : "finished",
    tags: method === "penalties" ? ["penalty_shootout"] : method === "extra_time" ? ["extra_time"] : [],
    causes: [previousEvent.eventId],
  });
  return buildResult(
    input,
    ledger,
    rng,
    fatigue,
    discipline,
    homeRuntime,
    awayRuntime,
    Object.freeze({ method, winnerTeamId, regulationScore, finalScore, shootoutScore }),
    finalPeriod,
    finalClockMs,
  );
}
