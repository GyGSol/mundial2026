import { env } from '../config/env.js';
import { resolveKickoffAt } from './kickoffTimeService.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';

let cachedToken = null;
let tokenExpiresAt = 0;

async function request(path, options = {}) {
  const url = `${env.worldCupApiUrl.replace(/\/$/, '')}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (cachedToken && Date.now() < tokenExpiresAt) {
    headers.Authorization = `Bearer ${cachedToken}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !options._retried) {
    await authenticate();
    return request(path, { ...options, _retried: true });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`World Cup API ${res.status}: ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function authenticate() {
  if (!env.worldCupSyncEmail || !env.worldCupSyncPassword) {
    throw new Error(
      'WORLD_CUP_SYNC_EMAIL and WORLD_CUP_SYNC_PASSWORD are required for sync'
    );
  }

  const url = `${env.worldCupApiUrl.replace(/\/$/, '')}/auth/authenticate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: env.worldCupSyncEmail,
      password: env.worldCupSyncPassword,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`World Cup API auth failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  tokenExpiresAt = Date.now() + 83 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

export async function fetchGames() {
  return request('/get/games');
}

export async function fetchTeams() {
  return request('/get/teams');
}

export async function fetchGroups() {
  return request('/get/groups');
}

export async function fetchStadiums() {
  return request('/get/stadiums');
}

export function normalizeStadium(stadium) {
  const id = String(stadium.id ?? stadium._id ?? stadium.idStadium ?? '');
  const city = stadium.city ?? stadium.city_en ?? '';
  const country = stadium.country ?? stadium.country_en ?? '';
  const nameEn = stadium.name_en ?? stadium.name ?? stadium.nameEn ?? '';
  const timezone =
    stadium.timezone ??
    stadium.time_zone ??
    resolveStadiumTimezone({ city, country, nameEn });

  return {
    externalId: id,
    nameEn,
    nameFa: stadium.name_fa ?? stadium.nameFa ?? '',
    city,
    country,
    timezone: timezone || undefined,
    capacity: Number(stadium.capacity ?? stadium.seats ?? 0) || null,
    raw: stadium,
  };
}

export function mapGameStatus(game) {
  if (game.status === 'live' || game.status === 'finished' || game.status === 'upcoming') {
    return game.status;
  }

  const finished = game.finished;
  if (finished === true || finished === 'TRUE' || finished === 'true') {
    return 'finished';
  }

  const elapsed = game.time_elapsed ?? game.timeElapsed;
  if (elapsed && elapsed !== 'notstarted' && elapsed !== '0') {
    return 'live';
  }

  const home = Number(game.home_score ?? game.homeScore ?? 0);
  const away = Number(game.away_score ?? game.awayScore ?? 0);
  if (home + away > 0 && finished !== 'FALSE' && finished !== false) {
    return 'live';
  }

  return 'upcoming';
}

/** @deprecated Use resolveKickoffAt from kickoffTimeService.js */
export function parseKickoffAt(game, options = {}) {
  return resolveKickoffAt(game, options);
}

export function normalizeGame(game, options = {}) {
  const id = String(game.id ?? game._id ?? game.idGame);
  const kickoffAt = resolveKickoffAt(game, options);
  const stadiumTimezone = options.stadiumTimezone ?? null;

  return {
    externalId: id,
    homeTeamId: String(game.home_team_id ?? game.homeTeamId ?? ''),
    awayTeamId: String(game.away_team_id ?? game.awayTeamId ?? ''),
    homeScore: Number(game.home_score ?? game.homeScore ?? 0),
    awayScore: Number(game.away_score ?? game.awayScore ?? 0),
    group: game.group ?? game.group_name ?? '',
    matchday: String(game.matchday ?? game.match_day ?? ''),
    localDate: game.local_date ?? game.localDate ?? '',
    stadiumId: String(game.stadium_id ?? game.stadiumId ?? ''),
    kickoffTimezone: stadiumTimezone || undefined,
    displayTimezone: 'America/Argentina/Buenos_Aires',
    type: game.type ?? game.round ?? 'group',
    status: mapGameStatus(game),
    kickoffAt,
    raw: game,
  };
}

export function normalizeTeam(team) {
  const id = String(team.id ?? team._id ?? team.idTeam);
  return {
    externalId: id,
    nameEn: team.name_en ?? team.name ?? team.nameEn ?? '',
    nameFa: team.name_fa ?? team.nameFa ?? '',
    fifaCode: team.fifa_code ?? team.fifaCode ?? '',
    group: team.groups ?? team.group ?? '',
    flag: team.flag ?? '',
    raw: team,
  };
}

export function normalizeGroup(group, index) {
  const name = group.group ?? group.name ?? group.group_name ?? `Group${index}`;
  return {
    externalId: String(group._id ?? group.id ?? name),
    name: String(name),
    teams: group.teams ?? [],
    raw: group,
  };
}
