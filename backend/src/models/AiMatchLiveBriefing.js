import mongoose from 'mongoose';

const keyMomentSchema = new mongoose.Schema(
  {
    minute: { type: Number, default: null },
    text: { type: String, default: '' },
  },
  { _id: false }
);

const aiMatchLiveBriefingSchema = new mongoose.Schema(
  {
    matchExternalId: { type: String, required: true, unique: true, index: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', index: true },
    headline: { type: String, default: '' },
    summary: { type: String, default: '' },
    keyMoments: { type: [keyMomentSchema], default: [] },
    momentum: { type: String, enum: ['home', 'away', 'balanced', ''], default: '' },
    discipline: { type: String, default: '' },
    tacticalNote: { type: String, default: '' },
    whatToWatch: { type: String, default: '' },
    timelineHash: { type: String, default: '' },
    source: { type: String, default: '' },
    model: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const AiMatchLiveBriefing = mongoose.model('AiMatchLiveBriefing', aiMatchLiveBriefingSchema);
