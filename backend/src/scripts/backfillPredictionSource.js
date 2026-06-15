import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { backfillSubmittedPredictionSource } from '../services/predictionMigrationService.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await backfillSubmittedPredictionSource();
  console.log('Prediction source backfill:', result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
