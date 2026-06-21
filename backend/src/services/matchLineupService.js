import { fetchMatchDetails, fetchTeamWithSquad, hasToken } from './footballDataApiClient.js';
import { Team } from '../models/Team.js';
import { Player } from '../models/Player.js';
import { Match } from '../models/Match.js';
import { mapPlayerToTimelineRosterEntry, resolveCoachForLineup } from './playerPhotoService.js';
import { enrichNameFromRoster, normalizeName } from '../utils/playerNameMatch.js';
import {
  fetchFixtureLineups,
  hasApiFootballKey,
  mergeFdAndApiSide,
  resolveApiFootballFixtureId,
} from './apiFootballLineupClient.js';
import { MIN_CONFIRMED_STARTERS_PER_TEAM } from './aiLineupContextService.js';
import {
  buildProbableSide,
  DEFAULT_PROBABLE_FORMATION,
  isConfirmedSnapshot,
  serializeFdLineupPlayer,
} from './probableLineupService.js';
import {
  assignPlayersWithFormationLayout,
  mapFootballDataPositionText,
  resolveFormation,
} from '../utils/formationLayout.js';
import { shirtForName } from '../utils/fifaSquadShirtMap.js';
import { fetchFifaLiveMatchLineup } from './fifaLineupService.js';

