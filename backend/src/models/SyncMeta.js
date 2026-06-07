import mongoose from 'mongoose';

const syncMetaSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    lastSyncAt: Date,
    lastSyncError: String,
    playerCount: Number,
    fdMapped: Number,
    fdPlayers: Number,
    seedPlayers: Number,
    injuriesMerged: Number,
  },
  { timestamps: true, strict: false }
);

export const SyncMeta = mongoose.model('SyncMeta', syncMetaSchema);
