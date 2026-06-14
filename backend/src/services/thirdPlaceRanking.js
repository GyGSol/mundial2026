import { resolveFifaRank } from './groupStandingsUtils.js';

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');

function compareThirdPlacesByFifaRank(a, b) {
  const rankA = resolveFifaRank(a);
  const rankB = resolveFifaRank(b);
  if (rankA != null && rankB != null && rankA !== rankB) return rankA - rankB;
  if (rankA != null && rankB == null) return -1;
  if (rankA == null && rankB != null) return 1;
  return String(a.group || '').localeCompare(String(b.group || ''), 'es', {
    sensitivity: 'base',
  });
}

/**
 * FIFA WC 2026 entre los 12 terceros: puntos → dif. goles → goles a favor.
 * Sin partidos jugados: ranking FIFA. Luego letra de grupo (A…L).
 */
export function compareThirdPlaces(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  if (Number(a.played ?? 0) === 0 && Number(b.played ?? 0) === 0) {
    return compareThirdPlacesByFifaRank(a, b);
  }
  return String(a.group || '').localeCompare(String(b.group || ''), 'es', {
    sensitivity: 'base',
  });
}

export function extractThirdPlaceCandidates(groupStandings) {
  return groupStandings
    .map((groupTable) => {
      const row = groupTable.standings?.[2];
      if (!row) return null;
      return { ...row, group: String(groupTable.group).toUpperCase() };
    })
    .filter(Boolean);
}

export function isGroupStageComplete(groupStandings) {
  if (groupStandings.length < 12) return false;
  return groupStandings.every((groupTable) =>
    groupTable.standings.every((row) => row.played >= 3)
  );
}

/**
 * Clasifica los 12 terceros del Mundial 2026; los 8 mejores avanzan (Annex C para cruces).
 * @returns {{ ranked, qualified, provisional, combinationKey }}
 */
export function rankBestThirdPlaceTeams(groupStandings) {
  const candidates = extractThirdPlaceCandidates(groupStandings);
  const sorted = [...candidates].sort(compareThirdPlaces);
  const ranked = sorted.map((row, index) => ({
    ...row,
    thirdRank: index + 1,
    qualifies: index < 8,
  }));

  const qualified = ranked.filter((row) => row.qualifies);
  const complete = isGroupStageComplete(groupStandings);
  const combinationKey =
    qualified.length === 8
      ? qualified
          .map((row) => row.group)
          .sort()
          .join('')
      : null;

  return {
    ranked,
    qualified,
    provisional: !complete,
    combinationKey,
  };
}

export { GROUP_LETTERS };
