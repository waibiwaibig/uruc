import { describe, expect, it } from 'vitest';

import { reconcilePersistedDestinationIds } from '../destination-persistence';

describe('destination persistence reconciliation', () => {
  it('keeps saved linked venues until plugin and health data finish loading', () => {
    const savedIds = ['route:uruc.social:hub'];

    expect(
      reconcilePersistedDestinationIds(savedIds, new Set<string>(), false),
    ).toBe(savedIds);
  });

  it('drops saved ids that are no longer available after the destination registry is ready', () => {
    expect(
      reconcilePersistedDestinationIds(
        ['route:uruc.social:hub', 'route:unknown:gone'],
        new Set(['route:uruc.social:hub']),
        true,
      ),
    ).toEqual(['route:uruc.social:hub']);
  });
});
