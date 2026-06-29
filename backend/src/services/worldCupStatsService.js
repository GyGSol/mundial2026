import {
  applyResult,
  createStanding,
  sortStandings,
  totalPlayedInStandings,
} from './groupStandingsUtils.js';
import { rankBestThirdPlaceTeams } from './thirdPlaceRanking.js';
import { resolveFieldMatchScores, resolvePenaltyShootoutFromMatch } from '../../../shared/matchDisplayScore.js';

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

/** Prefiere la fuente con más partidos jugados (API puede venir en cero al inicio del torneo). */
export function resolveGroupStandingsSource(apiRows, computedRows) {
  const computed = computedRows ?? [];
  if (!apiRows?.length) {
    return { standings: computed, source: 'computed' };
  }

  const apiPlayed = totalPlayedInStandings(apiRows);
  const computedPlayed = totalPlayedInStandings(computed);

  if (computedPlayed > apiPlayed) {
    return { standings: computed, source: 'computed' };
  }

  return { standings: apiRows, source: 'api' };
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
      if (match.status !== 'finished' && match.status !== 'live') continue;
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
    .map((groupName) => {
      const resolved = resolveGroupStandingsSource(
        apiByGroup.get(groupName),
        computed.get(groupName)
      );
      let standings = resolved.standings;
      if (totalPlayedInStandings(standings) === 0) {
        standings = sortStandings(standings).map((row, index) => ({
          ...row,
          rank: index + 1,
        }));
      }
      return {
        group: groupName,
        standings,
        source: resolved.source,
      };
    })
    .filter((entry) => entry.standings.length > 0);
}

/** Mundial 2026: top 2 per group + 8 best third places → round of 32. */
export function annotateGroupQualification(groupStandings) {
  const { qualified, provisional } = rankBestThirdPlaceTeams(groupStandings);
  const qualifiedThirdIds = qualified.length
    ? new Set(qualified.map((row) => row.teamId))
    : null;

  return groupStandings.map((groupTable) => ({
    ...groupTable,
    standings: groupTable.standings.map((row) => {
      if (row.rank <= 2) {
        return { ...row, qualificationZone: 'direct' };
      }
      if (row.rank === 3) {
        if (qualifiedThirdIds?.has(row.teamId)) {
          return {
            ...row,
            qualificationZone: provisional ? 'third_provisional' : 'direct',
          };
        }
        return { ...row, qualificationZone: 'third_possible' };
      }
      return { ...row, qualificationZone: null };
    }),
  }));
}

function formatTeamRef(team, rankings = null) {
  return formatTeamForClient(team, rankings);
}

function isSimulationMatch(match) {
  return String(match.externalId || '').startsWith('sim-');
}

import { getBroadcastersForMatch } from '../data/broadcastSchedule.js';
import { formatStadiumForClient } from './stadiumPayload.js';
import { formatTeamForClient } from './teamPayload.js';
import { getFifaWorldRankings } from './aiTeamMatchContextService.js';

function isTeamSlotAssigned(teamId, teamMap) {
  if (!teamId || teamId === '0') return false;
  return Boolean(teamMap[teamId]);
}

function extractRawTeamSlotLabel(match, side) {
  const raw = match.raw ?? {};
  const snakeKey = side === 'home' ? 'home_team_label' : 'away_team_label';
  const camelKey = side === 'home' ? 'homeTeamLabel' : 'awayTeamLabel';
  return String(raw[snakeKey] ?? raw[camelKey] ?? '').trim() || null;
}