function extractShirtNumber(entity) {
  for (const value of [
    entity?.shirtNumber,
    entity?.shirt,
    entity?.number,
    entity?.jerseyNumber,
  ]) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function parseFdTeamSide(teamSide) {
  if (!teamSide) return { formation: null, players: [], coach: null };
  const players = (teamSide.lineup ?? []).map(serializeFdLineupPlayer);
  return {
    formation: teamSide.formation || null,
    coach: teamSide.coach?.name ?? null,
    players,
  };
}

/** Extrae local/visitante del payload Football-Data v4. */
export function parseFootballDataMatchLineups(matchData, homeFdId, awayFdId) {
  if (matchData?.homeTeam?.lineup?.length || matchData?.awayTeam?.lineup?.length) {
    return {
      home: parseFdTeamSide(matchData.homeTeam),
      away: parseFdTeamSide(matchData.awayTeam),
    };
  }

  const lineups = matchData?.lineups ?? [];
  let home = { formation: null, players: [], coach: null };
  let away = { formation: null, players: [], coach: null };

  for (const side of lineups) {
    const teamId = side.team?.id ?? side.teamId;
    const xi = side.startXI ?? side.startingXI ?? side.startingEleven ?? [];
    const players = xi.map((entry) => {
      const person = entry.player ?? entry;
      return {
        playerId: person.id ? `fd-${person.id}` : null,
        footballDataPersonId: person.id ? Number(person.id) : null,
        name: person.name ?? '',
        shirtNumber: extractShirtNumber(person),
        position: mapFootballDataPositionText(person.position ?? person.pos),
        positionDetail: person.position ?? person.pos ?? null,
        isStarter: true,
      };
    });
    const parsed = {
      formation: side.formation || null,
      coach: side.coach?.name ?? null,
      players,
    };
    if (teamId && homeFdId && teamId === homeFdId) home = parsed;
    else if (teamId && awayFdId && teamId === awayFdId) away = parsed;
  }

  return { home, away };
}

export const LINEUP_LAYOUT_VERSION = 3;

function normalizePlayerForFormation(player) {
  const detail = player.positionDetail ?? player.position;
  const mapped = mapFootballDataPositionText(detail);
  return {
    ...player,
    position: mapped,
  };
}

function applyGridsToSide(side) {
  if (!side?.players?.length) return side;
  const players = side.players.map(normalizePlayerForFormation);
  const formation = resolveFormation(players, side.formation);
  const withGrids = assignPlayersWithFormationLayout(players, formation);
  return { ...side, formation, players: withGrids };
}

export function buildLineupSnapshotFromSources({
  fdSides,
  apiSides = null,
  source = 'football-data',
} = {}) {
  let home = fdSides?.home ?? { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };
  let away = fdSides?.away ?? { formation: DEFAULT_PROBABLE_FORMATION, players: [], coach: null };

  if (apiSides?.home) {
    home = mergeFdAndApiSide(home, apiSides.home);
  }
  if (apiSides?.away) {
    away = mergeFdAndApiSide(away, apiSides.away);
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: apiSides ? 'api-football' : source,
    layoutVersion: LINEUP_LAYOUT_VERSION,
    home: applyGridsToSide(home),
    away: applyGridsToSide(away),
  };

  return snapshot;
}

async function hydrateIncompleteSide(side, teamExternalId, apiSide) {
  const count = side?.players?.length ?? 0;
  if (count >= MIN_CONFIRMED_STARTERS_PER_TEAM) return side;

  const merged = mergeFdAndApiSide(side, apiSide);
  if ((merged.players?.length ?? 0) >= MIN_CONFIRMED_STARTERS_PER_TEAM) {
    return applyGridsToSide(merged);
  }

  const probable = await buildProbableSide(
    teamExternalId,
    merged.formation || side?.formation || DEFAULT_PROBABLE_FORMATION
  );
  if ((probable.players?.length ?? 0) > count) {
    return {
      formation: side?.formation || probable.formation,
      coach: side?.coach || probable.coach,
      players: probable.players,
    };
  }

  return applyGridsToSide(merged);
}

async function hydrateIncompleteSnapshotSides(snapshot, match) {
  if (!snapshot) return snapshot;

  const homeCount = snapshot.home?.players?.length ?? 0;
  const awayCount = snapshot.away?.players?.length ?? 0;
  if (
    homeCount >= MIN_CONFIRMED_STARTERS_PER_TEAM &&
    awayCount >= MIN_CONFIRMED_STARTERS_PER_TEAM
  ) {
    return snapshot;
  }

  let apiSides = null;
  if (hasApiFootballKey()) {
    try {
      const { homeTeam, awayTeam } = await loadMatchTeams(match);
      const fixtureId = await resolveApiFootballFixtureId(match, homeTeam, awayTeam);
      if (fixtureId) {
        apiSides = await fetchFixtureLineups(fixtureId);
      }
    } catch (err) {
      console.warn(`Lineup API hydrate skip ${match.externalId}:`, err.message);
    }
  }

  const [home, away] = await Promise.all([
    hydrateIncompleteSide(snapshot.home, match.homeTeamId, apiSides?.home),
    hydrateIncompleteSide(snapshot.away, match.awayTeamId, apiSides?.away),
  ]);

  const usedProbable =
    ((home.players?.length ?? 0) > homeCount && homeCount < MIN_CONFIRMED_STARTERS_PER_TEAM) ||
    ((away.players?.length ?? 0) > awayCount && awayCount < MIN_CONFIRMED_STARTERS_PER_TEAM);

  return {
    ...snapshot,
    source: usedProbable && snapshot.source !== 'heuristic' ? 'hybrid' : snapshot.source,
    home,
    away,
  };
}

function refreshSnapshotGrids(snapshot) {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    home: snapshot.home?.players?.length ? applyGridsToSide(snapshot.home) : snapshot.home,
    away: snapshot.away?.players?.length ? applyGridsToSide(snapshot.away) : snapshot.away,
  };
}

function sideNeedsShirtNumbers(side) {
  const players = side?.players ?? [];
  if (!players.length) return false;
  const withShirt = players.filter((p) => p.shirtNumber != null).length;
  return withShirt < Math.min(players.length, 6);
}

const SQUAD_SHIRT_CACHE_MS = 6 * 60 * 60 * 1000;
/** @type {Map<string, { map: Record<string, number>, fetchedAt: number, blockedUntil?: number }>} */
const squadShirtCache = new Map();
/** @type {Map<string, Promise<Record<string, number>>>} */
const squadShirtInflight = new Map();

function shirtFromLookupMap(name, lookup = {}) {
  if (!name || !lookup) return null;
  const normalized = normalizeName(name);
  if (lookup[normalized] != null) return lookup[normalized];

  const last = normalized.split(/\s+/).filter(Boolean).pop();
  if (last && lookup[last] != null) return lookup[last];

  return null;
}

