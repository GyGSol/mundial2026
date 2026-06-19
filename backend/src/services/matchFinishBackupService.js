import mongoose from 'mongoose';
import { SyncMeta } from '../models/SyncMeta.js';
import { buildFullDatabaseBackup } from './databaseBackupService.js';
import { buildPredictionsExport } from './tournamentSnapshotService.js';
import { backupGithubConfigured, pushBackupFiles } from './githubBackupService.js';
import { env } from '../config/env.js';

const META_KEY = 'matchFinishBackups';

function normalizeMatchIds(matchIds) {
  return [...new Set(matchIds.map((id) => id.toString()).filter(Boolean))];
}

async function loadBackupMeta() {
  const doc = await SyncMeta.findOne({ key: META_KEY }).lean();
  return doc?.raw ?? { byMatchId: {}, lastError: null };
}

async function saveBackupMeta(raw) {
  await SyncMeta.findOneAndUpdate(
    { key: META_KEY },
    {
      key: META_KEY,
      lastSyncAt: new Date(),
      lastSyncError: raw.lastError ?? null,
      raw,
    },
    { upsert: true }
  );
}

async function runBackupForMatch(matchId) {
  if (!backupGithubConfigured()) {
    return { skipped: true, reason: 'not_configured' };
  }

  const matchIdStr = matchId.toString();
  const full = await buildFullDatabaseBackup({ triggerMatchId: matchId });
  const predictionsExport = await buildPredictionsExport();

  const files = [
    ...full.files,
    {
      path: `${full.folder}/predictions-export.json`,
      content: Buffer.from(JSON.stringify(predictionsExport, null, 2), 'utf8'),
      encoding: 'base64',
    },
  ];

  const ext = full.trigger?.matchExternalId ?? matchIdStr;
  const message = `backup: match #${ext} finished (${full.stats.documents} docs)`;

  const pushed = await pushBackupFiles({ files, message });

  const meta = await loadBackupMeta();
  meta.byMatchId = meta.byMatchId ?? {};
  meta.byMatchId[matchIdStr] = {
    at: new Date().toISOString(),
    folder: full.folder,
    externalId: full.trigger?.matchExternalId ?? null,
    documents: full.stats.documents,
    gzipSizeBytes: full.gzipSizeBytes,
    files: pushed.map((f) => f.path),
  };
  meta.lastError = null;
  await saveBackupMeta(meta);

  console.log(
    `Match finish backup: #${ext} → ${env.backupGithubRepo} (${files.length} files, ${full.stats.documents} docs)`
  );

  return {
    skipped: false,
    matchId: matchIdStr,
    folder: full.folder,
    files: pushed,
    stats: full.stats,
  };
}

/**
 * Programa backup async tras pitido final (no bloquea sync).
 */
export function scheduleBackupsForFinishedMatches(matchIds) {
  if (!env.backupEnabled || !backupGithubConfigured()) return;

  const ids = normalizeMatchIds(matchIds);
  if (!ids.length) return;

  void (async () => {
    const meta = await loadBackupMeta();
    const byMatchId = meta.byMatchId ?? {};

    for (const matchIdStr of ids) {
      if (byMatchId[matchIdStr]?.at) {
        continue;
      }
      try {
        await runBackupForMatch(new mongoose.Types.ObjectId(matchIdStr));
      } catch (err) {
        console.error(`Match finish backup failed (${matchIdStr}):`, err.message);
        meta.lastError = {
          matchId: matchIdStr,
          at: new Date().toISOString(),
          message: err.message,
        };
        await saveBackupMeta(meta);
      }
    }
  })();
}

/** Backup manual / on-demand (sin dedup). */
export async function runManualDatabaseBackup({ triggerMatchId = null } = {}) {
  if (!backupGithubConfigured()) {
    throw new Error('Backup GitHub not configured');
  }

  const full = await buildFullDatabaseBackup({ triggerMatchId });
  const predictionsExport = await buildPredictionsExport();
  const files = [
    ...full.files,
    {
      path: `${full.folder}/predictions-export.json`,
      content: Buffer.from(JSON.stringify(predictionsExport, null, 2), 'utf8'),
      encoding: 'base64',
    },
  ];

  const ext = full.trigger?.matchExternalId ?? 'manual';
  const message = `backup: manual #${ext} (${full.stats.documents} docs)`;
  const pushed = await pushBackupFiles({ files, message });

  console.log(
    `Manual database backup → ${env.backupGithubRepo} (${files.length} files, ${full.stats.documents} docs)`
  );

  return { folder: full.folder, files: pushed, stats: full.stats };
}
