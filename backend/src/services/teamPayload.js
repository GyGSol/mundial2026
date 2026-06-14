import { extractFifaRankingFromTeam } from './aiTeamMatchContextService.js';

/** Payload de equipo para el cliente, con ranking FIFA si está disponible. */
export function formatTeamForClient(team, rankings = null) {
  if (!team) return null;

  const base = {
    externalId: team.externalId,
    nameEn: team.nameEn,
    fifaCode: team.fifaCode,
    flag: team.flag,
  };

  const extracted = extractFifaRankingFromTeam(team, rankings?.byCode ?? {});
  if (extracted?.rank == null) return base;

  return {
    ...base,
    fifaRanking: {
      rank: extracted.rank,
      asOf: rankings?.asOf ?? null,
    },
  };
}
