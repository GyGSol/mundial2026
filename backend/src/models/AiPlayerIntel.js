import mongoose from 'mongoose';

const aiPlayerIntelSchema = new mongoose.Schema(
  {
    playerExternalId: { type: String, required: true, unique: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', index: true },
    fullName: { type: String, required: true },
    fifaCode: { type: String, index: true },
    healthStatus: {
      type: String,
      enum: ['available', 'injured', 'doubt'],
      default: 'available',
    },
    injuryInfo: { type: String, default: '' },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
    suspended: { type: Boolean, default: false },
    suspensionInfo: { type: String, default: '' },
    isStarter: { type: Boolean, default: null },
    notes: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    source: { type: String, default: '' },
    model: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const AiPlayerIntel = mongoose.model('AiPlayerIntel', aiPlayerIntelSchema);
