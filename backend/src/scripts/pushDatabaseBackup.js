import { connectDb } from '../config/db.js';
import { runManualDatabaseBackup } from '../services/matchFinishBackupService.js';
import mongoose from 'mongoose';
// Registra schemas antes de populate en buildPredictionsExport
import '../models/User.js';
import '../models/Prediction.js';
import '../models/Match.js';
import '../models/Team.js';

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
