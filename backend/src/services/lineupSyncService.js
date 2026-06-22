import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import {
  fetchMatchDetails,
  hasToken,
  resolveFootballDataMatchId,
} from './footballDataApiClient.js';
import { countStoredEvents, splitFootballDataEvents } from './matchLiveData.js';
import { notifyPlayersUpdated } from './websocketService.js';
import {
  buildLineupSnapshotFromSources,
  fetchAndMergeApiFootballGrids,
  loadMatchTeams,
  parseFootballDataMatchLineups,
} from './matchLineupService.js';
import {
  fetchFixtureLineups,
  hasApiFootballKey,
  resolveApiFootballFixtureId,
  shouldRefreshApiFootballGrid,
} from './apiFootballLineupClient.js';

function extractStarterIds(lineupData) {
  const starters = new Set();
  const lineups = lineupData?.lineups ?? [];
  for (const side of lineups) {
    const xi = side.startXI ?? side.startingXI ?? side.startingEleven ?? [];
    for (const entry of xi) {
      const id = entry.player?.id ?? entry.id ?? entry.person?.id;
      if (id) starters.add(Number(id));
    }
  }

  if (!starters.size && lineupData?.homeTeam?.lineup) {
    for (const entry of lineupData.homeTeam.lineup) {
      if (entry.id) starters.add(Number(entry.id));
    }
    for (const entry of lineupData.awayTeam?.lineup ?? []) {
      if (entry.id) starters.add(Number(entry.id));
    }
  }

  return starters;
}

async function applyStartersToTeams(teamExternalIds, starterIds) {
  if (!starterIds.size || !teamExternalIds.length) return 0;

  await Player.updateMany(
    { teamExternalId: { $in: teamExternalIds } },
    { $unset: { lineupStatus: '' } }
  );

  const result = await Player.updateMany(
    { footballDataPersonId: { $in: [...starterIds] } },
    { $set: { lineupStatus: 'starter' } }
  );

  return result.modifiedCount;
}

function buildSnapshotFromMatchData(matchData, homeTeam, awayTeam) {
  const fdSides = parseFootballDataMatchLineups(
    matchData,
    homeTeam?.footballDataTeamId,
    awayTeam?.footballDataTeamId
  );
  return buildLineupSnapshotFromSources({ fdSides, source: 'football-data' });
}

/** Sincroniza titulares y eventos FD para un partido. */
export async function syncMatchLineupsFromFootballData(match, { applyStarters = true } = {}) {
  if (!hasToken()) return { updated: 0, starterIds: 0, synced: false };

  const { homeTeam, awayTeam } = await loadMatchTeams(match);
  if (!homeTeam || !awayTeam) return { updated: 0, starterIds: 0, synced: false };

  let fdMatchId = match.raw?.footballDataMatchId ?? match.raw?.fdMatchId;
  if (!fdMatchId) {
    try {
      fdMatchId = await resolveFootballDataMatchId(match, homeTeam, awayTeam);
    } catch (err) {
      console.warn(`Lineup/events sync skip match ${match.externalId}:`, err.message);
      return { updated: 0, starterIds: 0, synced: false, error: err.message };
    }
  }
  if (!fdMatchId) return { updated: 0, starterIds: 0, synced: false };

  try {
    const matchData = await fetchMatchDetails(fdMatchId);
    const starterIds = extractStarterIds(matchData);
    const teamExternalIds = [homeTeam.externalId, awayTeam.externalId].filter(Boolean);

    let updated = 0;
    if (applyStarters && starterIds.size && teamExternalIds.length) {
      updated = await applyStartersToTeams(teamExternalIds, starterIds);
      if (updated > 0) {
        notifyPlayersUpdated({ matchId: match.externalId, starters: updated });
      }
    }

    const fdEvents = splitFootballDataEvents(
      matchData,
      homeTeam.footballDataTeamId,
      awayTeam.footballDataTeamId
    );

    let lineupSnapshot = buildSnapshotFromMatchData(matchData, homeTeam, awayTeam);
    if ((lineupSnapshot.home.players.length || lineupSnapshot.away.players.length) > 0) {
      lineupSnapshot = await fetchAndMergeApiFootballGrids(match, homeTeam, awayTeam, lineupSnapshot);
    }

    const rawUpdate = { 'raw.footballDataMatchId': fdMatchId };
    if (countStoredEvents(fdEvents) > 0 || !match.raw?.fdEvents) {
      rawUpdate['raw.fdEvents'] = fdEvents;
    }
    if (lineupSnapshot.home.players.length || lineupSnapshot.away.players.length) {
      rawUpdate['raw.lineupSnapshot'] = lineupSnapshot;
    }
    if (lineupSnapshot.source === 'api-football') {
      const fixtureId = await resolveApiFootballFixtureId(match, homeTeam, awayTeam);
      if (fixtureId) rawUpdate['raw.apiFootballFixtureId'] = fixtureId;
    }

    await Match.updateOne({ _id: match._id }, { $set: rawUpdate });

    return { updated, starterIds: starterIds.size, synced: true };
  } catch (err) {
    console.warn(`Lineup/events sync skip match ${match.externalId}:`, err.message);
    return { updated: 0, starterIds: 0, synced: false, error: err.message };
  }
}

