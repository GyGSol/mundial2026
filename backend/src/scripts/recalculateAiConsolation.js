/**
 * Recalcula PB y totales solo del jugador IA (isAiUser). No toca predicciones humanas.
 * Uso prod: heroku run "npm run rescore:ai-pb -w backend" -a mundial2026-pred
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Prediction } from '../models/Prediction.js';
import { getAiUser } from '../services/aiUserService.js';
import { recalculateConsolationBonuses } from '../services/consolationBonusService.js';
import { recalculateUserTotalPoints } from '../services/leaderboardService.js';
import { invalidateMatchRelatedCaches } from '../services/matchRelatedCaches.js';
import { notifyLeaderboardUpdated } from '../services/websocketService.js';

dotenv.config();

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI requerido');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const aiUser = await getAiUser();
  if (!aiUser) {
    throw new Error('Jugador IA no encontrado (isAiUser)');
  }

  await recalculateConsolationBonuses(aiUser._id);
  const totalPoints = await recalculateUserTotalPoints(aiUser._id);

  const pbRows = await Prediction.aggregate([
    { $match: { userId: aiUser._id, pointsEarned: { $ne: null } } },
    { $group: { _id: null, pb: { $sum: { $ifNull: ['$bonusPoint', 0] } } } },
  ]);
  const pb = pbRows[0]?.pb ?? 0;

  invalidateMatchRelatedCaches();
  notifyLeaderboardUpdated({ reason: 'ai_pb_recalculated' });

  console.log('Recálculo PB jugador IA:', {
    userId: aiUser._id.toString(),
    name: aiUser.name,
    pb,
    totalPoints,
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
