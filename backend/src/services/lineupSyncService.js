import { Match } from '../models/Match.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import {
  fetchMatchDetails,
  hasToken,
  resolveFootballDataMatchId,
} from './footballDataApiClient.js';
import { splitFootballDataEvents } from './matchLiveData.js';
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

async function loadMatchTeams(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam };
}

export async function syncLiveLineups() {
  if (!hasToken()) return { updated: 0, matches: 0, events: 0 };

  const liveMatches = await Match.find({ status: 'live' }).lean();
  if (!liveMatches.length) return { updated: 0, matches: 0, events: 0 };

  let updated = 0;
  let eventsSynced = 0;

  for (const match of liveMatches) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    let fdMatchId = match.raw?.footballDataMatchId ?? match.raw?.fdMatchId;
    if (!fdMatchId) {
      fdMatchId = await resolveFootballDataMatchId(match, homeTeam, awayTeam);
    }
    if (!fdMatchId) continue;

    try {
      const matchData = await fetchMatchDetails(fdMatchId);
      const starterIds = extractStarterIds(matchData);
      const teamExternalIds = [homeTeam.externalId, awayTeam.externalId].filter(Boolean);

      if (starterIds.size && teamExternalIds.length) {
        await Player.updateMany(
          { teamExternalId: { $in: teamExternalIds } },
          { $unset: { lineupStatus: '' } }
        );

        const result = await Player.updateMany(
          { footballDataPersonId: { $in: [...starterIds] } },
          { $set: { lineupStatus: 'starter' } }
        );

        updated += result.modifiedCount;
        notifyPlayersUpdated({ matchId: match.externalId, starters: result.modifiedCount });
      }

      const fdEvents = splitFootballDataEvents(
        matchData,
        homeTeam.footballDataTeamId,
        awayTeam.footballDataTeamId
      );

      await Match.updateOne(
        { _id: match._id },
        {
          $set: {
            'raw.footballDataMatchId': fdMatchId,
            'raw.fdEvents': fdEvents,
          },
        }
      );

      eventsSynced += 1;
    } catch (err) {
      console.warn(`Lineup/events sync skip match ${match.externalId}:`, err.message);
    }
  }

  return { updated, matches: liveMatches.length, events: eventsSynced };
}
