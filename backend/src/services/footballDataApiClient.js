import { env } from '../config/env.js';

// Datos estructurales de plantel: Football-Data.org (plan Deep Data para squads completos).
// Con plan gratuito, el roster base se carga desde playersSeed.json;
// esta API complementa lineups en vivo e historial de partidos.
// Lesiones y posición habitual: ver playerInjuriesSeed.json (referencia Transfermarkt).

const MIN_REQUEST_INTERVAL_MS = 6500;
let lastRequestAt = 0;

function hasToken() {
  return Boolean(env.footballDataApiToken);
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function request(path) {
  if (!hasToken()) {
    throw new Error('FOOTBALL_DATA_API_TOKEN no configurado');
  }

  await throttle();
  const base = env.footballDataApiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    headers: {
      'X-Auth-Token': env.footballDataApiToken,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Football-Data ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export function mapFootballDataPosition(raw) {
  const value = String(raw ?? '').toUpperCase();
  if (value.includes('GOALKEEPER') || value === 'GK') return 'GK';
  if (value.includes('DEFENCE') || value.includes('DEFENDER') || value === 'DEF') return 'DEF';
  if (value.includes('MIDFIELD') || value === 'MID') return 'MID';
  if (value.includes('OFFENCE') || value.includes('FORWARD') || value === 'FWD') return 'FWD';
  return 'MID';
}

export function normalizeFootballDataPerson(person, teamMeta = {}) {
  const id = person.id ?? person.personId;
  const fullName = person.name ?? [person.firstName, person.lastName].filter(Boolean).join(' ');
  const slug = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const fifaCode = teamMeta.fifaCode || '';
  const externalId = id
    ? `fd-${id}`
    : `${fifaCode || teamMeta.externalId || 'team'}-${slug || 'player'}`;

  const dateOfBirth = person.dateOfBirth ? new Date(person.dateOfBirth) : null;
  const age = dateOfBirth
    ? Math.floor((Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : person.age ?? null;

  return {
    externalId,
    footballDataPersonId: id ? Number(id) : undefined,
    fullName,
    teamExternalId: teamMeta.externalId || '',
    fifaCode,
    position: mapFootballDataPosition(person.position),
    currentClub: person.currentTeam?.name ?? person.nationality ?? '',
    age: age ?? undefined,
    shirtNumber: person.shirtNumber ?? undefined,
    nationality: person.nationality ?? '',
    healthStatus: 'available',
    injuryInfo: '',
    dataSources: { structural: 'football-data.org', injuries: '' },
    raw: person,
  };
}

export async function fetchWorldCupTeams() {
  const data = await request('/competitions/WC/teams');
  return data?.teams ?? [];
}

export async function fetchTeamWithSquad(teamId) {
  const data = await request(`/teams/${teamId}`);
  return data;
}

export async function fetchMatchLineups(matchId) {
  const data = await request(`/matches/${matchId}`);
  return data;
}

export async function fetchPersonMatches(personId, { limit = 8 } = {}) {
  const data = await request(`/persons/${personId}/matches?limit=${limit}`);
  const matches = data?.matches ?? [];
  return matches.map((m) => {
    const home = m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?';
    const away = m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?';
    const score = `${m.score?.fullTime?.home ?? '-'}:${m.score?.fullTime?.away ?? '-'}`;
    return {
      date: m.utcDate?.slice(0, 10) ?? '',
      opponent: `${home} vs ${away}`,
      result: score,
      minutes: null,
      goals: 0,
      competition: m.competition?.name ?? '',
    };
  });
}

export { hasToken };
