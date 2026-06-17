import { connectDb } from '../config/db.js';
import { ensureAiCompetitorInAllGroups } from '../services/aiGroupMembershipService.js';
import { PrizePool } from '../models/PrizePool.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';

async function main() {
  await connectDb();

  const results = await ensureAiCompetitorInAllGroups();
  const groups = await CompetitionGroup.find().select('name').lean();
  const groupNameById = Object.fromEntries(groups.map((g) => [String(g._id), g.name]));
  const pools = await PrizePool.find().lean();

  let added = 0;
  let charged = 0;

  for (const row of results) {
    if (row.added) added += 1;
    if (row.entryFee?.charged) charged += 1;
    const pool = pools.find((p) => String(p.groupId) === row.groupId);
    console.log(
      `${row.groupName ?? groupNameById[row.groupId] ?? row.groupId}: ` +
        `${row.added ? 'IA agregada' : 'IA ya estaba'} · ` +
        `inscripción ${row.entryFee?.charged ? 'cobrada' : row.entryFee?.reason ?? '—'} · ` +
        `pozo ${pool?.totalFubols ?? 0} Fubols`
    );
  }

  console.log(`\nGrupos: ${results.length}, IA nuevas: ${added}, inscripciones cobradas: ${charged}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
