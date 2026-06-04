import { env } from '../config/env.js';
import {
  apiFootballGet,
  isApiFootballConfigured,
} from './apiFootballClient.js';

export const WORLD_CUP_LEAGUE_ID = 1;
export const WORLD_CUP_SEASON_TARGET = 2026;
export const FRIENDLY_LOOKBACK_DAYS = 30;

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const LIVE_STATUSES = new Set(['LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT']);

export function getApiFootballSeason() {
  const season = Number(env.apiFootballSeason);
  return Number.isFinite(season) && season > 0 ? season : 2024;
}

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

/** Mismo mes/día que el rango actual, en el año de la temporada API (plan free). */
export function shiftDateRangeToSeason(from, to, season) {
  return {
    from: `${season}${String(from).slice(4)}`,
    to: `${season}${String(to).slice(4)}`,
  };
}

export function filterFixturesByDateRange(fixtures, from, to) {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T23:59:59Z`).getTime();
  return fixtures.filter((item) => {
    const ms = new Date(item.fixture?.date || 0).getTime();
    return ms >= fromMs && ms <= toMs;
  });
}

function normalizeApiTeam(team, fallback = {}) {
  if (!team?.id) return null;
  return {
    apiFootballId: team.id,
    nameEn: team.name || fallback.nameEn || '',
    fifaCode: (team.code || fallback.fifaCode || '').toUpperCase(),
    flag: team.logo || fallback.flag || '',
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

export function buildDbTeamMatchers(dbTeams) {
  const codes = new Set(
    dbTeams.map((t) => (t.fifaCode || '').toUpperCase()).filter(Boolean)
  );
  const names = new Set(
    dbTeams.map((t) => (t.nameEn || '').trim().toLowerCase()).filter(Boolean)
  );
  return { codes, names };
}

export function fixtureHasDbTeams(item, matchers) {
  const home = item.teams?.home;
  const away = item.teams?.away;
  if (!home?.id || !away?.id) return false;

  const homeCode = (home.code || '').toUpperCase();
  const awayCode = (away.code || '').toUpperCase();
  if (matchers.codes.has(homeCode) && matchers.codes.has(awayCode)) return true;

  const homeName = (home.name || '').trim().toLowerCase();
  const awayName = (away.name || '').trim().toLowerCase();
  return matchers.names.has(homeName) && matchers.names.has(awayName);
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

export function filterDbTeamFriendlies(fixtures, dbTeams) {
  const matchers = buildDbTeamMatchers(dbTeams);
  return fixtures.filter(
    (item) =>
      isNationalFriendlyLeagueName(item.league?.name) && fixtureHasDbTeams(item, matchers)
  );
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

export function pickApiTeamMatch(rows, dbTeam) {
  const code = (dbTeam.fifaCode || '').toUpperCase();
  if (code) {
    const byCode = rows.find((r) => (r.team?.code || '').toUpperCase() === code);
    if (byCode?.team?.id) return byCode.team;
  }
  const national = rows.find((r) => r.team?.national === true);
  return national?.team || rows[0]?.team || null;
}

export function filterInjuriesForDbTeams(rows, dbTeams) {
  const matchers = buildDbTeamMatchers(dbTeams);
  return rows.filter((item) => {
    const code = (item.team?.code || '').toUpperCase();
    if (code && matchers.codes.has(code)) return true;
    const name = (item.team?.name || '').trim().toLowerCase();
    return matchers.names.has(name);
  });
}

async function loadDbTeams(Team) {
  if (!Team) return [];
  return Team.find().select('nameEn fifaCode flag').lean();
}

async function fetchWorldCupTeamsFromLeague(season) {
  const body = await apiFootballGet('/teams', {
    league: WORLD_CUP_LEAGUE_ID,
    season,
  });
  const list = body.response || [];
  const teams = list.map((row) => normalizeApiTeam(row.team)).filter(Boolean);
  const teamIds = new Set(teams.map((t) => t.apiFootballId));
  return { teams, teamIds };
}

async function fetchWorldCupTeams(Team, season) {
  if (season >= WORLD_CUP_SEASON_TARGET) {
    try {
      return await fetchWorldCupTeamsFromLeague(season);
    } catch {
      /* plan free → equipos desde Mongo sin IDs de API */
    }
  }

  const dbTeams = await loadDbTeams(Team);
  const teams = dbTeams.map((t) => ({
    apiFootballId: null,
    nameEn: t.nameEn || '',
    fifaCode: (t.fifaCode || '').toUpperCase(),
    flag: t.flag || '',
  }));

  return { teams, teamIds: new Set(), dbTeams };
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

async function fetchFixturesForLeagueInRange(leagueId, season, from, to) {
  const body = await apiFootballGet('/fixtures', {
    league: leagueId,
    season,
    from,
    to,
  });
  return body.response || [];
}

async function fetchFriendliesForDbTeams(dbTeams, season, from, to) {
  const leagueIds = await discoverFriendlyLeagueIds();
  const dateRanges = [ { from, to } ];
  if (season < new Date(from).getFullYear()) {
    dateRanges.push(shiftDateRangeToSeason(from, to, season));
  }

  let raw = [];

  for (const range of dateRanges) {
    for (const leagueId of leagueIds) {
      try {
        const batch = await fetchFixturesForLeagueInRange(
          leagueId,
          season,
          range.from,
          range.to
        );
        raw.push(...batch);
      } catch {
        /* siguiente liga */
      }
    }
    if (raw.length > 0) break;
  }

  if (raw.length === 0) {
    try {
      const shifted = shiftDateRangeToSeason(from, to, season);
      const body = await apiFootballGet('/fixtures', { season, from: shifted.from, to: shifted.to });
      raw = body.response || [];
    } catch {
      raw = [];
    }
  }

  raw = filterDbTeamFriendlies(raw, dbTeams);
  const inRange = filterFixturesByDateRange(raw, from, to);
  const usedBroadFallback = inRange.length === 0 && raw.length > 0;
  const selected = usedBroadFallback ? raw : inRange;

  const sorted = sortFixturesByKickoff(selected, 'desc');
  const seenFixtureIds = new Set();
  const unique = [];

  for (const item of sorted) {
    const id = item.fixture?.id;
    if (!id || seenFixtureIds.has(id)) continue;
    seenFixtureIds.add(id);
    unique.push(item);
  }

  return {
    friendlies: unique.map(normalizeFriendlyFixture),
    usedBroadFallback,
  };
}

async function fetchInjuriesForDbTeams(dbTeams, season) {
  const matchers = buildDbTeamMatchers(dbTeams);
  let rows = [];

  try {
    const body = await apiFootballGet('/injuries', { season });
    rows = body.response || [];
  } catch {
    rows = [];
  }

  rows = filterInjuriesForDbTeams(rows, dbTeams);

  if (rows.length === 0) {
    const leagueIds = await discoverFriendlyLeagueIds();
    for (const leagueId of leagueIds.slice(0, 2)) {
      try {
        const body = await apiFootballGet('/injuries', { league: leagueId, season });
        rows.push(...filterInjuriesForDbTeams(body.response || [], dbTeams));
      } catch {
        /* ignore */
      }
    }
  }

  return dedupeInjuries(rows.map(normalizeInjuryRow));
}

function buildPlanNotice(season, usedBroadFallback) {
  const parts = [];
  if (season < WORLD_CUP_SEASON_TARGET) {
    parts.push(
      `Plan gratuito de API-Football: datos con temporada ${season} (mismo mes del calendario en ese año). Para Mundial 2026 en vivo: plan pago y API_FOOTBALL_SEASON=2026.`
    );
  }
  if (usedBroadFallback) {
    parts.push(
      'No hay amistosos en el último mes en esa temporada; se muestran los amistosos más recientes disponibles.'
    );
  }
  return parts.length ? parts.join(' ') : null;
}

export async function buildApiFootballStats({ Team } = {}) {
  const season = getApiFootballSeason();
  const { from, to } = getLastMonthDateRange();

  if (!isApiFootballConfigured()) {
    return {
      configured: false,
      friendlies: [],
      injuries: [],
      worldCupTeams: [],
      season,
      period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
      message: 'Configurá API_FOOTBALL_KEY en el servidor para ver amistosos y lesiones.',
    };
  }

  try {
    const { teams, dbTeams } = await fetchWorldCupTeams(Team, season);

    if (!dbTeams?.length && !teams.length) {
      return {
        configured: true,
        friendlies: [],
        injuries: [],
        worldCupTeams: [],
        season,
        period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
        apiError: 'No hay equipos sincronizados. Ejecutá sync en el admin primero.',
        message: 'No hay equipos sincronizados. Ejecutá sync en el admin primero.',
      };
    }

    const roster = dbTeams?.length ? dbTeams : teams;

    const [{ friendlies, usedBroadFallback }, injuries] = await Promise.all([
      fetchFriendliesForDbTeams(roster, season, from, to),
      fetchInjuriesForDbTeams(roster, season),
    ]);

    const planNotice = buildPlanNotice(season, usedBroadFallback);

    return {
      configured: true,
      friendlies,
      injuries,
      worldCupTeams: teams,
      season,
      period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
      planNotice,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      configured: true,
      friendlies: [],
      injuries: [],
      worldCupTeams: [],
      season,
      period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
      apiError: err.message || 'Error al consultar API-Football',
      message: err.message || 'Error al consultar API-Football',
    };
  }
}
