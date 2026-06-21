import { describe, expect, it } from 'vitest';
import {
  assertSafeRestoreTarget,
  assertSafeTestDatabase,
  isProductionMongoUri,
  parseDatabaseName,
} from '../src/config/testDbGuard.js';

describe('testDbGuard', () => {
  it('parseDatabaseName extracts db name from URI', () => {
    expect(parseDatabaseName('mongodb://127.0.0.1:27017/mundial2026_local')).toBe('mundial2026_local');
  });

  it('isProductionMongoUri detects Atlas', () => {
    expect(isProductionMongoUri('mongodb+srv://x@mundial2026.elalzc2.mongodb.net/mundial2026')).toBe(true);
    expect(isProductionMongoUri('mongodb://127.0.0.1:27017/mundial2026_local')).toBe(false);
  });

  it('assertSafeRestoreTarget allows localhost QA db', () => {
    expect(assertSafeRestoreTarget('mongodb://127.0.0.1:27017/mundial2026_local')).toContain('mundial2026_local');
  });

  it('assertSafeRestoreTarget blocks Atlas', () => {
    expect(() =>
      assertSafeRestoreTarget('mongodb+srv://x@mundial2026.elalzc2.mongodb.net/mundial2026')
    ).toThrow(/REFUSING restore/);
  });

  it('assertSafeTestDatabase blocks production URI', () => {
    expect(() => assertSafeTestDatabase('mongodb+srv://x@mundial2026.elalzc2.mongodb.net/mundial2026')).toThrow(
      /REFUSING/
    );
  });

  it('assertSafeTestDatabase blocks QA clone database', () => {
    expect(() => assertSafeTestDatabase('mongodb://127.0.0.1:27017/mundial2026_local')).toThrow(
      /mundial2026_local/
    );
  });

  it('assertSafeTestDatabase blocks dev database', () => {
    expect(() => assertSafeTestDatabase('mongodb://127.0.0.1:27017/mundial2026')).toThrow(/mundial2026/);
  });
});
