import {
  apiFootballGet,
  ApiFootballNotConfiguredError,
  isApiFootballConfigured,
} from './apiFootballClient.js';

export const WORLD_CUP_LEAGUE_ID = 1;
export const WORLD_CUP_SEASON = 2026;
export const FRIENDLY_LOOKBACK_DAYS = 30;

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const LIVE_STATUSES = new Set(['LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT']);

export function isNationalFriendlyLeagueName(name) {
  const n = String(name || '').toLowerCase();
  if (!n.includes('friend')) return false;
  if (n.includes('club') || n.includes('women') || n.includes('woman')) return false;
  return true;
}

export function mapFixtureStatus(short) {
  const code = String(short || '').toUpperCase();
  if (FINISHED_STATUSES.has(code)) return 'finished';
  if (LIVE_STATUSES.has(code)) return 'live';
  if (code === 'PST' || code === 'CANC' || code === 'ABD' || code === 'SUSP') {
    return 'cancelled';
  }
  return 'scheduled';
}

export function formatDateYmd(date) {
  return date.toISOString().slice(0, 10);
}

export function getLastMonthDateRange(now = new Date()) {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - FRIENDLY_LOOKBACK_DAYS);
  return { from: formatDateYmd(from), to: formatDateYmd(to) };
}

function normalizeApiTeam(team) {
  if (!team?.id) return null;
  return {
    apiFootballId: team.id,
    nameEn: team.name || '',
    fifaCode: (team.code || '').toUpperCase(),
    flag: team.logo || '',
  };
}

export function normalizeFriendlyFixture(item) {
  const statusShort = item.fixture?.status?.short;
  const mappedStatus = mapFixtureStatus(statusShort);
  const home = normalizeApiTeam(item.teams?.home);
  const away = normalizeApiTeam(item.teams?.away);

  return {
    id: item.fixture?.id,
    kickoffAt: item.fixture?.date || null,
    status: mappedStatus,
    statusLabel: item.fixture?.status?.long || statusShort || '',
    leagueName: item.league?.name || '',
    venue: item.fixture?.venue?.name || '',
    homeTeam: home,
    awayTeam: away,
    homeScore:
      mappedStatus === 'finished' || mappedStatus === 'live'
        ? item.goals?.home ?? null
        : null,
    awayScore:
      mappedStatus === 'finished' || mappedStatus === 'live'
        ? item.goals?.away ?? null
        : null,
  };
}

export function filterWorldCupFriendlyFixtures(fixtures, worldCupTeamIds) {
  const idSet = worldCupTeamIds instanceof Set ? worldCupTeamIds : new Set(worldCupTeamIds);

  return fixtures.filter((item) => {
    const homeId = item.teams?.home?.id;
    const awayId = item.teams?.away?.id;
    if (!homeId || !awayId) return false;
    if (!idSet.has(homeId) || !idSet.has(awayId)) return false;
    return isNationalFriendlyLeagueName(item.league?.name);
  });
}

export function sortFixturesByKickoff(fixtures, direction = 'desc') {
  return [...fixtures].sort((a, b) => {
    const ta = new Date(a.fixture?.date || 0).getTime();
    const tb = new Date(b.fixture?.date || 0).getTime();
    return direction === 'desc' ? tb - ta : ta - tb;
  });
}

export function normalizeInjuryRow(item) {
  const player = item.player || {};
  const team = item.team || {};
  return {
    playerId: player.id,
    playerName: player.name || '—',
    playerPhoto: player.photo || '',
    teamId: team.id,
    teamName: team.name || '—',
    teamCode: (team.code || '').toUpperCase(),
    teamLogo: team.logo || '',
    type: item.type || '',
    reason: item.reason || '',
  };
}

export function dedupeInjuries(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.playerId ?? row.playerName}-${row.teamId ?? row.teamName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.sort((a, b) =>
    (a.teamName || '').localeCompare(b.teamName || '', 'es') ||
    (a.playerName || '').localeCompare(b.playerName || '', 'es')
  );
}

async function fetchWorldCupTeams() {
  const body = await apiFootballGet('/teams', {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });
  const list = body.response || [];
  const teams = list
    .map((row) => normalizeApiTeam(row.team))
    .filter(Boolean);
  const teamIds = new Set(teams.map((t) => t.apiFootballId));
  return { teams, teamIds };
}

async function discoverFriendlyLeagueIds() {
  const body = await apiFootballGet('/leagues', { search: 'Friendlies' });
  const leagues = body.response || [];
  const ids = new Set();

  for (const entry of leagues) {
    const league = entry.league || entry;
    const name = league.name || '';
    if (!isNationalFriendlyLeagueName(name)) continue;
    if (league.id) ids.add(league.id);
  }

  return [...ids];
}

async function fetchFixturesForLeagueInRange(leagueId, from, to) {
  const body = await apiFootballGet('/fixtures', { league: leagueId, from, to });
  return body.response || [];
}

async function fetchFriendliesInRange(teamIds, from, to) {
  const leagueIds = await discoverFriendlyLeagueIds();
  const batches = await Promise.all(
    leagueIds.map((leagueId) => fetchFixturesForLeagueInRange(leagueId, from, to))
  );

  let raw = batches.flat();

  if (raw.length === 0) {
    const fallback = await apiFootballGet('/fixtures', { from, to });
    raw = filterWorldCupFriendlyFixtures(fallback.response || [], teamIds);
  } else {
    raw = filterWorldCupFriendlyFixtures(raw, teamIds);
  }

  const sorted = sortFixturesByKickoff(raw, 'desc');
  const seenFixtureIds = new Set();
  const unique = [];

  for (const item of sorted) {
    const id = item.fixture?.id;
    if (!id || seenFixtureIds.has(id)) continue;
    seenFixtureIds.add(id);
    unique.push(item);
  }

  return unique.map(normalizeFriendlyFixture);
}

async function fetchInjuriesForTeams(teamIds) {
  const rows = [];
  const chunkSize = 6;

  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (teamId) => {
        try {
          const body = await apiFootballGet('/injuries', { team: teamId, season: WORLD_CUP_SEASON });
          return body.response || [];
        } catch {
          try {
            const body = await apiFootballGet('/injuries', { team: teamId });
            return body.response || [];
          } catch {
            return [];
          }
        }
      })
    );
    rows.push(...results.flat());
  }

  return dedupeInjuries(rows.map(normalizeInjuryRow));
}

export async function buildApiFootballStats() {
  if (!isApiFootballConfigured()) {
    return {
      configured: false,
      friendlies: [],
      injuries: [],
      worldCupTeams: [],
      period: getLastMonthDateRange(),
      message: 'Configurá API_FOOTBALL_KEY en el servidor para ver amistosos y lesiones.',
    };
  }

  try {
    const { from, to } = getLastMonthDateRange();
    const { teams, teamIds } = await fetchWorldCupTeams();
    const teamIdList = [...teamIds];

    const [friendlies, injuries] = await Promise.all([
      fetchFriendliesInRange(teamIds, from, to),
      fetchInjuriesForTeams(teamIdList),
    ]);

    return {
      configured: true,
      friendlies,
      injuries,
      worldCupTeams: teams,
      period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    const { from, to } = getLastMonthDateRange();
    return {
      configured: true,
      friendlies: [],
      injuries: [],
      worldCupTeams: [],
      period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
      apiError: err.message || 'Error al consultar API-Football',
      message: err.message || 'Error al consultar API-Football',
    };
  }
}
