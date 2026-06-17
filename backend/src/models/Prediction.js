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
    goalDiffHome: { type: Number, default: null },
    goalDiffAway: { type: Number, default: null },
    /** Snapshot al arranque en vivo (0-0) para deltas de ranking en vivo. */
    liveKickoffPointsEarned: { type: Number, default: null },
    liveKickoffBreakdown: {
      winner: Number,
      homeGoals: Number,
      awayGoals: Number,
      totalGoals: Number,
    },
    liveKickoffGoalDiffHome: { type: Number, default: null },
    liveKickoffGoalDiffAway: { type: Number, default: null },
    predictionSource: { type: String, enum: ['user', 'ai', 'admin', 'default'], default: 'user' },
    aiModel: { type: String, default: null },
    aiReasoning: { type: String, default: null },
    aiCalibrationApplied: { type: Boolean, default: false },
    aiPostMatchReview: {
      analysis: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      aiSource: { type: String, default: null },
      resultScoreKey: { type: String, default: null },
      calibrationHint: {
        biasHome: { type: Number, default: null },
        biasAway: { type: Number, default: null },
        observedBiasHome: { type: Number, default: null },
        observedBiasAway: { type: Number, default: null },
        summary: { type: String, default: null },
        generatedAt: { type: Date, default: null },
      },
      humanConsensusAtReview: {
        muestras: { type: Number, default: null },
        mediana: {
          local: { type: Number, default: null },
          visitante: { type: Number, default: null },
        },
        resultadoFrecuente: { type: String, default: null },
      },
    },
  },
  { timestamps: true }
);

predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });

export const Prediction = mongoose.model('Prediction', predictionSchema);
