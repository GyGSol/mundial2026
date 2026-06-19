import mongoose from 'mongoose';

const recentMatchSchema = new mongoose.Schema(
  {
    date: String,
    opponent: String,
    result: String,
    minutes: Number,
    goals: Number,
    assists: Number,
    yellowCards: Number,
    redCards: Number,
    started: Boolean,
    scope: { type: String, enum: ['club', 'national', 'unknown'], default: 'unknown' },
    competition: String,
  },
  { _id: false }
);

const performanceTotalsSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    starts: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
  },
  { _id: false }
);

const performanceSnapshotSchema = new mongoose.Schema(
  {
    seasonYear: Number,
    fetchedAt: Date,
    source: { type: String, default: '' },
    club: { type: performanceTotalsSchema, default: () => ({}) },
    nationalTeam: { type: performanceTotalsSchema, default: () => ({}) },
    recentMatches: { type: [recentMatchSchema], default: [] },
  },
  { _id: false }
);

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const HEALTH_STATUSES = ['available', 'injured', 'doubt'];
const LINEUP_STATUSES = [null, 'starter', 'bench'];

const playerSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    footballDataPersonId: { type: Number, sparse: true, index: true },
    fullName: { type: String, required: true, index: true },
    teamExternalId: { type: String, required: true, index: true },
    fifaCode: { type: String, index: true },
    position: { type: String, enum: POSITIONS, required: true },
    currentClub: { type: String, default: '' },
    clubCountry: { type: String, default: '' },
    clubCrestUrl: { type: String, default: '' },
    footballDataClubId: { type: Number, sparse: true },
    leagueName: { type: String, default: '' },
    leagueEmblemUrl: { type: String, default: '' },
    /** Ruta relativa en imagenes-jugadores/, ej. argentina/arg-lionel-messi.png */
    photoKey: { type: String, default: '' },
    age: { type: Number },
    shirtNumber: { type: Number },
    isCaptain: { type: Boolean, default: false },
    nationality: { type: String, default: '' },
    healthStatus: {
      type: String,
      enum: HEALTH_STATUSES,
      default: 'available',
    },
    injuryInfo: { type: String, default: '' },
    lineupStatus: {
      type: String,
      enum: LINEUP_STATUSES.filter(Boolean),
      default: undefined,
    },
    recentMatches: { type: [recentMatchSchema], default: [] },
    performanceSnapshot: { type: performanceSnapshotSchema, default: null },
    dataSources: {
      structural: { type: String, default: 'seed' },
      injuries: { type: String, default: '' },
    },
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

playerSchema.index({ teamExternalId: 1, position: 1 });
playerSchema.index({ fullName: 'text' });

export const Player = mongoose.model('Player', playerSchema);
export { POSITIONS, HEALTH_STATUSES, LINEUP_STATUSES, recentMatchSchema, performanceSnapshotSchema };
