import mongoose from 'mongoose';

const simulationStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'active' },
    runId: { type: String, required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompetitionGroup', required: true },
    matchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    liveMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },
    finishedCount: { type: Number, default: 0 },
    matchCount: { type: Number, default: 0 },
    playerCount: { type: Number, default: 10 },
    mode: { type: String, enum: ['quick', 'full'], default: 'quick' },
    phase: { type: String, enum: ['group', 'knockout', 'completed'], default: 'group' },
    currentKnockoutRound: { type: String, default: null },
    groupMatchCount: { type: Number, default: 0 },
    pendingCrossovers: { type: mongoose.Schema.Types.Mixed, default: null },
    groupsUsed: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export const SimulationState = mongoose.model('SimulationState', simulationStateSchema);
