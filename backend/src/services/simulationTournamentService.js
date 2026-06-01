import { computeGroupStandings } from './worldCupStatsService.js';

export const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');

export const KNOCKOUT_ROUNDS = [
  { type: 'round_of_32', label: 'Dieciseisavos de final', matchCount: 16, order: 1 },
  { type: 'round_of_16', label: 'Octavos de final', matchCount: 8, order: 2 },
  { type: 'quarter_final', label: 'Cuartos de final', matchCount: 4, order: 3 },
  { type: 'semi_final', label: 'Semifinales', matchCount: 2, order: 4 },
  { type: 'third_place', label: 'Tercer puesto', matchCount: 1, order: 5 },
  { type: 'final', label: 'Final', matchCount: 1, order: 6 },
];

export const TOTAL_GROUP_MATCHES = GROUP_LETTERS.length * 6;
export const TOTAL_KNOCKOUT_MATCHES = KNOCKOUT_ROUNDS.reduce((sum, round) => sum + round.matchCount, 0);
export const TOTAL_FULL_TOURNAMENT_MATCHES = TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES;
export const GROUP_STAGE_MATCHDAYS = 3;
export const MATCH_INTERVAL_MS = 5 * 1000;

/** Calendario estándar de 4 equipos: 3 fechas, 2 partidos por fecha. */
const GROUP_MATCHDAY_SCHEDULE = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

export function normalizeGroupLetter(groupValue) {
  const raw = String(groupValue || '').trim().toUpperCase();
  if (GROUP_LETTERS.includes(raw)) return raw;
  const match = raw.match(/(?:GRUPO\s*|GROUP\s*)?([A-L])\b/);
  return match ? match[1] : '';
}

export function organizeTeamsByGroup(teams) {
  const byGroup = {};
  for (const letter of GROUP_LETTERS) {
    byGroup[letter] = [];
  }

  for (const team of teams) {
    const group = normalizeGroupLetter(team.group);
    if (!group || !byGroup[group]) continue;
    if (byGroup[group].length < 4) {
      byGroup[group].push(team);
    }
  }

  return byGroup;
}

export function buildGroupStageFixtures(teamsByGroup) {
  const fixtures = [];
  let order = 0;

  for (let matchdayIndex = 0; matchdayIndex < GROUP_STAGE_MATCHDAYS; matchdayIndex += 1) {
    const matchday = String(matchdayIndex + 1);
    const pairings = GROUP_MATCHDAY_SCHEDULE[matchdayIndex];

    for (const group of GROUP_LETTERS) {
      const groupTeams = teamsByGroup[group] || [];
      if (groupTeams.length < 4) {
        throw new Error(`El grupo ${group} necesita 4 equipos (tiene ${groupTeams.length})`);
      }

      for (const [homeIndex, awayIndex] of pairings) {
        fixtures.push({
          home: groupTeams[homeIndex],
          away: groupTeams[awayIndex],
          group,
          type: 'group',
          matchday,
          globalMatchday: matchdayIndex + 1,
          order: order++,
          localDate: `Fecha ${matchday} · Grupo ${group}`,
        });
      }
    }
  }

  return fixtures;
}

export function compareSimulationSchedule(a, b) {
  const orderA = a.raw?.scheduleOrder ?? a.scheduleOrder ?? 0;
  const orderB = b.raw?.scheduleOrder ?? b.scheduleOrder ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  return new Date(a.kickoffAt || 0) - new Date(b.kickoffAt || 0);
}

function compareThirdPlaces(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return (a.group || '').localeCompare(b.group || '');
}

