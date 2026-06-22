import mongoose from 'mongoose';

const aiHumanUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scope: { type: String, enum: ['day', 'hour'], required: true },
    bucket: { type: String, required: true },
    insight: { type: Number, default: 0 },
    question: { type: Number, default: 0 },
    playerIntel: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aiHumanUsageSchema.index({ userId: 1, scope: 1, bucket: 1 }, { unique: true });
aiHumanUsageSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 45 });

export const AiHumanUsage =
  mongoose.models.AiHumanUsage ?? mongoose.model('AiHumanUsage', aiHumanUsageSchema);
