import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { auditPredictionMatchLinks } from '../services/predictionMatchLinkService.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const report = await auditPredictionMatchLinks();
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.summary.hasIssues ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
