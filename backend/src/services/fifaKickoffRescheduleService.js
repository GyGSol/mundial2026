import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { Team } from '../models/Team.js';
import {
  fifaLocalDateToMdy,
  getCachedAllCalendarMatches,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import { clearMatchScores } from './matchScoringService.js';
import { notifyMatchesUpdated } from './websocketService.js';
import { invalidateMatchRelatedCaches } from './matchRelatedCaches.js';
import { normalizeWeatherOps } from './matchWeatherOpsRules.js';
import { resolveWeatherOpsProtocolKey } from '../data/stadiumWeatherProfile.js';

const FIFA_KICKOFF_DRIFT_MS = 5 * 60 * 1000;
const RESCHEDULE_LOOKBACK_MS = 3 * 60 * 60 * 1000;
const RESCHEDULE_LOOKAHEAD_MS = 6 * 60 * 60 * 1000;

function readFifaKickoffMs(fifaEntry) {
  if (!fifaEntry?.Date) return null;
  const ms = new Date(fifaEntry.Date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function buildFifaWeatherDelayOps(match, { originalKickoffAt, delayedKickoffAt, stadium }) {
  const protocol = resolveWeatherOpsProtocolKey(stadium) ?? 'fifa-calendar';
  const now = new Date();
  return {
    phase: 'pre_kickoff_delay',
    reason: 'severe_weather',
    protocol,
    since: now,
    resumeEarliestAt: delayedKickoffAt,
    originalKickoffAt,
    delayedKickoffAt,
    lastAlertAt: now,
    source: 'fifa-calendar',
    overlapGroupKey: match.weatherOps?.overlapGroupKey ?? null,
  };
}

function matchStartedOnField(match) {
  const elapsed = String(match?.raw?.time_elapsed ?? match?.raw?.timeElapsed ?? '')
    .trim()
    .toLowerCase();
  const home = Number(match.homeScore);
  const away = Number(match.awayScore);
  const hasGoals =
    (Number.isFinite(home) && home > 0) || (Number.isFinite(away) && away > 0);

  if (!elapsed || elapsed === 'notstarted' || elapsed === '0') {
    return hasGoals;
  }
  if (elapsed === 'live') {
    return hasGoals;
  }
  return true;
}

/**
 * Aplica reprogramaciones de kickoff publicadas en el calendario FIFA (p. ej. demora climática 22→23 ART).
 */
export async function syncFifaKickoffReschedules(now = Date.now()) {
  const windowStart = new Date(now - RESCHEDULE_LOOKBACK_MS);
  const windowEnd = new Date(now + RESCHEDULE_LOOKAHEAD_MS);

  const candidates = await Match.find({
    externalId: { $not: /^sim-/ },
    kickoffAt: { $gte: windowStart, $lte: windowEnd },
    status: { $in: ['upcoming', 'live'] },
  });

  if (!candidates.length) return { updated: [] };

  let fifaCalendar = [];
  try {
    fifaCalendar = await getCachedAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar unavailable for kickoff reschedule sync:', err.message);
    return { updated: [] };
  }

  const teamIds = [
    ...new Set(candidates.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean)),
  ];
  const stadiumIds = [...new Set(candidates.map((m) => m.stadiumId).filter(Boolean))];

  const [teams, stadiums] = await Promise.all([
    Team.find({ externalId: { $in: teamIds } }).select('externalId fifaCode nameEn').lean(),
    Stadium.find({ externalId: { $in: stadiumIds } }).lean(),
  ]);

  const teamMap = new Map(teams.map((team) => [String(team.externalId), team]));
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  const updated = [];

  for (const match of candidates) {
    const homeTeam = teamMap.get(String(match.homeTeamId));
    const awayTeam = teamMap.get(String(match.awayTeamId));
    const fifaEntry = await resolveFifaMatchEntry(fifaCalendar, match, homeTeam, awayTeam);
    const fifaKickoffMs = readFifaKickoffMs(fifaEntry);
    if (fifaKickoffMs == null) continue;

    const storedKickoffMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() : NaN;
    if (!Number.isFinite(storedKickoffMs)) continue;
    if (Math.abs(fifaKickoffMs - storedKickoffMs) < FIFA_KICKOFF_DRIFT_MS) continue;

    const started = matchStartedOnField(match);
    if (started && fifaKickoffMs > storedKickoffMs) continue;

    const originalKickoffAt = normalizeWeatherOps(match.weatherOps).originalKickoffAt ?? match.kickoffAt;
    const delayedKickoffAt = new Date(fifaKickoffMs);
    const stadium = stadiumMap[match.stadiumId];
    const localDateMdy = fifaEntry?.LocalDate ? fifaLocalDateToMdy(fifaEntry.LocalDate) : null;

    const update = {
      kickoffAt: delayedKickoffAt,
      weatherOps: buildFifaWeatherDelayOps(match, {
        originalKickoffAt,
        delayedKickoffAt,
        stadium,
      }),
      lastSyncedAt: new Date(),
    };

    if (localDateMdy) {
      update.localDate = localDateMdy;
    }

    if (match.status === 'live' && !started && fifaKickoffMs > now) {
      update.status = 'upcoming';
      update.homeScore = 0;
      update.awayScore = 0;
      update.raw = {
        ...(match.raw ?? {}),
        finished: 'FALSE',
        time_elapsed: 'notstarted',
      };
    }

    const claimed = await Match.findOneAndUpdate({ _id: match._id }, { $set: update }, { new: true });
    if (!claimed) continue;

    if (update.status === 'upcoming') {
      await clearMatchScores(claimed._id);
    }

    updated.push(claimed._id);
  }

  if (updated.length) {
    invalidateMatchRelatedCaches();
    notifyMatchesUpdated({
      reason: 'fifa_kickoff_reschedule',
      matchIds: updated.map((id) => id.toString()),
    });
  }

  return { updated };
}
