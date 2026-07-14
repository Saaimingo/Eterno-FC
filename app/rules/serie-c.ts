export type SerieCSeasonFormat = {
  participantCount: number;
  firstStageGroupCount: number;
  firstStageDoubleRound: boolean;
  qualifiedForAccessStage: number;
  promoted: number;
  relegated: number;
};

export function serieCFormatForSeason(season: number): SerieCSeasonFormat {
  if (season >= 2028) {
    return {
      participantCount: 28,
      firstStageGroupCount: 2,
      firstStageDoubleRound: true,
      qualifiedForAccessStage: 8,
      promoted: 4,
      relegated: 6,
    };
  }

  return {
    participantCount: season === 2027 ? 24 : 20,
    firstStageGroupCount: 1,
    firstStageDoubleRound: false,
    qualifiedForAccessStage: 8,
    promoted: 4,
    relegated: 2,
  };
}

/** Distribuição em serpentina usada nos dois quadrangulares de acesso. */
export function splitSerieCAccessGroups(rankedClubIds: readonly string[]) {
  if (rankedClubIds.length !== 8) throw new Error("A Série C exige oito classificados aos quadrangulares.");
  return {
    "Grupo de acesso A": [rankedClubIds[0], rankedClubIds[3], rankedClubIds[4], rankedClubIds[7]],
    "Grupo de acesso B": [rankedClubIds[1], rankedClubIds[2], rankedClubIds[5], rankedClubIds[6]],
  };
}