/** Traduce etiquetas oficiales de cruces (inglés) a texto breve en español. */
export function formatKnockoutSlotLabelEs(label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) return null;

  let match = trimmed.match(/^Winner Group ([A-L])$/i);
  if (match) return `1.º del grupo ${match[1]}`;

  match = trimmed.match(/^(?:Runner-up|2nd position) Group ([A-L])$/i);
  if (match) return `2.º del grupo ${match[1]}`;

  match = trimmed.match(/^3rd Group (.+)$/i);
  if (match) {
    const groups = match[1]
      .split(/[/,\s]+/)
      .map((part) => part.trim().toUpperCase())
      .filter((part) => /^[A-L]$/.test(part))
      .join('/');
    return `3.º mejor (${groups})`;
  }

  match = trimmed.match(/^Best 3rd place Groups? (.+)$/i);
  if (match) {
    const groups = match[1]
      .split(/[/,\s]+/)
      .map((part) => part.trim().toUpperCase())
      .filter((part) => /^[A-L]$/.test(part))
      .join('/');
    return `3.º mejor (${groups})`;
  }

  match = trimmed.match(/^Winner Match (\d+)$/i);
  if (match) return `Ganador del partido ${match[1]}`;

  match = trimmed.match(/^Loser Match (\d+)$/i);
  if (match) return `Perdedor del partido ${match[1]}`;

  return trimmed;
}

export function buildMatchSidesPreview(match, teamMap) {
  const homeTeam = isTeamSlotAssigned(match.homeTeamId, teamMap)
    ? formatTeamRef(teamMap[match.homeTeamId])
    : null;
  const awayTeam = isTeamSlotAssigned(match.awayTeamId, teamMap)
    ? formatTeamRef(teamMap[match.awayTeamId])
    : null;

  return {
    homeTeam,
    awayTeam,
    homeTeamSlotLabel: homeTeam ? null : resolveTeamSlotLabel(match, 'home', teamMap),
    awayTeamSlotLabel: awayTeam ? null : resolveTeamSlotLabel(match, 'away', teamMap),
  };
}

function formatMatchSideShortLabel(team, slotLabel) {
  if (team?.fifaCode) return team.fifaCode;
  if (slotLabel) return slotLabel;
  return '?';
}

export function buildWinnerMatchSlotDisplay(sourceSides) {
  if (!sourceSides) {
    return { slotLabel: null, slotSourceMatch: null };
  }

  const homePart = formatMatchSideShortLabel(sourceSides.homeTeam, sourceSides.homeTeamSlotLabel);
  const awayPart = formatMatchSideShortLabel(sourceSides.awayTeam, sourceSides.awayTeamSlotLabel);

  return {
    slotLabel: `Ganador de ${homePart} vs ${awayPart}`,
    slotSourceMatch: sourceSides,
  };
}

export function buildLoserMatchSlotDisplay(sourceSides) {
  if (!sourceSides) {
    return { slotLabel: null, slotSourceMatch: null };
  }

  const homePart = formatMatchSideShortLabel(sourceSides.homeTeam, sourceSides.homeTeamSlotLabel);
  const awayPart = formatMatchSideShortLabel(sourceSides.awayTeam, sourceSides.awayTeamSlotLabel);

  return {
    slotLabel: `Perdedor de ${homePart} vs ${awayPart}`,
    slotSourceMatch: sourceSides,
  };
}

function resolveWinnerMatchSlot(rawLabel, matchesByExternalId, teamMap, resolvedMatchSides) {
  const match = rawLabel.match(/^Winner Match (\d+)$/i);
  if (!match) return null;

  const matchId = match[1];
  const sourceSides =
    resolvedMatchSides?.get(matchId) ??
    (matchesByExternalId?.get(matchId)
      ? buildMatchSidesPreview(matchesByExternalId.get(matchId), teamMap)
      : null);

  if (!sourceSides) return null;
  return buildWinnerMatchSlotDisplay(sourceSides);
}

function resolveLoserMatchSlot(rawLabel, matchesByExternalId, teamMap, resolvedMatchSides) {
  const match = rawLabel.match(/^Loser Match (\d+)$/i);
  if (!match) return null;

  const matchId = match[1];
  const sourceSides =
    resolvedMatchSides?.get(matchId) ??
    (matchesByExternalId?.get(matchId)
      ? buildMatchSidesPreview(matchesByExternalId.get(matchId), teamMap)
      : null);

  if (!sourceSides) return null;
  return buildLoserMatchSlotDisplay(sourceSides);
}

