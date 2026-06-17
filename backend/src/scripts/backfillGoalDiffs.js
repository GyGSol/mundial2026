import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { backfillPredictionGoalDiffs } from '../services/predictionMigrationService.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await backfillPredictionGoalDiffs({ onlyMissing: false });
  console.log('Goal diff backfill:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