async function loadFootballDataSquadShirtMap(team) {
  if (!team?.footballDataTeamId || !hasToken()) return {};

  const cacheKey = String(team.externalId || team.footballDataTeamId);
  const cached = squadShirtCache.get(cacheKey);
  if (cached) {
    if (cached.blockedUntil && Date.now() < cached.blockedUntil) return cached.map;
    if (Date.now() - cached.fetchedAt < SQUAD_SHIRT_CACHE_MS) return cached.map;
  }

  if (squadShirtInflight.has(cacheKey)) {
    return squadShirtInflight.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const data = await fetchTeamWithSquad(team.footballDataTeamId);
      const map = {};
      for (const person of data?.squad ?? []) {
        const shirt = extractShirtNumber(person);
        if (!shirt || !person?.name) continue;
        const normalized = normalizeName(person.name);
        map[normalized] = shirt;
        const last = normalized.split(/\s+/).filter(Boolean).pop();
        if (last && map[last] == null) map[last] = shirt;
      }
      squadShirtCache.set(cacheKey, { map, fetchedAt: Date.now() });
      return map;
    } catch (err) {
      const waitMatch = /Wait (\d+) seconds/i.exec(String(err.message));
      const blockedUntil = Date.now() + (waitMatch ? Number(waitMatch[1]) * 1000 : 60_000);
      squadShirtCache.set(cacheKey, { map: {}, fetchedAt: Date.now(), blockedUntil });
      console.warn(`FD squad shirt map skip ${team.externalId}:`, err.message);
      return {};
    } finally {
      squadShirtInflight.delete(cacheKey);
    }
  })();

  squadShirtInflight.set(cacheKey, promise);
  return promise;
}

function enrichSidePlayersWithRoster(
  side,
  roster,
  sideKey,
  shirtBySideName = { home: {}, away: {} },
  squadShirtMap = {}
) {
  if (!side?.players?.length) return side;
  return {
    ...side,
    players: side.players.map((player) => {
      const enriched = enrichNameFromRoster(player.name, roster, {
        shirtNumber: player.shirtNumber,
      });
      const fifaShirt = shirtForName(player.name, sideKey, shirtBySideName);
      const squadShirt = shirtFromLookupMap(player.name, squadShirtMap);
      return {
        ...player,
        name: enriched.name || player.name,
        shirtNumber:
          player.shirtNumber ?? enriched.shirtNumber ?? fifaShirt ?? squadShirt ?? null,
        photoUrl: enriched.photoUrl ?? player.photoUrl ?? null,
        mongoId: enriched.mongoId ?? player.mongoId ?? null,
        externalId:
          enriched.externalId ??
          player.externalId ??
          (player.footballDataPersonId != null ? String(player.footballDataPersonId) : null),
      };
    }),
  };
}

function enrichSideCoach(coachField, team) {
  return resolveCoachForLineup(coachField, team);
}

async function enrichLineupPayloadWithRoster(payload, match, options = {}) {
  const { fetchExternalShirts = true } = options;
  if (payload?.status === 'unavailable') return payload;

  const homeTeamId = match?.homeTeamId;
  const awayTeamId = match?.awayTeamId;
  const shirtBySideName = match?.raw?.fifaMeta?.shirtBySideName ?? { home: {}, away: {} };

  const needHomeShirts = fetchExternalShirts && sideNeedsShirtNumbers(payload.home);
  const needAwayShirts = fetchExternalShirts && sideNeedsShirtNumbers(payload.away);

  const [homePlayers, awayPlayers, teams] = await Promise.all([
    homeTeamId ? Player.find({ teamExternalId: homeTeamId }).lean() : [],
    awayTeamId ? Player.find({ teamExternalId: awayTeamId }).lean() : [],
    loadMatchTeams(match),
  ]);

  let homeSquadMap = {};
  let awaySquadMap = {};
  if (needHomeShirts && teams.homeTeam) {
    homeSquadMap = await loadFootballDataSquadShirtMap(teams.homeTeam);
  }
  if (needAwayShirts && teams.awayTeam) {
    awaySquadMap = await loadFootballDataSquadShirtMap(teams.awayTeam);
  }

  const homeRoster = homePlayers.map(mapPlayerToTimelineRosterEntry);
  const awayRoster = awayPlayers.map(mapPlayerToTimelineRosterEntry);

  const homeSide = enrichSidePlayersWithRoster(
    payload.home,
    homeRoster,
    'home',
    shirtBySideName,
    homeSquadMap
  );
  const awaySide = enrichSidePlayersWithRoster(
    payload.away,
    awayRoster,
    'away',
    shirtBySideName,
    awaySquadMap
  );

  return {
    ...payload,
    home: {
      ...homeSide,
      coach: enrichSideCoach(payload.home?.coach, teams.homeTeam),
    },
    away: {
      ...awaySide,
      coach: enrichSideCoach(payload.away?.coach, teams.awayTeam),
    },
  };
}

