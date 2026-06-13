/**
 * Uso: node src/scripts/upsertStreamLink.js <matchExternalId> <la18PageUrl> [la18EventId]
 * Ejemplo:
 *   node src/scripts/upsertStreamLink.js 7 "https://la18hd.com/vivo/canales.php?stream=disney6" disney6
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { upsertStreamLinkMapping } from '../services/streamLinkService.js';

const [matchExternalId, la18PageUrl, la18EventId = ''] = process.argv.slice(2);

if (!matchExternalId || !la18PageUrl) {
  console.error('Uso: node src/scripts/upsertStreamLink.js <matchExternalId> <la18PageUrl> [la18EventId]');
  process.exit(1);
}

await mongoose.connect(env.mongodbUri);

try {
  const doc = await upsertStreamLinkMapping(
    matchExternalId,
    {
      la18PageUrl,
      embedUrl: la18PageUrl,
      la18EventId,
      enabled: true,
      notes: 'Cargado vía upsertStreamLink.js',
    },
    'script'
  );
  console.log(JSON.stringify(doc, null, 2));
} finally {
  await mongoose.disconnect();
}
