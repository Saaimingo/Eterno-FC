import type { RngTrace } from "./contracts";

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampProbability(probability: number) {
  return Math.min(1, Math.max(0, probability));
}

export type ChanceResult = Readonly<{
  success: boolean;
  probability: number;
  roll: number;
  traceId: string;
}>;

export class SeededRng {
  readonly #traces: RngTrace[] = [];
  #state: number;

  constructor(readonly seed: string) {
    if (!seed) throw new Error("A semente do motor não pode ser vazia.");
    this.#state = hashSeed(seed);
  }

  next(label: string) {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const normalized = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    const index = this.#traces.length;
    const trace = Object.freeze({
      traceId: `rng_${String(index + 1).padStart(6, "0")}`,
      index,
      label,
      value: normalized,
    });
    this.#traces.push(trace);
    return trace;
  }

  chance(probability: number, label: string): ChanceResult {
    const normalized = clampProbability(probability);
    const trace = this.next(label);
    return Object.freeze({
      success: trace.value < normalized,
      probability: normalized,
      roll: trace.value,
      traceId: trace.traceId,
    });
  }

  weightedPick<T>(items: readonly T[], weight: (item: T) => number, label: string) {
    if (items.length === 0) throw new Error(`Não há opções para ${label}.`);
    const weights = items.map((item) => Math.max(0, weight(item)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) throw new Error(`Todos os pesos de ${label} são inválidos.`);
    const trace = this.next(label);
    let cursor = trace.value * total;
    for (let index = 0; index < items.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return Object.freeze({ item: items[index], traceId: trace.traceId });
    }
    return Object.freeze({ item: items[items.length - 1], traceId: trace.traceId });
  }

  traces() {
    return Object.freeze([...this.#traces]);
  }
}
