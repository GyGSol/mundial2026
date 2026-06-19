import { gunzipSync } from 'zlib';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { deserializeDocument } from '../services/backupSerialization.js';

const dryRun = process.env.DRY_RUN === '1';
const confirm = process.env.CONFIRM === '1';

function readArgFile() {
  const idx = process.argv.indexOf('--file');
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return process.env.BACKUP_FILE || null;
}

function loadBackupPayload(filePath) {
  const buf = fs.readFileSync(filePath);
  const isGzip = filePath.endsWith('.gz');
  const json = isGzip ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  return JSON.parse(json);
}

async function restoreCollection(db, name, documents, { drop = false } = {}) {
  const collection = db.collection(name);
  if (drop && !dryRun) {
    await collection.deleteMany({});
  }
  if (!documents?.length) {
    return { name, inserted: 0 };
  }
  const deserialized = documents.map(deserializeDocument);
  if (dryRun) {
    return { name, inserted: deserialized.length, dryRun: true };
  }
  if (drop) {
    await collection.insertMany(deserialized, { ordered: false });
    return { name, inserted: deserialized.length };
  }
  const ops = deserialized.map((doc) => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true,
    },
  }));
  const result = await collection.bulkWrite(ops, { ordered: false });
  const inserted = (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0) + (result.matchedCount ?? 0);
  return { name, inserted };
}

async function main() {
  if (!dryRun && !confirm) {
    console.error('Set DRY_RUN=1 to preview or CONFIRM=1 to apply.');
    process.exit(1);
  }

  const filePath = readArgFile();
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('Usage: CONFIRM=1 node src/scripts/restoreDatabaseFromBackup.js --file=path/to/full-database.json.gz');
    process.exit(1);
  }

  await connectDb();
  const db = mongoose.connection.db;
  const payload = loadBackupPayload(filePath);

  if (payload.type === 'full_database') {
    const names = Object.keys(payload.collections || {});
    console.log(`Mode: ${dryRun ? 'DRY_RUN' : 'CONFIRM'}`);
    console.log(`Backup: ${filePath}`);
    console.log(`Exported: ${payload.exportedAt}`);
    console.log(`Collections: ${names.length}, documents: ${payload.stats?.documents ?? '?'}\n`);

    const results = [];
    for (const name of names.sort()) {
      const docs = payload.collections[name];
      const drop = confirm && process.env.BACKUP_RESTORE_DROP === '1';
      const r = await restoreCollection(db, name, docs, { drop });
      results.push(r);
      console.log(`  ${name}: ${r.inserted} docs${r.dryRun ? ' (dry)' : ''}`);
    }

    console.log('\nDone.', results.reduce((s, r) => s + r.inserted, 0), 'documents processed');
    if (dryRun) {
      console.log('Run with CONFIRM=1 to apply. Use BACKUP_RESTORE_DROP=1 to wipe each collection before insert.');
    }
  } else {
    console.error('Unsupported backup type:', payload.type);
    process.exit(1);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