export function buildQualifierField(groupStandings, teamMap) {
  const winners = [];
  const runners = [];
  const thirds = [];

  for (const groupTable of groupStandings) {
    const group = groupTable.group;
    const rows = groupTable.standings;

    if (rows[0]) {
      winners.push({
        teamId: rows[0].teamId,
        team: teamMap[rows[0].teamId],
        group,
        position: 1,
        seedLabel: `1${group}`,
        points: rows[0].points,
        goalDiff: rows[0].goalDiff,
        goalsFor: rows[0].goalsFor,
      });
    }
    if (rows[1]) {
      runners.push({
        teamId: rows[1].teamId,
        team: teamMap[rows[1].teamId],
        group,
        position: 2,
        seedLabel: `2${group}`,
        points: rows[1].points,
        goalDiff: rows[1].goalDiff,
        goalsFor: rows[1].goalsFor,
      });
    }
    if (rows[2]) {
      thirds.push({
        teamId: rows[2].teamId,
        team: teamMap[rows[2].teamId],
        group,
        position: 3,
        seedLabel: `3${group}`,
        points: rows[2].points,
        goalDiff: rows[2].goalDiff,
        goalsFor: rows[2].goalsFor,
      });
    }
  }

  const bestThirds = [...thirds].sort(compareThirdPlaces).slice(0, 8);
  bestThirds.forEach((entry, index) => {
    entry.seedLabel = `3-${index + 1}`;
  });

  const seeded = [
    ...winners.sort((a, b) => a.group.localeCompare(b.group)),
    ...runners.sort((a, b) => a.group.localeCompare(b.group)),
    ...bestThirds,
  ];

  if (seeded.length !== 32) {
    throw new Error(`Se esperaban 32 clasificados y hay ${seeded.length}`);
  }

  return seeded.map((entry, index) => ({
    ...entry,
    seed: index + 1,
  }));
}

export function buildRoundOf32Crossovers(seededQualifiers) {
  const pairs = [];
  for (let i = 0; i < 16; i += 1) {
    const home = seededQualifiers[i];
    const away = seededQualifiers[31 - i];
    pairs.push({
      home,
      away,
      crossover: `${home.seedLabel} vs ${away.seedLabel}`,
      bracketSlot: i + 1,
    });
  }
  return pairs;
}

export function buildNextRoundCrossovers(winners) {
  if (winners.length < 2 || winners.length % 2 !== 0) {
    throw new Error(`Cantidad inválida de clasificados: ${winners.length}`);
  }

  const pairs = [];
  for (let i = 0; i < winners.length; i += 2) {
    const home = winners[i];
    const away = winners[i + 1];
    pairs.push({
      home,
      away,
      crossover: `${home.sourceLabel} vs ${away.sourceLabel}`,
      bracketSlot: i / 2 + 1,
    });
  }
  return pairs;
}

export function getWinnerTeamId(match) {
  if (match.homeScore > match.awayScore) return match.homeTeamId;
  if (match.awayScore > match.homeScore) return match.awayTeamId;
  return null;
}

export function getLoserTeamId(match) {
  if (match.homeScore > match.awayScore) return match.awayTeamId;
  if (match.awayScore > match.homeScore) return match.homeTeamId;
  return null;
}

export function buildWinnerEntries(finishedMatches, teamMap) {
  return finishedMatches
    .sort((a, b) => String(a.externalId).localeCompare(String(b.externalId)))
    .map((match, index) => {
      const teamId = getWinnerTeamId(match);
      const team = teamMap[teamId];
      return {
        teamId,
        team,
        sourceLabel: `W${index + 1}`,
        sourceMatchExternalId: match.externalId,
      };
    });
}

export function buildLoserEntries(finishedMatches, teamMap) {
  return finishedMatches
    .sort((a, b) => String(a.externalId).localeCompare(String(b.externalId)))
    .map((match, index) => {
      const teamId = getLoserTeamId(match);
      const team = teamMap[teamId];
      return {
        teamId,
        team,
        sourceLabel: `L${index + 1}`,
        sourceMatchExternalId: match.externalId,
      };
    });
}

export function computeGroupStandingsFromMatches(teams, matches) {
  return computeGroupStandings(teams, matches, []);
}

export function getKnockoutRoundMeta(type) {
  return KNOCKOUT_ROUNDS.find((round) => round.type === type) || null;
}

export function getNextKnockoutRound(currentType) {
  if (!currentType) return KNOCKOUT_ROUNDS[0]?.type ?? null;
  const index = KNOCKOUT_ROUNDS.findIndex((round) => round.type === currentType);
  if (index < 0 || index >= KNOCKOUT_ROUNDS.length - 1) return null;
  return KNOCKOUT_ROUNDS[index + 1].type;
}

export function isGroupStageComplete(groupMatches, finishedCount) {
  return finishedCount >= groupMatches.length && groupMatches.length > 0;
}

export function isKnockoutRoundComplete(roundMatches) {
  return roundMatches.length > 0 && roundMatches.every((match) => match.status === 'finished');
}
