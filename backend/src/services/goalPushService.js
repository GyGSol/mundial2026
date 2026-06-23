import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import {
  attachTimelineTournamentGoals,
  buildPriorTournamentGoalCounts,
  buildTimelineGoalKey,
  findNewTimelineGoals,
} from './matchLiveData.js';
import { getCachedFinishedMatchesForTournamentGoals } from './tournamentGoalsFinishedMatchesCache.js';
import { notifyGoalScored } from './pushNotificationService.js';
import { recalculateMatchScores } from './matchScoringService.js';

export { buildTimelineGoalKey, findNewTimelineGoals };

async function snapshotPredictionPoints(matchId) {
  const predictions = await Prediction.find({ matchId }).select('userId pointsEarned').lean();
  return new Map(
    predictions.map((prediction) => [String(prediction.userId), prediction.pointsEarned ?? 0])
  );
}

async function claimGoalNotification(matchId, goalKey) {
  const claimed = await Match.findOneAndUpdate(
    { _id: matchId, notifiedGoalKeys: { $nin: [goalKey] } },
    { $addToSet: { notifiedGoalKeys: goalKey } },
    { new: true }
  ).lean();
  return claimed;
}

function resolveTournamentGoalNumber(goalEvent, priorCounts) {
  const enriched = attachTimelineTournamentGoals([goalEvent], priorCounts);
  return enriched[0]?.playerTournamentGoals ?? null;
}

/**
 * Procesa goles nuevos detectados en un partido: recalcula puntos y envía push.
 * @param {object} params
 */
export async function processNewGoalsForMatch({
  match,
  newGoals = [],
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
}) {
  if (!newGoals.length || match.status !== 'live') {
    return { sent: 0, goals: 0, skipped: true };
  }

  const pointsBeforeByUserId = await snapshotPredictionPoints(match._id);
  await recalculateMatchScores(match._id);

  const finishedMatches = await getCachedFinishedMatchesForTournamentGoals();
  const priorCounts = buildPriorTournamentGoalCounts(finishedMatches, match.externalId);

  let sent = 0;
  let goalsNotified = 0;

  for (const goalEvent of newGoals) {
    const goalKey = buildTimelineGoalKey(goalEvent);
    const claimed = await claimGoalNotification(match._id, goalKey);
    if (!claimed) continue;

    const scoringTeam = goalEvent.side === 'home' ? homeTeam : awayTeam;
    const opponentTeam = goalEvent.side === 'home' ? awayTeam : homeTeam;
    const tournamentGoalNumber = resolveTournamentGoalNumber(goalEvent, priorCounts);

    const result = await notifyGoalScored({
      match: claimed,
      goalEvent: { ...goalEvent, goalKey },
      scoringTeam,
      opponentTeam,
      homeScore,
      awayScore,
      tournamentGoalNumber,
      pointsBeforeByUserId,
    });

    sent += result.sent ?? 0;
    goalsNotified += 1;
  }

  return { sent, goals: goalsNotified, skipped: goalsNotified === 0 };
}

/**
 * @param {Array<{ match: object, newGoals: object[], homeScore: number, awayScore: number }>} goalUpdates
 */
export async function processGoalUpdates(goalUpdates = []) {
  let sent = 0;
  let goals = 0;

  for (const update of goalUpdates) {
    const { match, newGoals, homeScore, awayScore } = update;
    if (!newGoals?.length) continue;

    const [homeTeam, awayTeam] = await Promise.all([
      Team.findOne({ externalId: match.homeTeamId }).lean(),
      Team.findOne({ externalId: match.awayTeamId }).lean(),
    ]);

    const result = await processNewGoalsForMatch({
      match,
      newGoals,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
    });
    sent += result.sent ?? 0;
    goals += result.goals ?? 0;
  }

  return { sent, goals };
}
