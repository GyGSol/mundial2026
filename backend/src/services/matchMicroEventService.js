import { MatchMicroEvent } from '../models/MatchMicroEvent.js';
import { enrichMatchLiveFields } from './matchLiveData.js';

function eventKey(event) {
  const minute = event.minute ?? 'x';
  const extra = event.extraMinute ?? '0';
  const type = event.type ?? 'unknown';
  const side = event.side ?? 'n';
  const player = (event.player ?? event.playerName ?? '').toLowerCase().trim();
  return `${type}:${side}:${minute}+${extra}:${player}`;
}

export function timelineToMicroEvents(match, timeline = []) {
  const events = [];
  for (const entry of timeline) {
    if (!entry || entry.type !== 'goal') continue;
    events.push({
      matchId: match._id,
      minute: entry.minute ?? null,
      extraMinute: entry.extraMinute ?? null,
      type: 'goal',
      teamId:
        entry.side === 'home'
          ? match.homeTeamId
          : entry.side === 'away'
            ? match.awayTeamId
            : null,
      playerName: entry.player ?? null,
      scorer: true,
      side: entry.side ?? null,
      source: entry.source ?? 'timeline',
      eventKey: eventKey(entry),
    });
  }
  return events;
}

/** Persiste goles con minuto/goleador desde timeline unificada. */
export async function syncMicroEventsFromMatch(match) {
  if (!match?._id) return { upserted: 0 };

  const enriched = enrichMatchLiveFields(match);
  const timeline = enriched.matchTimeline ?? [];
  const microEvents = timelineToMicroEvents(match, timeline);

  let upserted = 0;
  for (const doc of microEvents) {
    await MatchMicroEvent.findOneAndUpdate(
      { matchId: doc.matchId, eventKey: doc.eventKey },
      { $set: doc },
      { upsert: true }
    );
    upserted += 1;
  }

  return { upserted };
}

export async function listMicroEventsForMatch(matchId) {
  return MatchMicroEvent.find({ matchId }).sort({ minute: 1, extraMinute: 1 }).lean();
}

export async function buildMicroEventsContextBlock(matchId) {
  const events = await listMicroEventsForMatch(matchId);
  if (!events.length) return null;

  return {
    totalGoals: events.filter((e) => e.type === 'goal').length,
    goals: events
      .filter((e) => e.type === 'goal')
      .map((e) => ({
        minute: e.minute,
        extraMinute: e.extraMinute,
        side: e.side,
        player: e.playerName,
        source: e.source,
      })),
  };
}
