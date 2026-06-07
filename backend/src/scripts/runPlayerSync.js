import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { runPlayerSync } from '../services/playerSyncService.js';

async function main() {
  await connectDb();
  const result = await runPlayerSync();
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
