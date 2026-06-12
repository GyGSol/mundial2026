import mongoose from 'mongoose';

const keyNumberSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const recordSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const phaseSummarySchema = new mongoose.Schema(
  {
    phase: { type: String, default: '' },
    summary: { type: String, default: '' },
  },
  { _id: false }
);

const aiWorldCupStatsBriefingSchema = new mongoose.Schema(
  {
    briefingKey: { type: String, required: true, unique: true, default: 'worldcup2026' },
    overview: { type: String, default: '' },
    newsDigest: { type: String, default: '' },
    keyNumbers: { type: [keyNumberSchema], default: [] },
    records: { type: [recordSchema], default: [] },
    trivia: { type: [String], default: [] },
    phaseSummaries: { type: [phaseSummarySchema], default: [] },
    hostFacts: { type: [String], default: [] },
    source: { type: String, default: '' },
    model: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const AiWorldCupStatsBriefing = mongoose.model(
  'AiWorldCupStatsBriefing',
  aiWorldCupStatsBriefingSchema
);
