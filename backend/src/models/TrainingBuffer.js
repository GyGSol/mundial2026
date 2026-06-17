import mongoose from 'mongoose';

const trainingBufferSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prediction', required: true },
    actualScoreKey: { type: String, required: true, index: true },
    predictedScore: {
      home: { type: Number, required: true },
      away: { type: Number, required: true },
    },
    actualScore: {
      home: { type: Number, required: true },
      away: { type: Number, required: true },
    },
    mseError: { type: Number, required: true },
    goalDiffCombined: { type: Number, default: null },
    promptContext: { type: mongoose.Schema.Types.Mixed, default: null },
    microEvents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    oracleMeta: {
      confidence_interval: { type: Number, default: null },
      error_reduction_factor: { type: Number, default: null },
      key_variable_impact: { type: String, default: null },
    },
    exportedAt: { type: Date, default: null },
    weekBucket: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

trainingBufferSchema.index({ matchId: 1, actualScoreKey: 1 }, { unique: true });

export const TrainingBuffer = mongoose.model('TrainingBuffer', trainingBufferSchema);
