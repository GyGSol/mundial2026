import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInMemoryCache, CACHE_TTL_UNTIL_INVALIDATE } from '../src/services/inMemoryCache.js';

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

  it('keeps value until explicit invalidate when TTL is infinite', async () => {
    const cache = createInMemoryCache({ defaultTtlMs: CACHE_TTL_UNTIL_INVALIDATE });
    const compute = vi.fn(async () => ({ ok: true }));

    const first = await cache.getOrCompute('key', compute);
    vi.advanceTimersByTime(60 * 60 * 1000);
    const second = await cache.getOrCompute('key', compute);

    expect(first).toBe(second);
    expect(compute).toHaveBeenCalledTimes(1);

    cache.invalidate('key');
    await cache.getOrCompute('key', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
