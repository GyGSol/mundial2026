import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    homeTeamId: { type: String, required: true, index: true },
    awayTeamId: { type: String, required: true, index: true },
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    group: String,
    matchday: String,
    localDate: String,
    stadiumId: String,
    type: { type: String, default: 'group' },
    status: { type: String, enum: ['upcoming', 'live', 'finished'], default: 'upcoming' },
    kickoffAt: Date,
    lastSyncedAt: Date,
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Match = mongoose.model('Match', matchSchema);
