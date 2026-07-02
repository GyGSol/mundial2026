import mongoose from 'mongoose';

const matchResultSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
    externalId: { type: String, default: null },
    pointsA: { type: Number, default: 0 },
    pointsB: { type: Number, default: 0 },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    margin: { type: Number, default: 0 },
  },
  { _id: false }
);

const duelSchema = new mongoose.Schema(
  {
    duelId: { type: String, required: true },
    duelIndex: { type: Number, required: true },
    playerAId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    playerBId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    playerAName: { type: String, default: null },
    playerBName: { type: String, default: null },
    seedA: { type: Number, default: null },
    seedB: { type: Number, default: null },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    worldCupExternalIds: [{ type: String }],
    matchResults: [matchResultSchema],
    resolvedAt: { type: Date, default: null },
    advancePaidAt: { type: Date, default: null },
  },
  { _id: false }
);

const roundSchema = new mongoose.Schema(
  {
    roundKey: { type: String, required: true },
    label: { type: String, required: true },
    worldCupExternalIds: [{ type: String }],
    duels: [duelSchema],
  },
  { _id: false }
);

const seedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seedRank: { type: Number, required: true },
    tournamentPointsAtSeed: { type: Number, default: 0 },
  },
  { _id: false }
);

const fubolsCupTournamentSchema = new mongoose.Schema(
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
      enum: ['preview', 'seeded', 'running', 'completed', 'cancelled'],
      default: 'preview',
    },
    matchShuffleSeed: { type: String, default: null },
    seededAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    championId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seeds: [seedSchema],
    rounds: [roundSchema],
    championPrizePaidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const FubolsCupTournament = mongoose.model('FubolsCupTournament', fubolsCupTournamentSchema);
