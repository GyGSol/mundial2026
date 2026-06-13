import { Match } from '../models/Match.js';
import { fetchLiveMatchFootball } from './fifaApiClient.js';
import { buildShirtLookups } from '../utils/fifaSquadShirtMap.js';

function matchNeedsShirtMap(match) {
  const meta = match.raw?.fifaMeta;
  const timeline = match.raw?.fifaEvents?.timeline;
  return (
    Array.isArray(timeline) &&
    timeline.length > 0 &&
    meta?.idMatch &&
    meta?.idStage &&
    !meta?.shirtByPlayerId &&
    !meta?.shirtBySideName
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
        const { shirtByPlayerId, shirtBySideName } = buildShirtLookups(live);
        if (!Object.keys(shirtByPlayerId).length) return;

        match.raw = {
          ...match.raw,
          fifaMeta: {
            ...meta,
            shirtByPlayerId,
            shirtBySideName,
            shirtMapSyncedAt: new Date().toISOString(),
          },
        };

        await Match.updateOne(
          { _id: match._id },
          {
            $set: {
              'raw.fifaMeta.shirtByPlayerId': shirtByPlayerId,
              'raw.fifaMeta.shirtBySideName': shirtBySideName,
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
