#!/usr/bin/env node
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';
import { getRankingDashboard } from '../services/rankingDashboardService.js';
import { breakdownForLiveKickoffIndicators } from '../services/leaderboardService.js';

function statCreditFromBreakdown(key, breakdown, bonusPoint = 0) {
  switch (key) {
    case 'pa':
      return (breakdown?.winner ?? 0) > 0 ? 1 : 0;
    case 'gl':
      return (breakdown?.homeGoals ?? 0) > 0 ? 1 : 0;
    case 'gv':
      return (breakdown?.awayGoals ?? 0) > 0 ? 1 : 0;
    case 'gt':
      return (breakdown?.totalGoals ?? 0) > 0 ? 1 : 0;
    case 'pb':
      return (bonusPoint ?? 0) > 0 ? 1 : 0;
    default:
      return 0;
  }
}

function kickoffCredit(key, prediction) {
  const raw = prediction.liveKickoffBreakdown ?? null;
  if (!raw) return null;
  if (key === 'gl') {
    return statCreditFromBreakdown(key, breakdownForLiveKickoffIndicators(raw), 0);
  }
  return statCreditFromBreakdown(key, raw, 0);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dash = await getRankingDashboard(null, null);
  const matchIds = dash.leaderboardLiveStatIndicators?.liveMatchIds ?? [];
  const matches = await Match.find({ _id: { $in: matchIds } }).lean();
  const matchById = Object.fromEntries(matches.map((m) => [m._id.toString(), m]));

  console.log(
    'indicator matches:',
    matchIds.map((id) => {
      const m = matchById[id];
      return m
        ? `${m.homeTeamId}-${m.awayTeamId} ${m.homeScore}-${m.awayScore} (${m.status})`
        : id;
    })
  );

  const sampleNames = ['Tixe', 'Raguccito', 'Marcelo', 'Yago'];
  for (const name of sampleNames) {
    const user = await User.findOne({ name }).lean();
    if (!user) continue;
    const preds = await Prediction.find({
      userId: user._id,
      matchId: { $in: matchIds },
      pointsEarned: { $ne: null },
    }).lean();
    const ind = dash.leaderboardLiveStatIndicators?.byUser?.[user._id.toString()];
    console.log(`\n=== ${name} indicators`, ind);
    for (const p of preds) {
      const m = matchById[p.matchId.toString()];
      const label = m ? `${m.homeTeamId}-${m.awayTeamId} ${m.homeScore}-${m.awayScore}` : p.matchId;
      const row = {
        match: label,
        pred: `${p.homeGoals}-${p.awayGoals}`,
        current: p.pointsBreakdown,
        kickoff: p.liveKickoffBreakdown,
        credits: {
          pa: [kickoffCredit('pa', p), statCreditFromBreakdown('pa', p.pointsBreakdown ?? {}, 0)],
          gl: [kickoffCredit('gl', p), statCreditFromBreakdown('gl', p.pointsBreakdown ?? {}, 0)],
          gv: [kickoffCredit('gv', p), statCreditFromBreakdown('gv', p.pointsBreakdown ?? {}, 0)],
          gt: [kickoffCredit('gt', p), statCreditFromBreakdown('gt', p.pointsBreakdown ?? {}, 0)],
        },
      };
      console.log(row);
    }
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
