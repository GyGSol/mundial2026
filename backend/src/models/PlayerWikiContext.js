import mongoose from 'mongoose';

const worldCupAppearanceSchema = new mongoose.Schema(
  {
    year: Number,
    notes: String,
  },
  { _id: false }
);

const internationalMatchSchema = new mongoose.Schema(
  {
    date: String,
    opponent: String,
    score: String,
    result: String,
    competition: String,
    goals: Number,
  },
  { _id: false }
);

const playerWikiContextSchema = new mongoose.Schema(
  {
    playerExternalId: { type: String, required: true, unique: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', index: true },
    fullName: { type: String, required: true },
    fifaCode: { type: String, index: true },
    wikiTitle: { type: String, default: '' },
    wikiUrl: { type: String, default: '' },
    summary: { type: String, default: '' },
    internationalCaps: { type: Number },
    internationalGoals: { type: Number },
    internationalYears: { type: String, default: '' },
    worldCupAppearances: { type: [worldCupAppearanceSchema], default: [] },
    internationalMatches: { type: [internationalMatchSchema], default: [] },
    squadCallups: { type: [String], default: [] },
    careerHighlights: { type: [String], default: [] },
    internationalSection: { type: String, default: '' },
    worldCupSection: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now, index: true },
    source: { type: String, default: 'wikipedia' },
  },
  { timestamps: true }
);

export const PlayerWikiContext = mongoose.model('PlayerWikiContext', playerWikiContextSchema);
