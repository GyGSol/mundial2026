import mongoose from 'mongoose';

const aiCompetitorPredictionLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction', default: null },
    homeGoals: { type: Number, required: true, min: 0 },
    awayGoals: { type: Number, required: true, min: 0 },
    aiModel: { type: String, default: null },
    aiSource: { type: String, default: null },
    calibrationApplied: { type: Boolean, default: false },
    promptContext: { type: mongoose.Schema.Types.Mixed, default: null },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    finalResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    adminNotes: { type: String, default: '' },
    isSimulation: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

aiCompetitorPredictionLogSchema.index({ matchId: 1, createdAt: -1 });
aiCompetitorPredictionLogSchema.index({ createdAt: -1 });

export const AiCompetitorPredictionLog = mongoose.model(
  'AiCompetitorPredictionLog',
  aiCompetitorPredictionLogSchema
);
