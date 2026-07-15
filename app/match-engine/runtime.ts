import type {
  MatchPlayer,
  PlayerMatchState,
  PlayerRole,
  RoleAssignment,
  SubstitutionIntervention,
  TacticalChangeIntervention,
  TacticalPlan,
  TeamSnapshot,
} from "./contracts";
import type { FatigueTracker } from "./physiology";
import type { DisciplineTracker } from "./rules";
import { defaultRoleForPosition } from "./tactics";

type Participation = {
  status: "active" | "substituted" | "sent_off" | "bench";
  position: MatchPlayer["position"];
  role: PlayerRole;
  enteredAtMs?: number;
  exitedAtMs?: number;
};

export class TeamMatchRuntime {
  readonly #source: TeamSnapshot;
  readonly #players = new Map<string, MatchPlayer>();
  readonly #participation = new Map<string, Participation>();
  #activeOrder: string[];
  #benchOrder: string[];
  #assignments: Map<string, RoleAssignment>;
  #tactics: TacticalPlan;

  constructor(team: TeamSnapshot) {
    this.#source = team;
    for (const player of [...team.players, ...team.bench]) this.#players.set(player.id, player);
    this.#activeOrder = team.players.map((player) => player.id);
    this.#benchOrder = team.bench.map((player) => player.id);
    this.#assignments = new Map(team.assignments.map((assignment) => [assignment.playerId, assignment]));
    this.#tactics = team.tactics;

    for (const player of team.players) {
      const assignment = this.assignment(player.id);
      this.#participation.set(player.id, {
        status: "active",
        position: assignment.position,
        role: assignment.role,
        enteredAtMs: 0,
      });
    }
    for (const player of team.bench) {
      this.#participation.set(player.id, {
        status: "bench",
        position: player.position,
        role: defaultRoleForPosition(player.position),
      });
    }
  }

  get id() {
    return this.#source.id;
  }

  get name() {
    return this.#source.name;
  }

  assignment(playerId: string) {
    const assignment = this.#assignments.get(playerId);
    if (!assignment) throw new Error(`Jogador ${playerId} está sem função em ${this.name}.`);
    return assignment;
  }

  allPlayers() {
    return Object.freeze([...this.#players.values()]);
  }

  isActive(playerId: string) {
    return this.#activeOrder.includes(playerId);
  }

  snapshot(): TeamSnapshot {
    const deployed = this.#activeOrder.map((playerId) => {
      const player = this.#players.get(playerId);
      const assignment = this.assignment(playerId);
      if (!player) throw new Error(`Jogador ativo desconhecido: ${playerId}.`);
      return Object.freeze({ ...player, position: assignment.position });
    });
    const bench = this.#benchOrder.map((playerId) => {
      const player = this.#players.get(playerId);
      if (!player) throw new Error(`Reserva desconhecido: ${playerId}.`);
      return player;
    });
    return Object.freeze({
      id: this.id,
      name: this.name,
      players: Object.freeze(deployed),
      bench: Object.freeze(bench),
      assignments: Object.freeze(this.#activeOrder.map((playerId) => this.assignment(playerId))),
      tactics: this.#tactics,
    });
  }

  applySubstitution(intervention: SubstitutionIntervention) {
    const activeIndex = this.#activeOrder.indexOf(intervention.playerOutId);
    const benchIndex = this.#benchOrder.indexOf(intervention.playerInId);
    if (activeIndex < 0 || benchIndex < 0) throw new Error(`Substituição inválida em ${intervention.id}.`);

    this.#activeOrder[activeIndex] = intervention.playerInId;
    this.#benchOrder.splice(benchIndex, 1);
    this.#assignments.delete(intervention.playerOutId);
    this.#assignments.set(intervention.playerInId, intervention.assignment);

    const outgoing = this.#participation.get(intervention.playerOutId);
    if (!outgoing) throw new Error(`Participação desconhecida: ${intervention.playerOutId}.`);
    outgoing.status = "substituted";
    outgoing.exitedAtMs = intervention.clockMs;
    const incoming = this.#participation.get(intervention.playerInId);
    if (!incoming) throw new Error(`Participação desconhecida: ${intervention.playerInId}.`);
    incoming.status = "active";
    incoming.position = intervention.assignment.position;
    incoming.role = intervention.assignment.role;
    incoming.enteredAtMs = intervention.clockMs;
  }

  dismissPlayer(playerId: string, clockMs: number) {
    const activeIndex = this.#activeOrder.indexOf(playerId);
    if (activeIndex < 0) return false;
    this.#activeOrder.splice(activeIndex, 1);
    this.#assignments.delete(playerId);
    const participation = this.#participation.get(playerId);
    if (!participation) throw new Error(`Participação desconhecida: ${playerId}.`);
    participation.status = "sent_off";
    participation.exitedAtMs = clockMs;
    return true;
  }

  applyTacticalChange(intervention: TacticalChangeIntervention) {
    this.#tactics = Object.freeze({ ...this.#tactics, ...intervention.changes });
    for (const assignment of intervention.assignmentChanges) {
      if (!this.isActive(assignment.playerId)) continue;
      this.#assignments.set(assignment.playerId, assignment);
      const participation = this.#participation.get(assignment.playerId);
      if (participation) {
        participation.position = assignment.position;
        participation.role = assignment.role;
      }
    }
  }

  states(fatigue: FatigueTracker, discipline?: DisciplineTracker): readonly PlayerMatchState[] {
    return Object.freeze(this.allPlayers().map((player) => {
      const participation = this.#participation.get(player.id);
      if (!participation) throw new Error(`Estado de participação ausente para ${player.id}.`);
      return Object.freeze({
        playerId: player.id,
        fatigue: Number(fatigue.value(player).toFixed(2)),
        status: participation.status,
        yellowCards: discipline?.yellowCards(player.id) ?? 0,
        position: participation.position,
        role: participation.role,
        enteredAtMs: participation.enteredAtMs,
        exitedAtMs: participation.exitedAtMs,
      });
    }));
  }
}
