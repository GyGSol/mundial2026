export function createStanding(team) {
  return {
    teamId: team.externalId,
    nameEn: team.nameEn,
    fifaCode: team.fifaCode,
    flag: team.flag,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  };
}

export function applyResult(standing, goalsFor, goalsAgainst) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDiff = standing.goalsFor - standing.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.won += 1;
    standing.points += 3;
  } else if (goalsFor < goalsAgainst) {
    standing.lost += 1;
  } else {
    standing.drawn += 1;
    standing.points += 1;
  }
}

export function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return (a.nameEn || '').localeCompare(b.nameEn || '');
  });
}

export function normalizePhaseKey(type) {
  return String(type || 'group')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function isGroupPhaseMatch(match) {
  return normalizePhaseKey(match.type) === 'group';
}
