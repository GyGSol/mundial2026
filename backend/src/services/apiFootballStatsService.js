import { env } from '../config/env.js';
import {
  apiFootballGet,
  isApiFootballConfigured,
} from './apiFootballClient.js';

export const WORLD_CUP_LEAGUE_ID = 1;
export const WORLD_CUP_SEASON_TARGET = 2026;
export const FRIENDLY_LOOKBACK_DAYS = 30;
export const FRIENDLY_LAST_PER_TEAM = 25;

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

export function pickApiTeamMatch(rows, dbTeam) {
  const code = (dbTeam.fifaCode || '').toUpperCase();
  if (code) {
    const byCode = rows.find((r) => (r.team?.code || '').toUpperCase() === code);
    if (byCode?.team?.id) return byCode.team;
  }
  const national = rows.find((r) => r.team?.national === true);
  return national?.team || rows[0]?.team || null;
}

async function resolveApiTeamId(dbTeam) {
  const search = (dbTeam.nameEn || dbTeam.fifaCode || '').trim();
  if (search.length < 3) return null;

  const body = await apiFootballGet('/teams', { search });
  const rows = body.response || [];
  const team = pickApiTeamMatch(rows, dbTeam);
  return team?.id ?? null;
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

async function fetchWorldCupTeamsFromDatabase(Team) {
  const dbTeams = await Team.find().select('nameEn fifaCode flag').lean();
  const teams = [];
  const chunkSize = 5;

  for (let i = 0; i < dbTeams.length; i += chunkSize) {
    const chunk = dbTeams.slice(i, i + chunkSize);
    const resolved = await Promise.all(
      chunk.map(async (dbTeam) => {
        try {
          const apiFootballId = await resolveApiTeamId(dbTeam);
          if (!apiFootballId) return null;
          return {
            apiFootballId,
            nameEn: dbTeam.nameEn || '',
            fifaCode: (dbTeam.fifaCode || '').toUpperCase(),
            flag: dbTeam.flag || '',
          };
        } catch {
          return null;
        }
      })
    );
    teams.push(...resolved.filter(Boolean));
  }

  const teamIds = new Set(teams.map((t) => t.apiFootballId));
  return { teams, teamIds };
}

async function fetchWorldCupTeams(Team) {
  const season = getApiFootballSeason();

  if (season >= WORLD_CUP_SEASON_TARGET) {
    try {
      return await fetchWorldCupTeamsFromLeague(season);
    } catch {
      /* plan free u otra limitación → equipos desde Mongo */
    }
  }

  if (!Team) {
    throw new Error('No se pudieron resolver equipos para API-Football');
  }

  return fetchWorldCupTeamsFromDatabase(Team);
}

async function fetchRecentFixturesForTeam(teamId, season) {
  const body = await apiFootballGet('/fixtures', {
    team: teamId,
    season,
    last: FRIENDLY_LAST_PER_TEAM,
  });
  return body.response || [];
}

async function fetchFriendliesForTeams(teamIds, season, from, to) {
  const idList = [...teamIds];
  const chunkSize = 6;
  let raw = [];

  for (let i = 0; i < idList.length; i += chunkSize) {
    const chunk = idList.slice(i, i + chunkSize);
    const batches = await Promise.all(
      chunk.map((teamId) => fetchRecentFixturesForTeam(teamId, season).catch(() => []))
    );
    raw.push(...batches.flat());
  }

  raw = filterWorldCupFriendlyFixtures(raw, teamIds);
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

async function fetchInjuriesForTeams(teamIds, season) {
  const rows = [];
  const chunkSize = 6;

  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (teamId) => {
        try {
          const body = await apiFootballGet('/injuries', { team: teamId, season });
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

function buildPlanNotice(season, usedBroadFallback) {
  const parts = [];
  if (season < WORLD_CUP_SEASON_TARGET) {
    parts.push(
      `Plan gratuito de API-Football: datos con temporada ${season} (el Mundial 2026 requiere plan pago o API_FOOTBALL_SEASON=2026).`
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
    const { teams, teamIds } = await fetchWorldCupTeams(Team);
    const teamIdList = [...teamIds];

    if (teamIdList.length === 0) {
      return {
        configured: true,
        friendlies: [],
        injuries: [],
        worldCupTeams: [],
        season,
        period: { from, to, lookbackDays: FRIENDLY_LOOKBACK_DAYS },
        apiError:
          'No se pudieron vincular las selecciones del Mundial con API-Football. Sincronizá equipos primero.',
        message:
          'No se pudieron vincular las selecciones del Mundial con API-Football. Sincronizá equipos primero.',
      };
    }

    const [{ friendlies, usedBroadFallback }, injuries] = await Promise.all([
      fetchFriendliesForTeams(teamIds, season, from, to),
      fetchInjuriesForTeams(teamIdList, season),
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
