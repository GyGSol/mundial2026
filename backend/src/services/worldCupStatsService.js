import { SimulationState } from '../models/SimulationState.js';

const GROUP_LETTERS = 'ABCDEFGHIJKL'.split('');

const KNOCKOUT_PHASES = [
  { keys: ['round_of_32', 'roundof32', 'r32', '32'], label: 'Dieciseisavos de final', order: 1 },
  { keys: ['round_of_16', 'roundof16', 'r16', '16'], label: 'Octavos de final', order: 2 },
  {
    keys: ['quarter_final', 'quarterfinal', 'quarter', 'qf'],
    label: 'Cuartos de final',
    order: 3,
  },
  { keys: ['semi_final', 'semifinal', 'semi', 'sf'], label: 'Semifinales', order: 4 },
  {
    keys: ['third_place', 'thirdplace', 'third', '3rd'],
    label: 'Tercer puesto',
    order: 5,
  },
  { keys: ['final', 'f'], label: 'Final', order: 6 },
];

function normalizePhaseKey(type) {
  return String(type || 'group')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function resolveKnockoutPhase(type) {
  const key = normalizePhaseKey(type);
  if (key === 'group') return null;

  return (
    KNOCKOUT_PHASES.find((phase) => phase.keys.some((candidate) => key.includes(candidate))) ||
    null
  );
}

function createStanding(team) {
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

function applyResult(standing, goalsFor, goalsAgainst) {
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

function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return (a.nameEn || '').localeCompare(b.nameEn || '');
  });
}

function extractApiStandings(groupDoc) {
  const raw = groupDoc?.raw ?? groupDoc;
  const table =
    raw?.matchTable ??
    raw?.match_table ??
    raw?.standings ??
    raw?.table ??
    groupDoc?.teams?.standings;

  if (!Array.isArray(table) || table.length === 0) return null;

  return table.map((row, index) => ({
    rank: row.rank ?? row.position ?? index + 1,
    teamId: String(row.team_id ?? row.teamId ?? row.id ?? row.team ?? ''),
    nameEn: row.name_en ?? row.name ?? row.team_name ?? '',
    fifaCode: row.fifa_code ?? row.fifaCode ?? '',
    flag: row.flag ?? '',
    played: Number(row.played ?? row.pj ?? row.mp ?? 0),
    won: Number(row.won ?? row.pg ?? row.w ?? 0),
    drawn: Number(row.drawn ?? row.pe ?? row.d ?? 0),
    lost: Number(row.lost ?? row.pp ?? row.l ?? 0),
    goalsFor: Number(row.goals_for ?? row.gf ?? row.goalsFor ?? 0),
    goalsAgainst: Number(row.goals_against ?? row.gc ?? row.goalsAgainst ?? 0),
    goalDiff: Number(
      row.goal_diff ??
        row.dg ??
        row.goalDiff ??
        (row.goals_for ?? row.gf ?? 0) - (row.goals_against ?? row.gc ?? 0)
    ),
    points: Number(row.points ?? row.pts ?? row.pt ?? 0),
    source: 'api',
  }));
}

export function computeGroupStandings(teams, matches, groupDocs = []) {
  const teamsByGroup = new Map();
  for (const team of teams) {
    const groupName = String(team.group || '').toUpperCase();
    if (!groupName) continue;
    if (!teamsByGroup.has(groupName)) teamsByGroup.set(groupName, []);
    teamsByGroup.get(groupName).push(team);
  }

  const apiByGroup = new Map();
  for (const groupDoc of groupDocs) {
    const groupName = String(groupDoc.name || '').toUpperCase();
    const apiRows = extractApiStandings(groupDoc);
    if (apiRows?.length) apiByGroup.set(groupName, apiRows);
  }

  const computed = new Map();
  for (const [groupName, groupTeams] of teamsByGroup.entries()) {
    const standingsMap = new Map(groupTeams.map((team) => [team.externalId, createStanding(team)]));

    for (const match of matches) {
      if (match.status !== 'finished') continue;
      if (normalizePhaseKey(match.type) !== 'group' && match.group?.toUpperCase() !== groupName) {
        continue;
      }
      if (String(match.group || '').toUpperCase() !== groupName) continue;

      const home = standingsMap.get(match.homeTeamId);
      const away = standingsMap.get(match.awayTeamId);
      if (!home || !away) continue;

      applyResult(home, match.homeScore, match.awayScore);
      applyResult(away, match.awayScore, match.homeScore);
    }

    computed.set(groupName, sortStandings([...standingsMap.values()]).map((row, index) => ({
      ...row,
      rank: index + 1,
      source: 'computed',
    })));
  }

  const allGroups = new Set([
    ...GROUP_LETTERS.filter((letter) => teamsByGroup.has(letter) || apiByGroup.has(letter)),
    ...teamsByGroup.keys(),
    ...apiByGroup.keys(),
  ]);

  return [...allGroups]
    .sort()
    .map((groupName) => ({
      group: groupName,
      standings: apiByGroup.get(groupName) || computed.get(groupName) || [],
      source: apiByGroup.has(groupName) ? 'api' : 'computed',
    }))
    .filter((entry) => entry.standings.length > 0);
}

