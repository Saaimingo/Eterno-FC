/**
 * Calendário inicial do mundo. Regras futuras devem entrar em arquivos próprios
 * por temporada, sem espalhar datas e formatos pelo motor de simulação.
 */
export const SEASON_2026 = {
  league: {
    openingDate: "2026-02-15",
    roundIntervalDays: 12,
    doubleRound: true,
  },
  brazilianStates: {
    openingMonth: 1,
    firstDay: 10,
    dayStep: 2,
    roundIntervalDays: 7,
  },
  cups: {
    brazil: { id: "COPA-BR", name: "Copa do Brasil", short: "Copa do Brasil", openingDate: "2026-03-11" },
    spain: { id: "COPA-REY", name: "Copa da Espanha", short: "Copa do Rei", openingDate: "2026-03-18" },
    italy: { id: "COPPA-ITA", name: "Copa da Itália", short: "Coppa Italia", openingDate: "2026-03-18" },
    libertadores: { id: "LIBERTADORES", name: "Libertadores", short: "Libertadores", openingDate: "2026-04-08" },
    sudamericana: { id: "SUL-AMERICANA", name: "Copa Sul-Americana", short: "Sul-Americana", openingDate: "2026-04-15" },
    champions: { id: "CHAMPIONS", name: "Liga dos Campeões", short: "Champions", openingDate: "2026-04-08" },
  },
} as const;

export function dateForSeason(season: number, date: string) {
  return `${season}${date.slice(4)}`;
}