export function formatLineupPayload(snapshot) {
  if (!snapshot?.home?.players?.length && !snapshot?.away?.players?.length) {
    return {
      status: 'unavailable',
      updatedAt: null,
      source: null,
      home: { formation: null, players: [], coach: null },
      away: { formation: null, players: [], coach: null },
    };
  }

  const refreshed = refreshSnapshotGrids(snapshot);
  const confirmed = isConfirmedSnapshot(refreshed);
  return {
    status: confirmed ? 'confirmed' : 'probable',
    updatedAt: refreshed.fetchedAt ?? null,
    source: refreshed.source ?? 'heuristic',
    layoutVersion: LINEUP_LAYOUT_VERSION,
    home: {
      formation: refreshed.home?.formation ?? null,
      coach: refreshed.home?.coach ?? null,
      players: refreshed.home?.players ?? [],
    },
    away: {
      formation: refreshed.away?.formation ?? null,
      coach: refreshed.away?.coach ?? null,
      players: refreshed.away?.players ?? [],
    },
  };
}

export async function buildProbableLineupPayload(match, options = {}) {
  const { fetchExternalShirts = true } = options;
  const [homeSide, awaySide] = await Promise.all([
    buildProbableSide(match.homeTeamId),
    buildProbableSide(match.awayTeamId),
  ]);

  let snapshot = {
    fetchedAt: new Date().toISOString(),
    source: 'heuristic',
    home: homeSide,
    away: awaySide,
  };

  if (sideNeedsShirtNumbers(snapshot.home) || sideNeedsShirtNumbers(snapshot.away)) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    snapshot = await fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, snapshot);
  }

  const payload = formatLineupPayload(snapshot);
  return enrichLineupPayloadWithRoster(payload, match, { fetchExternalShirts });
}

function sideNeedsPositionDetailRefresh(side) {
  return (side?.players ?? []).some(
    (player) => !player.positionDetail || String(player.positionDetail).length <= 3
  );
}

async function refreshLineupSnapshotFromFootballData(match) {
  const fdMatchId = match.raw?.footballDataMatchId ?? match.raw?.fdMatchId;
  if (!fdMatchId || !hasToken()) return null;

  const { homeTeam, awayTeam } = await loadMatchTeams(match);
  if (!homeTeam || !awayTeam) return null;

  const matchData = await fetchMatchDetails(fdMatchId);
  const fdSides = parseFootballDataMatchLineups(
    matchData,
    homeTeam.footballDataTeamId,
    awayTeam.footballDataTeamId
  );
  let snapshot = buildLineupSnapshotFromSources({ fdSides, source: 'football-data' });
  snapshot = await fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, snapshot);
  snapshot.layoutVersion = LINEUP_LAYOUT_VERSION;
  return snapshot;
}

async function fetchFifaLineupSnapshot(match) {
  const sides = await fetchFifaLiveMatchLineup(match);
  if (!sides?.home?.players?.length && !sides?.away?.players?.length) return null;

  return buildLineupSnapshotFromSources({
    fdSides: {
      home: sides.home ?? { formation: null, players: [], coach: null },
      away: sides.away ?? { formation: null, players: [], coach: null },
    },
    source: 'fifa-live',
  });
}