function formatTeamRef(team) {
  if (!team) return null;
  return {
    externalId: team.externalId,
    nameEn: team.nameEn,
    fifaCode: team.fifaCode,
    flag: team.flag,
  };
}

function isSimulationMatch(match) {
  return String(match.externalId || '').startsWith('sim-');
}

function hasBothTeamsAssigned(match, teamMap) {
  const homeId = match.homeTeamId;
  const awayId = match.awayTeamId;
  if (!homeId || !awayId || homeId === '0' || awayId === '0') return false;
  return Boolean(teamMap[homeId] && teamMap[awayId]);
}

export function formatMatchSummary(match, teamMap, stadiumMap = {}) {
  const phase = resolveKnockoutPhase(match.type);
  const stadium = stadiumMap[match.stadiumId];

  return {
    id: match._id?.toString?.() ?? match.id,
    externalId: match.externalId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    group: match.group,
    matchday: match.matchday,
    localDate: match.localDate,
    status: match.status,
    kickoffAt: match.kickoffAt,
    type: match.type,
    phaseLabel: phase?.label ?? (normalizePhaseKey(match.type) === 'group' ? 'Fase de grupos' : match.type),
    homeTeam: formatTeamRef(teamMap[match.homeTeamId]),
    awayTeam: formatTeamRef(teamMap[match.awayTeamId]),
    stadium: stadium
      ? {
          externalId: stadium.externalId,
          nameEn: stadium.nameEn,
          city: stadium.city,
          country: stadium.country,
        }
      : match.stadiumId
        ? { externalId: match.stadiumId }
        : null,
    raw: match.raw ?? null,
  };
}

export function buildKnockoutPhases(matches, teamMap, stadiumMap = {}) {
  const buckets = new Map();
  const knockoutMatches = matches.filter((match) => resolveKnockoutPhase(match.type));
  const hasSimKnockout = knockoutMatches.some(isSimulationMatch);

  for (const match of knockoutMatches) {
    if (hasSimKnockout && !isSimulationMatch(match)) continue;
    if (!hasBothTeamsAssigned(match, teamMap)) continue;

    const phase = resolveKnockoutPhase(match.type);
    if (!phase) continue;

    if (!buckets.has(phase.order)) {
      buckets.set(phase.order, { ...phase, matches: [] });
    }

    buckets.get(phase.order).matches.push(formatMatchSummary(match, teamMap, stadiumMap));
  }

  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map((phase) => ({
      key: phase.keys[0],
      label: phase.label,
      order: phase.order,
      matches: phase.matches.sort(
        (a, b) => new Date(a.kickoffAt || 0) - new Date(b.kickoffAt || 0)
      ),
    }));
}

