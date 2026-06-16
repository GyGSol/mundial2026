import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { auditMatchIntegrity } from '../services/matchIntegrityAuditService.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const report = await auditMatchIntegrity();
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  const hasIssues =
    report.summary.kickoffMismatchCount > 0 ||
    report.summary.missingGroupIds.length > 0 ||
    report.summary.wrongGroupCounts.length > 0 ||
    report.summary.orphanPredictions > 0 ||
    report.summary.predictionLinkIssues ||
    report.summary.worldcup26CollisionCount > 0 ||
    report.summary.sourceDisputeCount > 0;
  process.exit(hasIssues ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
