import { connectDb } from '../config/db.js';
import { User } from '../models/User.js';
import { FubolTransaction } from '../models/FubolTransaction.js';
import { grantWelcomeBonus } from '../services/fubolService.js';

async function main() {
  await connectDb();

  const users = await User.find({}).select('_id email balanceFubols').lean();
  let granted = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const existing = await FubolTransaction.findOne({
      idempotencyKey: `welcome:${user._id}`,
    }).lean();

    if (existing) {
      skipped += 1;
      continue;
    }

    if ((user.balanceFubols || 0) > 0) {
      skipped += 1;
      continue;
    }

    try {
      await grantWelcomeBonus(user._id);
      granted += 1;
      console.log(`+100 Fubols → ${user.email}`);
    } catch (err) {
      errors += 1;
      console.error(`Error ${user.email}:`, err.message);
    }
  }

  console.log(`Listo: ${granted} bonos, ${skipped} omitidos, ${errors} errores.`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
