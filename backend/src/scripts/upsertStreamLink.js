/**
 * Uso: node src/scripts/upsertStreamLink.js <matchExternalId> <pageUrl> [eventId]
 * Ejemplo:
 *   node src/scripts/upsertStreamLink.js 7 "https://futbolparatodos.su/eventos.html?r=..." dsports
 *   node src/scripts/upsertStreamLink.js 7 "https://futbolparatodos.su/canal/dsports.html" dsports
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { upsertStreamLinkMapping } from '../services/streamLinkService.js';

const [matchExternalId, la18PageUrl, la18EventId = ''] = process.argv.slice(2);

if (!matchExternalId || !la18PageUrl) {
  console.error('Uso: node src/scripts/upsertStreamLink.js <matchExternalId> <pageUrl> [eventId]');
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
    'cli'
  );
  console.log('OK', doc.matchExternalId, doc.embedUrl);
} finally {
  await mongoose.disconnect();
}
