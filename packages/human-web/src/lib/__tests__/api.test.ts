import { afterEach, describe, expect, it, vi } from 'vitest';

import { PublicApi } from '../api';

describe('PublicApi.health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bypasses browser caches when reading plugin health', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', plugins: [] }),
    } as Response);

    await PublicApi.health();

    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({
      cache: 'no-store',
    }));
  });
});
