import { connectDb } from '../config/db.js';
import { runSync } from '../services/syncService.js';

async function main() {
  await connectDb();
  const result = await runSync();
  console.log('Manual sync result:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
