import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import {
  resolveOfficialKickoffAt,
} from '../services/kickoffTimeService.js';
import { compareMatchesBySchedule } from '../services/matchSortService.js';
import { auditPredictionMatchLinks } from '../services/predictionMatchLinkService.js';

dotenv.config();

function kickoffMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export async function auditMatchIntegrity() {
  const matches = await Match.find({ externalId: { $not: /^sim-/ } }).lean();
  const predictions = await Prediction.find().lean();
  const matchById = new Map(matches.map((m) => [String(m._id), m]));

  const kickoffMismatches = [];
  for (const match of matches) {
    const official = resolveOfficialKickoffAt(match.externalId);
    const dbMs = kickoffMs(match.kickoffAt);
    if (official && dbMs != null && official.getTime() !== dbMs) {
      kickoffMismatches.push({
        externalId: match.externalId,
        group: match.group,
        dbKickoff: new Date(dbMs).toISOString(),
        officialKickoff: official.toISOString(),
        diffMinutes: Math.round((dbMs - official.getTime()) / 60000),
      });
    }
  }

  const groupStage = matches.filter((m) => {
    const n = Number(m.externalId);
    return Number.isFinite(n) && n >= 1 && n <= 72;
  });
  const missingGroupIds = [];
  for (let i = 1; i <= 72; i += 1) {
    if (!groupStage.some((m) => Number(m.externalId) === i)) missingGroupIds.push(i);
  }

  const byGroup = {};
  for (const match of groupStage) {
    const g = match.group || '?';
    byGroup[g] = (byGroup[g] || 0) + 1;
  }
  const wrongGroupCounts = Object.entries(byGroup)
    .filter(([, count]) => count !== 6)
    .map(([group, count]) => ({ group, count }));

  const orphans = predictions.filter((p) => !matchById.has(String(p.matchId)));

  const statusAnomalies = matches.filter((m) => {
    const ko = kickoffMs(m.kickoffAt);
    if (!ko) return false;
    const hoursSinceKickoff = (Date.now() - ko) / (60 * 60 * 1000);
    return m.status === 'upcoming' && hoursSinceKickoff > 6;
  });

  const dbOrder = [...groupStage].sort((a, b) => kickoffMs(a.kickoffAt) - kickoffMs(b.kickoffAt));
  const scheduleOrder = [...groupStage].sort(compareMatchesBySchedule);
  const orderDiffs = [];
  for (let i = 0; i < scheduleOrder.length; i += 1) {
    if (scheduleOrder[i].externalId !== dbOrder[i]?.externalId) {
      orderDiffs.push({
        index: i,
        scheduleId: scheduleOrder[i].externalId,
        dbKickoffId: dbOrder[i]?.externalId,
      });
    }
  }

  const predictionLinks = await auditPredictionMatchLinks();

  const summary = {
    totalMatches: matches.length,
    groupStageCount: groupStage.length,
    missingGroupIds,
    wrongGroupCounts,
    kickoffMismatchCount: kickoffMismatches.length,
    orderDiffCount: orderDiffs.length,
    orphanPredictions: orphans.length,
    statusAnomalyCount: statusAnomalies.length,
    predictionLinkIssues: predictionLinks.summary.hasIssues,
  };

  return {
    summary,
    kickoffMismatches,
    orderDiffs: orderDiffs.slice(0, 20),
    orphans: orphans.slice(0, 20).map((p) => ({
      predictionId: String(p._id),
      matchId: String(p.matchId),
      userSubmitted: p.userSubmitted,
    })),
    statusAnomalies: statusAnomalies.slice(0, 20).map((m) => ({
      externalId: m.externalId,
      status: m.status,
      kickoffAt: m.kickoffAt,
    })),
    predictionLinks: predictionLinks.summary,
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const report = await auditMatchIntegrity();
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  const hasIssues =
    report.summary.kickoffMismatchCount > 0 ||
    report.summary.missingGroupIds.length > 0 ||
    report.summary.wrongGroupCounts.length > 0 ||
    report.summary.orphanPredictions > 0 ||
    report.summary.predictionLinkIssues;
  process.exit(hasIssues ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
