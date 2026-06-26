import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInMemoryCache } from '../src/services/inMemoryCache.js';

describe('createInMemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('evicts oldest entries when maxEntries is exceeded', async () => {
    const cache = createInMemoryCache({ defaultTtlMs: 60_000, maxEntries: 2 });
    const compute = vi.fn(async (value) => value);

    await cache.getOrCompute('a', () => compute('a'));
    await cache.getOrCompute('b', () => compute('b'));
    await cache.getOrCompute('c', () => compute('c'));

    expect(compute).toHaveBeenCalledTimes(3);

    await cache.getOrCompute('a', () => compute('a-reload'));
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it('reuses value within TTL', async () => {
    const cache = createInMemoryCache({ defaultTtlMs: 10_000 });
    const compute = vi.fn(async () => ({ ok: true }));

    const first = await cache.getOrCompute('key', compute);
    const second = await cache.getOrCompute('key', compute);

    expect(first).toBe(second);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
