import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Stadium } from '../models/Stadium.js';
import { Team } from '../models/Team.js';
import { compareMatchesBySchedule } from './matchSortService.js';
import { auditPredictionMatchLinks, loadFifaFixtureContext } from './predictionMatchLinkService.js';
import { resolveOfficialKickoffAt } from './kickoffTimeService.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';

function kickoffMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Registra cuando un payload worldcup26 no puede fusionarse con el slot resuelto
 * (par de equipos distinto o colisión de id numérico).
 */
export function collectWorldCup26SyncWarning({ rawGame, doc, existing }) {
  if (!existing || !doc) return null;

  const teamsMismatch =
    existing.homeTeamId !== doc.homeTeamId || existing.awayTeamId !== doc.awayTeamId;
  const idCollision = String(existing.externalId) !== String(doc.externalId);

  if (!teamsMismatch && !idCollision) return null;

  const raw = rawGame ?? doc.raw ?? {};
  const summary = teamsMismatch
    ? `Payload worldcup26 id=${doc.externalId} describe equipos distintos al slot FIFA ${existing.externalId}`
    : `worldcup26 id=${doc.externalId} distinto del MatchNumber FIFA ${existing.externalId} (mismo par de equipos)`;

  return {
    type: teamsMismatch ? 'teams_mismatch' : 'id_collision',
    worldcup26GameId: String(doc.externalId),
    worldcup26HomeTeamId: doc.homeTeamId,
    worldcup26AwayTeamId: doc.awayTeamId,
    worldcup26HomeName: raw.home_team_name_en ?? raw.homeTeamNameEn ?? '',
    worldcup26AwayName: raw.away_team_name_en ?? raw.awayTeamNameEn ?? '',
    worldcup26LocalDate: doc.localDate ?? raw.local_date ?? '',
    worldcup26Finished: raw.finished ?? raw.Finished ?? '',
    worldcup26TimeElapsed: raw.time_elapsed ?? raw.timeElapsed ?? '',
    targetMatchExternalId: String(existing.externalId),
    targetMatchId: String(existing._id),
    idCollision,
    summary,
  };
}

