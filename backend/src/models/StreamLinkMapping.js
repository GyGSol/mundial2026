import mongoose from 'mongoose';

const streamLinkMappingSchema = new mongoose.Schema(
  {
    matchExternalId: { type: String, required: true, unique: true, index: true },
    la18EventId: { type: String, default: '' },
    la18PageUrl: { type: String, required: true },
    embedUrl: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const StreamLinkMapping = mongoose.model('StreamLinkMapping', streamLinkMappingSchema);