export function computeTournamentStats(matches, teams) {
  const finished = matches.filter((m) => m.status === 'finished');
  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches.filter((m) => m.status === 'upcoming');

  let totalGoals = 0;
  let draws = 0;
  let homeWins = 0;
  let awayWins = 0;
  let highestScoring = null;
  const goalsByTeam = new Map();
  const goalsByGroup = new Map();
  const typeCounts = new Map();

  for (const match of matches) {
    const typeKey = normalizePhaseKey(match.type);
    typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);
  }

  for (const match of finished) {
    const total = match.homeScore + match.awayScore;
    totalGoals += total;

    if (match.homeScore === match.awayScore) draws += 1;
    else if (match.homeScore > match.awayScore) homeWins += 1;
    else awayWins += 1;

    if (!highestScoring || total > highestScoring.totalGoals) {
      highestScoring = {
        externalId: match.externalId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        totalGoals: total,
        localDate: match.localDate,
        group: match.group,
        type: match.type,
      };
    }

    for (const [teamId, goals] of [
      [match.homeTeamId, match.homeScore],
      [match.awayTeamId, match.awayScore],
    ]) {
      goalsByTeam.set(teamId, (goalsByTeam.get(teamId) || 0) + goals);
    }

    if (match.group) {
      const groupName = String(match.group).toUpperCase();
      goalsByGroup.set(groupName, (goalsByGroup.get(groupName) || 0) + total);
    }
  }

  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const topScorers = [...goalsByTeam.entries()]
    .map(([teamId, goals]) => {
      const team = teamMap[teamId];
      return {
        teamId,
        nameEn: team?.nameEn ?? teamId,
        fifaCode: team?.fifaCode ?? '',
        flag: team?.flag ?? '',
        goals,
      };
    })
    .sort((a, b) => b.goals - a.goals || a.nameEn.localeCompare(b.nameEn))
    .slice(0, 10);

  const goalsByGroupRows = [...goalsByGroup.entries()]
    .map(([group, goals]) => ({ group, goals }))
    .sort((a, b) => a.group.localeCompare(b.group));

  return {
    teams: teams.length,
    matches: {
      total: matches.length,
      finished: finished.length,
      live: live.length,
      upcoming: upcoming.length,
      byType: Object.fromEntries(typeCounts),
    },
    goals: {
      total: totalGoals,
      averagePerMatch: finished.length ? Number((totalGoals / finished.length).toFixed(2)) : 0,
      draws,
      homeWins,
      awayWins,
      byGroup: goalsByGroupRows,
      topScoringTeams: topScorers,
      highestScoringMatch: highestScoring,
    },
  };
}

export async function buildWorldCupOverview({
  Match,
  Team,
  Group,
  Stadium,
  getLastSyncAt,
  competitionGroupId = null,
  buildMatchPredictionRankings,
}) {
  const [teams, matches, groups, stadiums] = await Promise.all([
    Team.find().sort({ nameEn: 1 }),
    Match.find().sort({ kickoffAt: 1 }),
    Group.find().sort({ name: 1 }),
    Stadium.find().sort({ nameEn: 1 }),
  ]);

  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  const groupStandings = computeGroupStandings(teams, matches, groups);
  const knockout = buildKnockoutPhases(matches, teamMap, stadiumMap);
  const stats = computeTournamentStats(matches, teams);

  const groupMatches = matches
    .filter((m) => normalizePhaseKey(m.type) === 'group' || Boolean(m.group))
    .map((m) => formatMatchSummary(m, teamMap, stadiumMap));

  const stadiumUsage = stadiums.map((stadium) => {
    const hosted = matches.filter((m) => m.stadiumId === stadium.externalId);
    const finishedHosted = hosted.filter((m) => m.status === 'finished');
    const goals = finishedHosted.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0);

    return {
      externalId: stadium.externalId,
      nameEn: stadium.nameEn,
      city: stadium.city,
      country: stadium.country,
      capacity: stadium.capacity,
      matchesHosted: hosted.length,
      matchesFinished: finishedHosted.length,
      goalsScored: goals,
    };
  });

  const finishedMatches = matches.filter((match) => match.status === 'finished');
  let predictionGroup = null;
  let simulationPredictionGroup = null;
  let matchPredictionRankings = {};

  if (competitionGroupId && buildMatchPredictionRankings) {
    const rankings = await buildMatchPredictionRankings(competitionGroupId, finishedMatches);
    predictionGroup = rankings.group;
    matchPredictionRankings = rankings.rankingsByMatch;
  }

  const simState = await SimulationState.findOne({ key: 'active' });
  if (simState?.groupId && buildMatchPredictionRankings) {
    const simFinished = await Match.find({
      _id: { $in: simState.matchIds },
      status: 'finished',
    });
    if (simFinished.length) {
      const simRankings = await buildMatchPredictionRankings(
        simState.groupId.toString(),
        simFinished
      );
      simulationPredictionGroup = simRankings.group;
      matchPredictionRankings = {
        ...matchPredictionRankings,
        ...simRankings.rankingsByMatch,
      };
    }
  }

  return {
    lastSyncAt: await getLastSyncAt(),
    groups: groupStandings,
    knockout,
    groupMatches,
    predictionGroup,
    simulationPredictionGroup,
    matchPredictionRankings,
    teams: teams.map((t) => ({
      externalId: t.externalId,
      nameEn: t.nameEn,
      nameFa: t.nameFa,
      fifaCode: t.fifaCode,
      group: t.group,
      flag: t.flag,
    })),
    stadiums: stadiumUsage,
    stats,
  };
}
