import type { Club } from "../domain/types";
import type { LeagueTransitionRule } from "./league-transitions";

export type BrazilianDivisionId = "BRA-A" | "BRA-B" | "BRA-C" | "BRA-D";

type DivisionSchedule = {
  openingDate: string;
  closingDate: string;
  expectedParticipants: number;
  rounds: number;
};

type RegionalRule = {
  id: string;
  name: string;
  short: string;
  openingDate: string;
  stateCodes: string[];
  expectedParticipants: number;
};

/**
 * Regras nacionais brasileiras da temporada-modelo 2026.
 *
 * A estrutura registra o regulamento e o calendário; ela não força o motor a
 * inventar participantes quando o banco de dados ainda não tem os 20/96
 * clubes oficiais do formato completo. Isso permite ampliar a base sem mudar
 * as regras no código da simulação.
 */
export const BRAZIL_2026 = {
  states: {
    openingDate: "01-11",
    closingDate: "03-08",
    maxMatchdays: 11,
    roundIntervalDays: 7,
  },
  divisions: {
    "BRA-A": { openingDate: "01-28", closingDate: "12-02", expectedParticipants: 20, rounds: 38 },
    "BRA-B": { openingDate: "03-21", closingDate: "11-28", expectedParticipants: 20, rounds: 38 },
    "BRA-C": { openingDate: "04-05", closingDate: "10-25", expectedParticipants: 20, rounds: 19 },
    "BRA-D": { openingDate: "04-05", closingDate: "09-13", expectedParticipants: 96, rounds: 18 },
  } satisfies Record<BrazilianDivisionId, DivisionSchedule>,
  regionals: [
    {
      id: "REGIONAL-NE",
      name: "Copa Nordeste",
      short: "Nordeste",
      openingDate: "03-25",
      stateCodes: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
      expectedParticipants: 20,
    },
    {
      id: "REGIONAL-NCO",
      name: "Copa Norte-Centro",
      short: "Norte-Centro",
      openingDate: "03-25",
      stateCodes: ["AC", "AM", "AP", "DF", "GO", "MS", "MT", "PA", "RO", "RR", "TO"],
      expectedParticipants: 24,
    },
    {
      id: "REGIONAL-SSE",
      name: "Copa Sul-Sudeste",
      short: "Sul-Sudeste",
      openingDate: "03-25",
      stateCodes: ["ES", "MG", "PR", "RJ", "RS", "SC", "SP"],
      expectedParticipants: 12,
    },
  ] satisfies RegionalRule[],
  nationalCup: {
    id: "COPA-BR",
    name: "Copa do Brasil",
    short: "Copa do Brasil",
    openingDate: "02-18",
    closingDate: "12-06",
    expectedParticipants: 126,
  },
  transitions: {
    "BRA-A": { relegatedTo: "BRA-B", count: 4 },
    "BRA-B": { promotedTo: "BRA-A", promotedCount: 4, relegatedTo: "BRA-C", count: 4 },
    // A Série C de 2026 é transição para a ampliação de 2027. A aplicação
    // integral desta ficha depende do banco de 96 clubes da Série D.
    "BRA-C": { promotedTo: "BRA-B", promotedCount: 4, relegatedTo: "BRA-D", count: 2 },
    "BRA-D": { promotedTo: "BRA-C", promotedCount: 6 },
  },
} as const;

export function brazilianDivisionSchedule(divisionId: string) {
  return BRAZIL_2026.divisions[divisionId as BrazilianDivisionId];
}

export function brazilianTransitionRules(): LeagueTransitionRule[] {
  return [
    { upper: "BRA-A", lower: "BRA-B", relegated: BRAZIL_2026.transitions["BRA-A"].count, promoted: BRAZIL_2026.transitions["BRA-B"].promotedCount },
    { upper: "BRA-B", lower: "BRA-C", relegated: BRAZIL_2026.transitions["BRA-B"].count, promoted: BRAZIL_2026.transitions["BRA-C"].promotedCount },
    { upper: "BRA-C", lower: "BRA-D", relegated: BRAZIL_2026.transitions["BRA-C"].count, promoted: BRAZIL_2026.transitions["BRA-D"].promotedCount },
  ];
}

export function regionalEligibleClubs(clubs: Club[], stateCodes: readonly string[], continentalClubIds: ReadonlySet<string>) {
  return clubs
    .filter((club) => club.country === "Brasil" && club.state && stateCodes.includes(club.state) && !continentalClubIds.has(club.id))
    .sort((left, right) => right.reputation - left.reputation);
}