function resolveTeamSlotLabel(match, side, teamMap) {
  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
  if (isTeamSlotAssigned(teamId, teamMap)) return null;
  const rawLabel = extractRawTeamSlotLabel(match, side);
  return rawLabel ? formatKnockoutSlotLabelEs(rawLabel) : null;
}

function resolveTeamSlot(match, side, teamMap, context = {}) {
  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
  if (isTeamSlotAssigned(teamId, teamMap)) {
    return { slotLabel: null, slotSourceMatch: null };
  }

  const rawLabel = extractRawTeamSlotLabel(match, side);
  if (!rawLabel) return { slotLabel: null, slotSourceMatch: null };

  const winnerSlot = resolveWinnerMatchSlot(
    rawLabel,
    context.matchesByExternalId,
    teamMap,
    context.resolvedMatchSides
  );
  if (winnerSlot) return winnerSlot;

  const loserSlot = resolveLoserMatchSlot(
    rawLabel,
    context.matchesByExternalId,
    teamMap,
    context.resolvedMatchSides
  );
  if (loserSlot) return loserSlot;

  return {
    slotLabel: formatKnockoutSlotLabelEs(rawLabel),
    slotSourceMatch: null,
  };
}

export function formatMatchSummary(match, teamMap, stadiumMap = {}, rankings = null, context = {}) {
  const phase = resolveKnockoutPhase(match.type);
  const stadium = stadiumMap[match.stadiumId];
  const homeSlot = resolveTeamSlot(match, 'home', teamMap, context);
  const awaySlot = resolveTeamSlot(match, 'away', teamMap, context);
  const penaltyShootout = resolvePenaltyShootoutFromMatch(match);
  const fieldScores = resolveFieldMatchScores({
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    raw: match.raw,
    penaltyShootout,
  });

  return {
    id: match._id?.toString?.() ?? match.id,
    externalId: match.externalId,
    homeScore: fieldScores.homeScore,
    awayScore: fieldScores.awayScore,
    penaltyShootout,
    group: match.group,
    matchday: match.matchday,
    localDate: match.localDate,
    status: match.status,
    kickoffAt: match.kickoffAt,
    kickoffTimezone: match.kickoffTimezone || stadium?.timezone || null,
    type: match.type,
    phaseLabel: phase?.label ?? (normalizePhaseKey(match.type) === 'group' ? 'Fase de grupos' : match.type),
    homeTeam: isTeamSlotAssigned(match.homeTeamId, teamMap)
      ? formatTeamRef(teamMap[match.homeTeamId], rankings)
      : null,
    awayTeam: isTeamSlotAssigned(match.awayTeamId, teamMap)
      ? formatTeamRef(teamMap[match.awayTeamId], rankings)
      : null,
    homeTeamSlotLabel: homeSlot.slotLabel,
    awayTeamSlotLabel: awaySlot.slotLabel,
    homeTeamSlotSourceMatch: homeSlot.slotSourceMatch,
    awayTeamSlotSourceMatch: awaySlot.slotSourceMatch,
    broadcasters: getBroadcastersForMatch(match.externalId, {
      homeTeam: teamMap[match.homeTeamId],
      awayTeam: teamMap[match.awayTeamId],
    }),
    stadium: stadium
      ? formatStadiumForClient(stadium)
      : match.stadiumId
        ? { externalId: match.stadiumId }
        : null,
  };
}

/** Campos mínimos de partido para overview (sin blob `raw` completo). */
export const WORLD_CUP_MATCH_SELECT =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate status kickoffAt kickoffTimezone type stadiumId raw.home_team_label raw.away_team_label raw.homeTeamLabel raw.awayTeamLabel raw.fifaMeta';

