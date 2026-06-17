/**
 * Quita idempotencyKey: null de fuboltransactions y recrea el índice único
 * con partialFilterExpression (varias tx sin clave ya no chocan).
 *
 * node backend/src/scripts/migrateFubolIdempotencyIndex.js
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';

async function main() {
  await connectDb();
  const col = mongoose.connection.collection('fuboltransactions');

  const unsetNull = await col.updateMany(
    { $or: [{ idempotencyKey: null }, { idempotencyKey: '' }] },
    { $unset: { idempotencyKey: '' } }
  );
  console.log(`Unset idempotencyKey en ${unsetNull.modifiedCount} documentos`);

  try {
    await col.dropIndex('idempotencyKey_1');
    console.log('Índice idempotencyKey_1 eliminado');
  } catch (err) {
    console.warn('dropIndex:', err.message);
  }

  await col.createIndex(
    { idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: {
        idempotencyKey: { $exists: true, $type: 'string' },
      },
    }
  );
  console.log('Índice idempotencyKey recreado (partial, solo strings)');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