export function buildSourceDisputes({
  matches,
  teams,
  fifaTargets,
  teamCodeById,
  worldcup26Warnings = [],
  kickoffMismatches = [],
  slotMismatches = [],
}) {
  const teamById = new Map(teams.map((t) => [t.externalId, t]));
  const matchByExternalId = new Map(matches.map((m) => [String(m.externalId), m]));
  const disputes = [];
  const seen = new Set();

  const pushDispute = (dispute) => {
    const key = `${dispute.externalId}:${dispute.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    disputes.push(dispute);
  };

  for (const warning of worldcup26Warnings) {
    if (warning.type !== 'teams_mismatch') continue;
    const match = matchByExternalId.get(String(warning.targetMatchExternalId));
    if (!match) continue;
    const fifa = fifaTargets.get(String(match.externalId));
    pushDispute(
      assembleDispute({
        match,
        fifa,
        teamById,
        teamCodeById,
        type: 'teams_mismatch',
        summary: warning.summary,
        wc26: warning,
      })
    );
  }

  for (const slot of slotMismatches) {
    const match = matchByExternalId.get(String(slot.externalId));
    if (!match) continue;
    const fifa = fifaTargets.get(String(slot.externalId));
    pushDispute(
      assembleDispute({
        match,
        fifa,
        teamById,
        teamCodeById,
        type: 'teams_mismatch',
        summary: `Slot FIFA ${slot.externalId}: DB ${slot.db}, FIFA ${slot.fifa}`,
        wc26: null,
      })
    );
  }

  for (const km of kickoffMismatches) {
    const match = matchByExternalId.get(String(km.externalId));
    if (!match) continue;
    const fifa = fifaTargets.get(String(match.externalId));
    pushDispute(
      assembleDispute({
        match,
        fifa,
        teamById,
        teamCodeById,
        type: 'kickoff_mismatch',
        summary: `kickoffAt DB difiere del fixture oficial en ${km.diffMinutes} min`,
        wc26: null,
        kickoffDetail: km,
      })
    );
  }

  return disputes;
}

function assembleDispute({
  match,
  fifa,
  teamById,
  teamCodeById,
  type,
  summary,
  wc26,
  kickoffDetail = null,
}) {
  const homeTeam = teamById.get(match.homeTeamId);
  const awayTeam = teamById.get(match.awayTeamId);
  const officialKickoff = resolveOfficialKickoffAt(match.externalId);

  return {
    externalId: String(match.externalId),
    type,
    summary,
    fifa: {
      externalId: String(match.externalId),
      group: fifa?.group ?? match.group ?? '',
      matchday: match.matchday ?? '',
      homeCode: fifa?.homeCode ?? teamCodeById.get(match.homeTeamId) ?? '',
      awayCode: fifa?.awayCode ?? teamCodeById.get(match.awayTeamId) ?? '',
      homeName: homeTeam?.nameEn ?? '',
      awayName: awayTeam?.nameEn ?? '',
      kickoffAtUtc: officialKickoff?.toISOString?.() ?? null,
    },
    official: {
      kickoffAtUtc: officialKickoff?.toISOString?.() ?? null,
    },
    db: {
      homeCode: teamCodeById.get(match.homeTeamId) ?? '',
      awayCode: teamCodeById.get(match.awayTeamId) ?? '',
      homeName: homeTeam?.nameEn ?? '',
      awayName: awayTeam?.nameEn ?? '',
      kickoffAtUtc: match.kickoffAt ? new Date(match.kickoffAt).toISOString() : null,
      status: match.status,
    },
    wc26: wc26
      ? {
          id: wc26.worldcup26GameId,
          homeName: wc26.worldcup26HomeName,
          awayName: wc26.worldcup26AwayName,
          localDate: wc26.worldcup26LocalDate,
          finished: wc26.worldcup26Finished,
          timeElapsed: wc26.worldcup26TimeElapsed,
        }
      : null,
    kickoffDetail,
    matchId: String(match._id),
    stadiumId: match.stadiumId ?? '',
  };
}

export async function auditMatchIntegrity({ worldcup26Warnings = [] } = {}) {
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
  const { targets: fifaTargets, teamCodeById } = await loadFifaFixtureContext();
  const teams = await Team.find().select('externalId fifaCode nameEn').lean();

  const worldcup26CollisionCount = worldcup26Warnings.filter(
    (w) => w.type === 'teams_mismatch' || w.type === 'id_collision'
  ).length;

  const disputes = buildSourceDisputes({
    matches,
    teams,
    fifaTargets,
    teamCodeById,
    worldcup26Warnings,
    kickoffMismatches,
    slotMismatches: predictionLinks.slotMismatches ?? [],
  });

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
    worldcup26CollisionCount,
    sourceDisputeCount: disputes.length,
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
    worldcup26Warnings,
    disputes,
  };
}

export async function attachStadiumContextToDisputes(disputes) {
  const stadiumIds = [...new Set(disputes.map((d) => d.stadiumId).filter(Boolean))];
  const stadiums = await Stadium.find({ externalId: { $in: stadiumIds } })
    .select('externalId nameEn city country timezone')
    .lean();
  const stadiumById = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  return disputes.map((dispute) => {
    const stadium = stadiumById[dispute.stadiumId];
    return {
      ...dispute,
      stadium: stadium
        ? {
            nameEn: stadium.nameEn ?? '',
            city: stadium.city ?? '',
            country: stadium.country ?? '',
            timezone: stadium.timezone || resolveStadiumTimezone(stadium) || '',
          }
        : { nameEn: '', city: '', country: '', timezone: '' },
    };
  });
}

export async function runPostSyncMatchAudit({ worldcup26Warnings = [] } = {}) {
  const report = await auditMatchIntegrity({ worldcup26Warnings });
  const disputes = await attachStadiumContextToDisputes(report.disputes);
  return { ...report, disputes };
}
