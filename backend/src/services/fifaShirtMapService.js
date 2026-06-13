import { Match } from '../models/Match.js';
import { fetchLiveMatchFootball } from './fifaApiClient.js';
import { buildShirtByPlayerId } from '../utils/fifaSquadShirtMap.js';

function matchNeedsShirtMap(match) {
  const meta = match.raw?.fifaMeta;
  const timeline = match.raw?.fifaEvents?.timeline;
  return (
    Array.isArray(timeline) &&
    timeline.length > 0 &&
    meta?.idMatch &&
    meta?.idStage &&
    !meta?.shirtByPlayerId
  );
}

/** @param {Array<import('mongoose').LeanDocument<any>>} matches */
export async function ensureFifaShirtMaps(matches = []) {
  const pending = matches.filter(matchNeedsShirtMap);
  if (!pending.length) return { fetched: 0 };

  let fetched = 0;

  await Promise.all(
    pending.map(async (match) => {
      const meta = match.raw.fifaMeta;
      try {
        const live = await fetchLiveMatchFootball({
          idStage: meta.idStage,
          idMatch: meta.idMatch,
        });
        const shirtByPlayerId = buildShirtByPlayerId(live);
        if (!Object.keys(shirtByPlayerId).length) return;

        match.raw = {
          ...match.raw,
          fifaMeta: {
            ...meta,
            shirtByPlayerId,
            shirtMapSyncedAt: new Date().toISOString(),
          },
        };

        await Match.updateOne(
          { _id: match._id },
          {
            $set: {
              'raw.fifaMeta.shirtByPlayerId': shirtByPlayerId,
              'raw.fifaMeta.shirtMapSyncedAt': match.raw.fifaMeta.shirtMapSyncedAt,
            },
          }
        );
        fetched += 1;
      } catch (err) {
        console.warn(`FIFA shirt map skip match ${match.externalId}:`, err.message);
      }
    })
  );

  return { fetched };
}
