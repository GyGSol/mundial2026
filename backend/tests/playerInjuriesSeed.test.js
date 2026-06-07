import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

describe('playerInjuriesSeed', () => {
  it('tiene entradas con healthStatus e injuryInfo', async () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = await readFile(join(dir, '../src/data/playerInjuriesSeed.json'), 'utf8');
    const data = JSON.parse(raw);
    expect(data.entries.length).toBeGreaterThan(0);
    for (const entry of data.entries) {
      expect(['injured', 'doubt', 'available']).toContain(entry.healthStatus);
      expect(entry.injuryInfo).toBeTruthy();
    }
  });
});