/** Partidos upcoming con kickoff próximo: intenta traer formación (T-120). */
export async function syncUpcomingKickoffLineups({ withinMs = 120 * 60 * 1000 } = {}) {
  if (!hasToken()) return { updated: 0, matches: 0 };

  const now = Date.now();
  const matches = await Match.find({
    status: 'upcoming',
    kickoffAt: { $gte: new Date(now), $lte: new Date(now + withinMs) },
  }).lean();

  if (!matches.length) return { updated: 0, matches: 0 };

  let updated = 0;
  for (const match of matches) {
    const result = await syncMatchLineupsFromFootballData(match);
    updated += result.updated;
  }

  return { updated, matches: matches.length };
}

/** Refresca grid API-Football para partidos próximos (T-90 → T+5). */
export async function syncUpcomingLineupGrids({
  withinMs = 90 * 60 * 1000,
  afterMs = 5 * 60 * 1000,
} = {}) {
  if (!hasApiFootballKey()) return { updated: 0, matches: 0 };

  const now = Date.now();
  const matches = await Match.find({
    status: { $in: ['upcoming', 'live'] },
    kickoffAt: {
      $gte: new Date(now - afterMs),
      $lte: new Date(now + withinMs),
    },
    'raw.lineupSnapshot': { $exists: true },
  }).lean();

  if (!matches.length) return { updated: 0, matches: 0 };

  let updated = 0;
  for (const match of matches) {
    const snapshot = match.raw?.lineupSnapshot;
    if (!shouldRefreshApiFootballGrid(snapshot)) continue;

    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    try {
      const fixtureId = await resolveApiFootballFixtureId(match, homeTeam, awayTeam);
      if (!fixtureId) continue;

      const apiLineups = await fetchFixtureLineups(fixtureId);
      if (!apiLineups?.home && !apiLineups?.away) continue;

      const merged = buildLineupSnapshotFromSources({
        fdSides: snapshot,
        apiSides: apiLineups,
        source: 'api-football',
      });

      await Match.updateOne(
        { _id: match._id },
        {
          $set: {
            'raw.lineupSnapshot': merged,
            'raw.apiFootballFixtureId': fixtureId,
          },
        }
      );
      updated += 1;
    } catch (err) {
      console.warn(`Lineup grid sync skip match ${match.externalId}:`, err.message);
    }
  }

  return { updated, matches: matches.length };
}

export async function syncLiveLineups() {
  if (!hasToken()) return { updated: 0, matches: 0, events: 0 };

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [liveMatches, recentFinishedMatches] = await Promise.all([
    Match.find({ status: 'live' }).lean(),
    Match.find({ status: 'finished', kickoffAt: { $gte: recentCutoff } }).lean(),
  ]);

  const matchesToSync = [...liveMatches];
  for (const finished of recentFinishedMatches) {
    if (!matchesToSync.some((m) => m._id.toString() === finished._id.toString())) {
      matchesToSync.push(finished);
    }
  }

  if (!matchesToSync.length) return { updated: 0, matches: 0, events: 0 };

  let updated = 0;
  let eventsSynced = 0;

  for (const match of matchesToSync) {
    const result = await syncMatchLineupsFromFootballData(match, {
      applyStarters: match.status === 'live',
    });
    if (result.synced) eventsSynced += 1;
    updated += result.updated;
  }

  const gridResult = await syncUpcomingLineupGrids();
  updated += gridResult.updated;

  return { updated, matches: matchesToSync.length, events: eventsSynced };
}
