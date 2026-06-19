import { gzipSync } from 'zlib';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { serializeDocument } from './backupSerialization.js';

const BACKUP_VERSION = 1;
const MAX_SINGLE_GZIP_BYTES = 45 * 1024 * 1024;

function isoTimestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
}

function backupFolderPath(triggerMatch, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const ext = triggerMatch?.externalId ?? 'manual';
  const stamp = isoTimestampForPath(date);
  return `backups/${y}/${m}/${d}/match-${ext}-${stamp}`;
}

export async function resolveBackupTrigger(matchId) {
  if (!matchId) return null;
  const match = await Match.findById(matchId)
    .select('_id externalId homeScore awayScore status homeTeamId awayTeamId')
    .lean();
  if (!match) return null;
  return {
    matchId: match._id.toString(),
    matchExternalId: match.externalId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  };
}

async function listUserCollectionNames(db) {
  const collections = await db.listCollections().toArray();
  return collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort((a, b) => a.localeCompare(b));
}

export async function buildFullDatabaseBackup({ triggerMatchId = null } = {}) {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB not connected');
  }

  const exportedAt = new Date();
  const trigger = triggerMatchId ? await resolveBackupTrigger(triggerMatchId) : null;
  const collectionNames = await listUserCollectionNames(db);

  const collections = {};
  let documentCount = 0;

  for (const name of collectionNames) {
    const docs = await db.collection(name).find({}).toArray();
    collections[name] = docs.map(serializeDocument);
    documentCount += docs.length;
  }

  const payload = {
    version: BACKUP_VERSION,
    type: 'full_database',
    exportedAt: exportedAt.toISOString(),
    database: db.databaseName,
    trigger,
    collections,
    stats: {
      collections: collectionNames.length,
      documents: documentCount,
    },
  };

  const json = JSON.stringify(payload);
  const gzipBuffer = gzipSync(Buffer.from(json, 'utf8'));

  const folder = backupFolderPath(trigger, exportedAt);
  const files = [];

  if (gzipBuffer.length <= MAX_SINGLE_GZIP_BYTES) {
    files.push({
      path: `${folder}/full-database.json.gz`,
      content: gzipBuffer,
      encoding: 'base64',
    });
  } else {
    for (const name of collectionNames) {
      const chunk = {
        version: BACKUP_VERSION,
        type: 'full_database_collection',
        exportedAt: exportedAt.toISOString(),
        database: db.databaseName,
        collection: name,
        documents: collections[name],
      };
      const chunkGzip = gzipSync(Buffer.from(JSON.stringify(chunk), 'utf8'));
      files.push({
        path: `${folder}/collections/${name}.json.gz`,
        content: chunkGzip,
        encoding: 'base64',
      });
    }
    const manifest = {
      version: BACKUP_VERSION,
      type: 'full_database_manifest',
      exportedAt: exportedAt.toISOString(),
      database: db.databaseName,
      trigger,
      stats: payload.stats,
      collections: collectionNames,
    };
    files.push({
      path: `${folder}/manifest.json`,
      content: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
      encoding: 'base64',
    });
  }

  return {
    folder,
    exportedAt,
    trigger,
    stats: payload.stats,
    gzipSizeBytes: gzipBuffer.length,
    files,
  };
}

export { backupFolderPath, BACKUP_VERSION, MAX_SINGLE_GZIP_BYTES };
