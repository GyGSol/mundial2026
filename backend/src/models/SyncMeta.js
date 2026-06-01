import mongoose from 'mongoose';

const syncMetaSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    lastSyncAt: Date,
    lastSyncError: String,
  },
  { timestamps: true }
);

export const SyncMeta = mongoose.model('SyncMeta', syncMetaSchema);
