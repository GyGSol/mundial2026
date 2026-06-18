import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { runPlayerWikiSync } from '../services/playerWikiService.js';

function parseArgs(argv) {
  const options = { fifaCode: '', limit: 0, force: false };
  for (const arg of argv) {
    if (arg.startsWith('--team=')) options.fifaCode = arg.slice('--team='.length);
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length)) || 0;
    else if (arg === '--force') options.force = true;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await connectDb();
  const result = await runPlayerWikiSync(options);
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  process.exit(result.failed > 0 && result.synced === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
