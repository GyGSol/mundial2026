import mongoose from 'mongoose';

const eliminatedEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    eliminatedAt: { type: Date, default: Date.now },
    rankInMatch: { type: Number, required: true },
  },
  { _id: false }
);

const eliminationTournamentSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompetitionGroup',
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'running', 'completed'],
      default: 'open',
    },
    activatedAt: { type: Date, default: Date.now },
    activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    championId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    activePlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    eliminated: [eliminatedEntrySchema],
    processedMatchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    prizePaidAt: { type: Date, default: null },
    eliminationPoolFubols: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const EliminationTournament = mongoose.model(
  'EliminationTournament',
  eliminationTournamentSchema
);
