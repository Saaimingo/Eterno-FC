export type SuperCupQualification = {
  leagueChampionId: string;
  leagueRunnerUpId: string;
  cupChampionId: string;
};

export type SuperCupRule = {
  id: string;
  name: string;
  short: string;
  matchDate: string;
  championPrize: number;
  runnerUpPrize: number;
};

export const BRAZIL_SUPER_CUP_2026: SuperCupRule = {
  id: "SUPER-BR",
  name: "Taça dos Campeões do Brasil",
  short: "Taça dos Campeões",
  matchDate: "02-01",
  championPrize: 12_000_000,
  runnerUpPrize: 6_000_000,
};

/**
 * Liga o campeão nacional ao campeão da copa da temporada anterior.
 * Se houver dobradinha, o vice da liga nacional ocupa a segunda vaga.
 */
export function resolveSuperCupParticipants(qualification: SuperCupQualification) {
  const secondClubId = qualification.cupChampionId === qualification.leagueChampionId
    ? qualification.leagueRunnerUpId
    : qualification.cupChampionId;

  if (!qualification.leagueChampionId || !secondClubId || qualification.leagueChampionId === secondClubId) {
    throw new Error("A Supercopa exige dois classificados distintos.");
  }

  return [qualification.leagueChampionId, secondClubId] as const;
}
