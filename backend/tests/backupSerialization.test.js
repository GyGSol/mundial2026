import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  serializeDocument,
  deserializeDocument,
} from '../src/services/backupSerialization.js';

describe('backupSerialization', () => {
  it('round-trips ObjectId and Date', () => {
    const original = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date('2026-06-19T12:00:00.000Z'),
      nested: { userId: new mongoose.Types.ObjectId() },
    };
    const serialized = serializeDocument(original);
    expect(serialized._id).toEqual({ $oid: original._id.toString() });
    const restored = deserializeDocument(serialized);
    expect(restored._id.equals(original._id)).toBe(true);
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    expect(restored.nested.userId.equals(original.nested.userId)).toBe(true);
  });
});
