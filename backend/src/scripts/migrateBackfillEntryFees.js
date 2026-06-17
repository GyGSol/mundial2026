import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { PrizePool } from '../models/PrizePool.js';
import { chargeGroupEntryFee } from '../services/fubolService.js';

const dryRun = process.env.DRY_RUN === '1';

async function main() {
  await connectDb();

  const [memberships, groups] = await Promise.all([
    UserGroupMembership.find().sort({ createdAt: 1 }).lean(),
    CompetitionGroup.find().select('name').lean(),
  ]);

  const groupNameById = Object.fromEntries(groups.map((g) => [String(g._id), g.name]));

  let charged = 0;
  let skippedAi = 0;
  let skippedPaid = 0;
  let insufficient = 0;
  let errors = 0;

  for (const membership of memberships) {
    const user = await User.findById(membership.userId).select('email isAiUser balanceFubols').lean();
    const groupId = String(membership.groupId);
    const label = `${user?.email ?? membership.userId} → ${groupNameById[groupId] ?? groupId}`;

    if (!user) {
      errors += 1;
      console.error(`Usuario no encontrado: ${membership.userId}`);
      continue;
    }

    if (user.isAiUser) {
      skippedAi += 1;
      console.log(`IA exenta: ${label}`);
      continue;
    }

    if (dryRun) {
      const balance = user.balanceFubols || 0;
      const wouldCharge = balance >= 100 ? 'COBRARÍA 100' : 'SALDO INSUFICIENTE';
      console.log(`[dry-run] ${label} (saldo ${balance}) → ${wouldCharge}`);
      if (balance >= 100) charged += 1;
      else insufficient += 1;
      continue;
    }

    try {
      const result = await chargeGroupEntryFee({
        userId: user._id,
        groupId: membership.groupId,
      });

      if (result.charged) {
        charged += 1;
        console.log(`✓ -100 Fubols · pozo ${result.prizePoolTotal} · ${label}`);
      } else if (result.reason === 'already_paid') {
        skippedPaid += 1;
        console.log(`Ya pagó: ${label}`);
      } else if (result.reason === 'ai_exempt') {
        skippedAi += 1;
        console.log(`IA exenta: ${label}`);
      } else {
        console.log(`Omitido (${result.reason}): ${label}`);
      }
    } catch (err) {
      if (err.status === 402) {
        insufficient += 1;
        console.warn(`Saldo insuficiente: ${label} (saldo ${user.balanceFubols ?? 0})`);
      } else {
        errors += 1;
        console.error(`Error ${label}:`, err.message);
      }
    }
  }

  const pools = await PrizePool.find().lean();
  console.log('\n--- Resumen ---');
  console.log(`Cobrados: ${charged}, ya pagados: ${skippedPaid}, IA exenta: ${skippedAi}, saldo insuficiente: ${insufficient}, errores: ${errors}`);
  for (const pool of pools) {
    const name = groupNameById[String(pool.groupId)] ?? pool.groupId;
    console.log(`Pozo ${name}: ${pool.totalFubols} Fubols`);
  }

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
