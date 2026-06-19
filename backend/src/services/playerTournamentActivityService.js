import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { normalizeName } from '../utils/playerNameMatch.js';
import { enrichTimelineRosterFields, readMatchTimeline } from './matchLiveData.js';
import { resolvePlayerPhotoUrl } from './playerPhotoService.js';
import { createInMemoryCache } from './inMemoryCache.js';

const MATCHES_CACHE_KEY = 'tournament-activity-matches';
const MATCHES_CACHE_TTL_MS = 60_000;

const matchesCache = createInMemoryCache({ defaultTtlMs: MATCHES_CACHE_TTL_MS });

const TRACKED_EVENT_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'foul',
  'substitution',
  'shot_attempt',
]);

const EVENT_LABELS = {
  goal: 'Gol',
  yellow_card: 'Tarjeta amarilla',
  red_card: 'Tarjeta roja',
  foul: 'Falta',
  substitution: 'Cambio',
  shot_attempt: 'Tiro al arco',
};

function emptyTotals() {
  return {
    matches: 0,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    fouls: 0,
    substitutions: 0,
    shots: 0,
  };
}

/** @param {{ mongoId?: string | null, externalId?: string | null, fullName?: string | null }} identity */
export function buildPlayerIdentityKeys(identity = {}) {
  const mongoIds = new Set();
  const externalIds = new Set();
  const names = new Set();

  if (identity.mongoId) mongoIds.add(String(identity.mongoId));
  if (identity.externalId) externalIds.add(String(identity.externalId));
  if (identity.fullName) names.add(normalizeName(identity.fullName));

  return { mongoIds, externalIds, names };
}

function roleMatchesKeys(event, role, keys) {
  const suffix = role === 'player' ? '' : role === 'in' ? 'In' : 'Out';
  const mongoKey = role === 'player' ? 'playerMongoId' : `player${suffix}MongoId`;
  const externalKey = role === 'player' ? 'playerExternalId' : `player${suffix}ExternalId`;
  const nameKey = role === 'player' ? 'player' : role === 'in' ? 'playerIn' : 'playerOut';

  const mongoId = event?.[mongoKey];
  if (mongoId && keys.mongoIds.has(String(mongoId))) return true;

  const externalId = event?.[externalKey];
  if (externalId && keys.externalIds.has(String(externalId))) return true;

  const name = event?.[nameKey];
  if (name && keys.names.has(normalizeName(name))) return true;

  return false;
}

function eventRolesForPlayer(event, keys) {
  const roles = [];
  if (roleMatchesKeys(event, 'player', keys)) roles.push('player');
  if (roleMatchesKeys(event, 'in', keys)) roles.push('in');
  if (roleMatchesKeys(event, 'out', keys)) roles.push('out');
  return roles;
}

function formatMinute(event) {
  if (event?.minute == null || !Number.isFinite(Number(event.minute))) return '—';
  const extra = event.extraMinute != null && Number.isFinite(Number(event.extraMinute))
    ? Number(event.extraMinute)
    : null;
  return extra ? `${event.minute}+${extra}'` : `${event.minute}'`;
}

function eventDetail(event, roles) {
  if (event.type === 'substitution') {
    if (roles.includes('in')) return `Entra por ${event.playerOut ?? '—'}`;
    if (roles.includes('out')) return `Sale por ${event.playerIn ?? '—'}`;
  }
  return null;
}

function bumpTotals(totals, event, roles) {
  switch (event.type) {
    case 'goal':
      if (roles.includes('player')) totals.goals += 1;
      break;
    case 'yellow_card':
      if (roles.includes('player')) totals.yellowCards += 1;
      break;
    case 'red_card':
      if (roles.includes('player')) totals.redCards += 1;
      break;
    case 'foul':
      if (roles.includes('player')) totals.fouls += 1;
      break;
    case 'shot_attempt':
      if (roles.includes('player')) totals.shots += 1;
      break;
    case 'substitution':
      if (roles.includes('in') || roles.includes('out')) totals.substitutions += 1;
      break;
    default:
      break;
  }
}

function rosterEntryFromPlayer(player) {
  return {
    mongoId: player._id?.toString?.() ?? String(player._id),
    externalId: player.externalId,
    fullName: player.fullName,
    position: player.position ?? null,
    shirtNumber: player.shirtNumber ?? null,
    photoUrl: resolvePlayerPhotoUrl(player.photoKey),
  };
}

