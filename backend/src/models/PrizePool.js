import mongoose from 'mongoose';
import { DEFAULT_PRIZE_SPLITS } from '../config/economy.js';

const prizePoolSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      required: true,
      unique: true,
      index: true,
    },
    totalFubols: { type: Number, default: 0, min: 0 },
    distributionPercents: {
      type: [Number],
      default: () => [...DEFAULT_PRIZE_SPLITS],
    },
    status: { type: String, enum: ['open', 'settled'], default: 'open' },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PrizePool = mongoose.model('PrizePool', prizePoolSchema);
