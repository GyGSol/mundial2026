import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    homeGoals: { type: Number, required: true, min: 0 },
    awayGoals: { type: Number, required: true, min: 0 },
    userSubmitted: { type: Boolean, default: false },
    pointsEarned: { type: Number, default: null },
    bonusPoint: { type: Number, default: 0 },
    bonusReason: { type: String, default: null },
    pointsBreakdown: {
      winner: Number,
      homeGoals: Number,
      awayGoals: Number,
      totalGoals: Number,
    },
    predictionSource: { type: String, enum: ['user', 'ai', 'admin', 'default'], default: 'user' },
    aiModel: { type: String, default: null },
    aiReasoning: { type: String, default: null },
  },
  { timestamps: true }
);

predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });

export const Prediction = mongoose.model('Prediction', predictionSchema);
