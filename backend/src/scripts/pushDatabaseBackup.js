import { connectDb } from '../config/db.js';
import { runManualDatabaseBackup } from '../services/matchFinishBackupService.js';
import mongoose from 'mongoose';

async function main() {
  await connectDb();

  const triggerIdx = process.argv.indexOf('--match-id');
  const triggerMatchId =
    triggerIdx >= 0 && process.argv[triggerIdx + 1] ? process.argv[triggerIdx + 1] : null;

  const result = await runManualDatabaseBackup({ triggerMatchId });
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
