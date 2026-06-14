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
    /** IANA zone used to derive kickoffAt from localDate (stadium local time). */
    kickoffTimezone: String,
    /** Overlay operacional de clima (suspensión NOAA, demora pre-kickoff). Ver matchWeatherOpsRules.js */
    weatherOps: {
      phase: {
        type: String,
        enum: ['normal', 'pre_kickoff_delay', 'suspended', 'postponed'],
        default: 'normal',
      },
      reason: { type: String, enum: ['lightning', 'severe_weather', 'heat', 'other', null], default: null },
      protocol: { type: String, default: null },
      since: Date,
      resumeEarliestAt: Date,
      originalKickoffAt: Date,
      delayedKickoffAt: Date,
      lastAlertAt: Date,
      nwsAlertId: String,
      source: {
        type: String,
        enum: ['nws', 'msc', 'open-meteo', 'admin', 'sync', null],
        default: null,
      },
      overlapGroupKey: String,
    },
    lastSyncedAt: Date,
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

matchSchema.index({ status: 1, kickoffAt: 1 });
matchSchema.index({ group: 1, kickoffAt: 1 });

export const Match = mongoose.model('Match', matchSchema);