export function buildKnockoutPhases(matches, teamMap, stadiumMap = {}, rankings = null) {
  const buckets = new Map();
  const knockoutMatches = matches.filter((match) => resolveKnockoutPhase(match.type));
  const hasSimKnockout = knockoutMatches.some(isSimulationMatch);
  const matchesByExternalId = new Map(
    knockoutMatches.map((match) => [String(match.externalId), match])
  );

  for (const match of knockoutMatches) {
    if (hasSimKnockout && !isSimulationMatch(match)) continue;

    const phase = resolveKnockoutPhase(match.type);
    if (!phase) continue;

    if (!buckets.has(phase.order)) {
      buckets.set(phase.order, { ...phase, matches: [] });
    }

    buckets.get(phase.order).matches.push(
      formatMatchSummary(match, teamMap, stadiumMap, rankings, { matchesByExternalId })
    );
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
  includePlayerStats = false,
}) {
  const { ensureOfficialKnockoutMatches } = await import('./syncService.js');
  await ensureOfficialKnockoutMatches();

  const [teams, matches, groups, stadiums] = await Promise.all([
    Team.find().select('externalId nameEn nameFa fifaCode group flag').sort({ nameEn: 1 }).lean(),
    Match.find().select(WORLD_CUP_MATCH_SELECT).sort({ kickoffAt: 1 }).lean(),
    Group.find().select('name raw').sort({ name: 1 }).lean(),
    Stadium.find()
      .select('externalId nameEn city country capacity timezone')
      .sort({ nameEn: 1 })
      .lean(),
  ]);

  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));
  const fifaRankings = await getFifaWorldRankings();

  const rawStandings = computeGroupStandings(teams, matches, groups);
  const thirdPlaceStandings = rankBestThirdPlaceTeams(rawStandings);
  const groupStandings = annotateGroupQualification(rawStandings);

  let knockout = buildKnockoutPhases(matches, teamMap, stadiumMap, fifaRankings);
  const officialKnockoutMatches = matches.filter((match) => {
    const id = String(match.externalId || '');
    return /^\d+$/.test(id) && Number(id) >= 73 && Number(id) <= 104;
  });

  if (officialKnockoutMatches.length) {
    const { buildPredictedKnockoutPhases } = await import('./predictedKnockoutService.js');
    const resolved = buildPredictedKnockoutPhases({
      groupStandings,
      knockoutMatches: officialKnockoutMatches,
      predictionsByMatchId: new Map(),
      teamMap,
      stadiumMap,
    });
    if (resolved.phases.length) {
      knockout = resolved.phases;
    }
  }
  const stats = computeTournamentStats(matches, teams);

  let tournament2026PlayerStats = null;
  if (includePlayerStats) {
    try {
      const { buildWorldCup2026PlayerStats } = await import('./worldCupHistoryService.js');
      tournament2026PlayerStats = await buildWorldCup2026PlayerStats();
    } catch {
      tournament2026PlayerStats = null;
    }
  }

  const groupMatches = matches
    .filter((m) => {
      const id = String(m.externalId || '');
      if (/^\d+$/.test(id) && Number(id) >= 73 && Number(id) <= 104) return false;
      return normalizePhaseKey(m.type) === 'group' || Boolean(m.group);
    })
    .map((m) => formatMatchSummary(m, teamMap, stadiumMap, fifaRankings));

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

  return {
    lastSyncAt: await getLastSyncAt(),
    groups: groupStandings,
    thirdPlaceStandings: {
      ranked: thirdPlaceStandings.ranked,
      provisional: thirdPlaceStandings.provisional,
      combinationKey: thirdPlaceStandings.combinationKey,
    },
    knockout,
    groupMatches,
    teams: teams.map((t) => ({
      ...formatTeamForClient(t, fifaRankings),
      nameFa: t.nameFa,
      group: t.group,
    })),
    stadiums: stadiumUsage,
    stats,
    tournament2026PlayerStats,
  };
}
