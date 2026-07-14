import {
  MATCH_ENGINE_VERSION,
  type CanonicalMatchEvent,
  type Foot,
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

function auditComponents(breakdown: ProbabilityBreakdown) {
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
  const foot = shotType === "foot"
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
  const onTarget = rng.chance(shotBreakdown.probability, `p${period}.${possessionIndex}.${shotType}.on_target`);
  fatigue.exert(carrier, shotType === "header" ? 0.85 : 0.7);
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
    outcome: onTarget.success ? "on_target" : "off_target",
    tags: [
      "dangerous_attack",
      shotType,
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
        action: shotType === "header" ? "header" : "shot",
        fatigue: Number(shooterFatigue.toFixed(2)),
        pressure,
        chanceQuality,
        ...tacticalDetails(team, carrier),
        ...(foot ? { usedFoot: foot.foot, footProficiency: foot.proficiency } : {}),
      },
    },
  });
  if (!onTarget.success) return Object.freeze({ terminalEvent: shot, goalTeamId: null });

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
  const goalChance = rng.chance(goalBreakdown.probability, `p${period}.${possessionIndex}.${shotType}.goal`);
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
          action: shotType === "header" ? "headed_goal" : "goal",
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
    `p${period}.${possessionIndex}.${shotType}.save_style`,
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
    const failed = ledger.append({
      clockMs,
      period,
      type: "cross_failed",
      teamId: team.id,
      actorId: carrier.id,
      targetId: target.id,
      opponentIds: [input.marker.id],
      phase: "danger",
      outcome: "blocked",
      tags: ["wide_attack", "turnover", ...footTags(foot)],
      causes: [attempt.eventId],
      rngTraceId: crossChance.traceId,
    });
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
}) {
  const { matchInput, ledger, rng, fatigue, team, opponent, period, possessionIndex } = input;
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
    tags: ["possession"],
    causes: [input.causeEventId],
  });
  let causeEventId = possession.eventId;

  for (const phase of PASS_PHASES) {
    clockMs += 650;
    const receiver = pickReceiver(team, carrier, phase, rng, `p${period}.${possessionIndex}.${phase}.receiver`);
    const defender = pickDefender(opponent, phase, rng, `p${period}.${possessionIndex}.${phase}.defender`);
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
  homeRuntime: TeamMatchRuntime,
  awayRuntime: TeamMatchRuntime,
): MatchResult {
  ledger.assertComplete();
  const events = ledger.events();
  const finalState: MatchState = Object.freeze({
    engineVersion: MATCH_ENGINE_VERSION,
    status: "finished",
    period: 2,
    clockMs: MATCH_DURATION_MS,
    score: ledger.score(),
    possessionTeamId: null,
    players: Object.freeze([
      ...homeRuntime.states(fatigue),
      ...awayRuntime.states(fatigue),
    ]),
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
  const homeRuntime = new TeamMatchRuntime(input.home);
  const awayRuntime = new TeamMatchRuntime(input.away);
  const fatigue = new FatigueTracker([...homeRuntime.allPlayers(), ...awayRuntime.allPlayers()]);
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
  return buildResult(input, ledger, rng, fatigue, homeRuntime, awayRuntime);
}

function interventionPeriod(clockMs: number): MatchPeriod {
  return clockMs < PERIOD_DURATION_MS ? 1 : 2;
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

  for (const period of [1, 2] as const) {
    const periodStart = (period - 1) * PERIOD_DURATION_MS;
    const kickoffTeamId = period === 1 ? input.home.id : input.away.id;
    const kickoff = ledger.append({
      clockMs: periodStart,
      period,
      type: "kickoff",
      teamId: kickoffTeamId,
      phase: "restart",
      outcome: "started",
      causes: previousEvent ? [previousEvent.eventId] : [],
    });
    previousEvent = kickoff;
    let forcedPossessionTeamId: string | null = kickoffTeamId;
    let restartAfterGoal = false;

    for (let index = 0; index < input.context.possessionsPerPeriod; index += 1) {
      const possessionClock = periodStart + Math.floor((index + 0.5) * PERIOD_DURATION_MS / input.context.possessionsPerPeriod);
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
      });
      previousEvent = result.terminalEvent;
      forcedPossessionTeamId = result.goalTeamId
        ? result.goalTeamId === input.home.id ? input.away.id : input.home.id
        : null;
      restartAfterGoal = Boolean(result.goalTeamId);
    }

    previousEvent = applyDueInterventions(periodStart + PERIOD_DURATION_MS, false, previousEvent);
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
  return buildResult(input, ledger, rng, fatigue, homeRuntime, awayRuntime);
}
