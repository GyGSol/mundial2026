import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import {
  fetchMatchLineups,
  hasToken,
} from './footballDataApiClient.js';
import { notifyPlayersUpdated } from './websocketService.js';

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
  return starters;
}

async function resolveTeamExternalIds(match) {
  const [home, away] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return [home?.externalId, away?.externalId].filter(Boolean);
}

export async function syncLiveLineups() {
  if (!hasToken()) return { updated: 0, matches: 0 };

  const liveMatches = await Match.find({ status: 'live' }).lean();
  if (!liveMatches.length) return { updated: 0, matches: 0 };

  let updated = 0;

  for (const match of liveMatches) {
    const fdMatchId = match.raw?.footballDataMatchId ?? match.raw?.fdMatchId;
    if (!fdMatchId) continue;

    try {
      const lineupData = await fetchMatchLineups(fdMatchId);
      const starterIds = extractStarterIds(lineupData);
      if (!starterIds.size) continue;

      const teamIds = await resolveTeamExternalIds(match);
      if (!teamIds.length) continue;

      await Player.updateMany(
        { teamExternalId: { $in: teamIds } },
        { $unset: { lineupStatus: '' } }
      );

      const result = await Player.updateMany(
        { footballDataPersonId: { $in: [...starterIds] } },
        { $set: { lineupStatus: 'starter' } }
      );

      updated += result.modifiedCount;
      notifyPlayersUpdated({ matchId: match.externalId, starters: result.modifiedCount });
    } catch (err) {
      console.warn(`Lineup sync skip match ${match.externalId}:`, err.message);
    }
  }

  return { updated, matches: liveMatches.length };
}