function groupRosterByTeam(players = []) {
  const byTeamExternalId = new Map();
  const byFifaCode = new Map();

  for (const player of players) {
    const entry = rosterEntryFromPlayer(player);
    if (player.teamExternalId) {
      const list = byTeamExternalId.get(player.teamExternalId) ?? [];
      list.push(entry);
      byTeamExternalId.set(player.teamExternalId, list);
    }
    if (player.fifaCode) {
      const code = String(player.fifaCode).toUpperCase();
      const list = byFifaCode.get(code) ?? [];
      list.push(entry);
      byFifaCode.set(code, list);
    }
  }

  return { byTeamExternalId, byFifaCode };
}

async function loadTournamentMatches() {
  return matchesCache.getOrCompute(
    MATCHES_CACHE_KEY,
    () =>
      Match.find({ status: { $in: ['finished', 'live'] } })
        .select(
          'externalId status homeTeamId awayTeamId homeScore awayScore group type kickoffAt localDate raw finishedAt'
        )
        .sort({ kickoffAt: 1 })
        .lean(),
    MATCHES_CACHE_TTL_MS
  );
}

function formatMatchLabel(match, teamById) {
  const home = teamById.get(match.homeTeamId);
  const away = teamById.get(match.awayTeamId);
  const homeLabel = home?.nameEn || home?.fifaCode || 'Local';
  const awayLabel = away?.nameEn || away?.fifaCode || 'Visitante';
  const group = match.group ? ` · Grupo ${match.group}` : '';
  const date = match.localDate ? ` · ${match.localDate}` : '';
  return `${homeLabel} vs ${awayLabel}${group}${date}`;
}

/**
 * @param {Array<Record<string, unknown>>} matches
 * @param {Array<Record<string, unknown>>} teams
 * @param {Array<Record<string, unknown>>} players
 * @param {{ mongoId?: string | null, externalId?: string | null, fullName?: string | null }} identity
 */
export function aggregatePlayerTournamentActivity(matches, teams, players, identity = {}) {
  const keys = buildPlayerIdentityKeys(identity);
  if (!keys.mongoIds.size && !keys.externalIds.size && !keys.names.size) {
    return { totals: emptyTotals(), matches: [] };
  }

  const teamById = new Map(teams.map((team) => [team.externalId, team]));
  const rosterIndex = groupRosterByTeam(players);

  const totals = emptyTotals();
  const matchRows = [];

  for (const match of matches) {
    const homeRoster = rosterIndex.byTeamExternalId.get(match.homeTeamId) ?? [];
    const awayRoster = rosterIndex.byTeamExternalId.get(match.awayTeamId) ?? [];
    const timeline = enrichTimelineRosterFields(readMatchTimeline(match.raw ?? {}), homeRoster, awayRoster);

    const matchEvents = [];

    for (const event of timeline) {
      if (!TRACKED_EVENT_TYPES.has(event.type)) continue;
      const roles = eventRolesForPlayer(event, keys);
      if (!roles.length) continue;

      bumpTotals(totals, event, roles);
      matchEvents.push({
        type: event.type,
        label: EVENT_LABELS[event.type] ?? event.type,
        minute: formatMinute(event),
        detail: eventDetail(event, roles),
        side: event.side ?? null,
      });
    }

    if (!matchEvents.length) continue;

    totals.matches += 1;
    matchRows.push({
      matchId: match.externalId,
      status: match.status,
      label: formatMatchLabel(match, teamById),
      score:
        match.homeScore != null && match.awayScore != null
          ? `${match.homeScore}-${match.awayScore}`
          : null,
      events: matchEvents,
    });
  }

  return { totals, matches: matchRows };
}

/**
 * @param {{ mongoId?: string | null, externalId?: string | null, fullName?: string | null, fifaCode?: string | null }} identity
 */
export async function buildPlayerTournamentActivity(identity = {}) {
  const [matches, teams, players] = await Promise.all([
    loadTournamentMatches(),
    Team.find().select('externalId fifaCode nameEn flag').lean(),
    Player.find()
      .select('_id externalId fullName fifaCode teamExternalId photoKey position shirtNumber')
      .lean(),
  ]);

  return aggregatePlayerTournamentActivity(matches, teams, players, identity);
}

export function invalidatePlayerTournamentActivityCache() {
  matchesCache.invalidate(MATCHES_CACHE_KEY);
}

/** Test helper */
export function clearPlayerTournamentActivityCache() {
  matchesCache.clear();
}