export async function buildMatchLineupPayload(match, options = {}) {
  const { fetchExternalShirts = true } = options;
  if (!match?.homeTeamId || !match?.awayTeamId) {
    return formatLineupPayload(null);
  }

  let snapshot = match.raw?.lineupSnapshot;
  if (snapshot?.home?.players?.length || snapshot?.away?.players?.length) {
    if (
      snapshot.layoutVersion !== LINEUP_LAYOUT_VERSION &&
      (sideNeedsPositionDetailRefresh(snapshot.home) ||
        sideNeedsPositionDetailRefresh(snapshot.away))
    ) {
      try {
        const refreshed = await refreshLineupSnapshotFromFootballData(match);
        if (refreshed?.home?.players?.length || refreshed?.away?.players?.length) {
          snapshot = refreshed;
          if (match._id) {
            await Match.updateOne(
              { _id: match._id },
              { $set: { 'raw.lineupSnapshot': refreshed } }
            );
          }
        }
      } catch (err) {
        console.warn(`Lineup snapshot refresh skip ${match.externalId}:`, err.message);
      }
    }

    if (sideNeedsShirtNumbers(snapshot.home) || sideNeedsShirtNumbers(snapshot.away)) {
      try {
        const refreshed = await refreshLineupSnapshotFromFootballData(match);
        if (refreshed?.home?.players?.length || refreshed?.away?.players?.length) {
          snapshot = refreshed;
        } else {
          const { homeTeam, awayTeam } = await loadMatchTeams(match);
          const merged = await fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, snapshot);
          if (merged) snapshot = merged;
        }
      } catch (err) {
        console.warn(`Lineup shirt merge skip ${match.externalId}:`, err.message);
      }
    }

    snapshot = await hydrateIncompleteSnapshotSides(snapshot, match);

    const payload = formatLineupPayload(snapshot);
    return enrichLineupPayloadWithRoster(payload, match, { fetchExternalShirts });
  }

  try {
    const fifaSnapshot = await fetchFifaLineupSnapshot(match);
    if (fifaSnapshot?.home?.players?.length || fifaSnapshot?.away?.players?.length) {
      const payload = formatLineupPayload(fifaSnapshot);
      return enrichLineupPayloadWithRoster(payload, match, { fetchExternalShirts });
    }
  } catch (err) {
    console.warn(`FIFA lineup payload skip ${match.externalId}:`, err.message);
  }

  return buildProbableLineupPayload(match, { fetchExternalShirts });
}

export async function enrichMatchesWithLineups(matches) {
  if (!matches?.length) return matches;
  const payloads = await Promise.all(matches.map((m) => buildMatchLineupPayload(m)));
  return matches.map((match, index) => ({
    ...match,
    lineup: payloads[index],
  }));
}

/** Último XI confirmado de un equipo en partidos ya jugados del torneo. */
export async function findLastConfirmedSideForTeam(teamExternalId) {
  const priorMatches = await Match.find({
    status: { $in: ['finished', 'live'] },
    $or: [{ homeTeamId: teamExternalId }, { awayTeamId: teamExternalId }],
    'raw.lineupSnapshot': { $exists: true },
  })
    .sort({ kickoffAt: -1 })
    .limit(5)
    .lean();

  for (const prior of priorMatches) {
    const snap = prior.raw?.lineupSnapshot;
    if (!snap) continue;
    const side =
      prior.homeTeamId === teamExternalId
        ? snap.home
        : prior.awayTeamId === teamExternalId
          ? snap.away
          : null;
    if ((side?.players?.length ?? 0) >= 9) return side;
  }
  return null;
}

export async function fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, fdSnapshot) {
  if (!hasApiFootballKey() || !fdSnapshot) return fdSnapshot;

  try {
    const fixtureId = await resolveApiFootballFixtureId(match, homeTeam, awayTeam);
    if (!fixtureId) return fdSnapshot;

    const apiLineups = await fetchFixtureLineups(fixtureId);
    if (!apiLineups?.home && !apiLineups?.away) return fdSnapshot;

    return buildLineupSnapshotFromSources({
      fdSides: fdSnapshot,
      apiSides: apiLineups,
      source: 'api-football',
    });
  } catch (err) {
    console.warn(`API-Football lineup grid skip match ${match.externalId}:`, err.message);
    return fdSnapshot;
  }
}

export async function loadMatchTeams(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam };
}
