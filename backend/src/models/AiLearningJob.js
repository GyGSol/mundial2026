import mongoose from 'mongoose';

const aiLearningJobSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    steps: {
      type: [String],
      default: ['postMatchReview', 'shadowReplay'],
    },
    completedSteps: { type: [String], default: [] },
    nextRunAt: { type: Date, default: () => new Date(), index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

aiLearningJobSchema.index({ matchId: 1, status: 1 });

export const AiLearningJob =
  mongoose.models.AiLearningJob ?? mongoose.model('AiLearningJob', aiLearningJobSchema);
