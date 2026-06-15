import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { alignMatchesFromFifaCalendar } from '../services/fifaFixtureAlignmentService.js';
import {
  auditPredictionMatchLinks,
  repairMisplacedPredictions,
} from '../services/predictionMatchLinkService.js';

dotenv.config();

async function main() {
  const apply = process.argv.includes('--apply');
  const mergePreferSource = process.argv.includes('--merge-prefer-source');
  const skipAlign = process.argv.includes('--skip-align');

  await mongoose.connect(process.env.MONGODB_URI);

  const before = await auditPredictionMatchLinks();
  console.log('Audit before repair:', JSON.stringify(before.summary, null, 2));

  const repair = await repairMisplacedPredictions({ apply, mergePreferSource });
  console.log('Repair result:', JSON.stringify(repair, null, 2));

  if (apply && !skipAlign) {
    const alignment = await alignMatchesFromFifaCalendar();
    console.log('FIFA fixture alignment:', JSON.stringify(alignment, null, 2));
  }

  const after = await auditPredictionMatchLinks();
  console.log('Audit after repair:', JSON.stringify(after.summary, null, 2));

  await mongoose.disconnect();
  process.exit(after.summary.hasIssues ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
