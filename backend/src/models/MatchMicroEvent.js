import mongoose from 'mongoose';

const matchMicroEventSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    minute: { type: Number, default: null },
    extraMinute: { type: Number, default: null },
    type: { type: String, required: true, index: true },
    teamId: { type: String, default: null },
    playerName: { type: String, default: null },
    scorer: { type: Boolean, default: false },
    side: { type: String, enum: ['home', 'away', null], default: null },
    source: { type: String, default: 'sync' },
    eventKey: { type: String, required: true },
  },
  { timestamps: true }
);

matchMicroEventSchema.index({ matchId: 1, eventKey: 1 }, { unique: true });

export const MatchMicroEvent = mongoose.model('MatchMicroEvent', matchMicroEventSchema);
