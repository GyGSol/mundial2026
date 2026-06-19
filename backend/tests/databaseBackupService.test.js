import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { buildFullDatabaseBackup } from '../src/services/databaseBackupService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

describe('databaseBackupService', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({ email: 'backup-test@example.com' });
  });

  it('exports all collections including users with passwordHash', async () => {
    await User.create({
      name: 'Backup Test',
      email: 'backup-test@example.com',
      passwordHash: 'secret-hash',
      totalPoints: 0,
    });

    const result = await buildFullDatabaseBackup();
    expect(result.stats.documents).toBeGreaterThan(0);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0].path).toContain('full-database.json.gz');

    const gzipFile = result.files.find((f) => f.path.endsWith('full-database.json.gz'));
    const { gunzipSync } = await import('zlib');
    const payload = JSON.parse(gunzipSync(gzipFile.content).toString('utf8'));
    expect(payload.type).toBe('full_database');
    expect(payload.collections.users?.length).toBeGreaterThan(0);
    const user = payload.collections.users.find((u) => u.email === 'backup-test@example.com');
    expect(user.passwordHash).toBe('secret-hash');
  });
});
