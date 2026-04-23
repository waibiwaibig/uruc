import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearRememberedLaunchMode,
  getRememberedLaunchMode,
  getSavedLinkedVenueIds,
  rememberLaunchMode,
  setSavedLinkedVenueIds,
} from '../storage';

function createStorageMock() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createStorageMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage helpers', () => {
  it('reads linked venues from the legacy pinned destination key', () => {
    localStorage.setItem('uruc_web_pinned_destinations', JSON.stringify(['venue.social', 'venue.market']));

    expect(getSavedLinkedVenueIds()).toEqual(['venue.social', 'venue.market']);
  });

  it('stores linked venues under the dedicated linked key', () => {
    setSavedLinkedVenueIds(['venue.social']);

    expect(localStorage.getItem('uruc_web_linked_venues')).toBe(JSON.stringify(['venue.social']));
  });

  it('remembers launch mode only for the same local day', () => {
    rememberLaunchMode('venue.social', 'new-tab', new Date('2026-04-23T10:00:00'));

    expect(getRememberedLaunchMode('venue.social', new Date('2026-04-23T22:30:00'))).toBe('new-tab');
    expect(getRememberedLaunchMode('venue.social', new Date('2026-04-24T00:01:00'))).toBeNull();
  });

  it('clears a remembered launch mode explicitly', () => {
    rememberLaunchMode('venue.social', 'same-tab', new Date('2026-04-23T10:00:00'));
    clearRememberedLaunchMode('venue.social', new Date('2026-04-23T10:00:00'));

    expect(getRememberedLaunchMode('venue.social', new Date('2026-04-23T12:00:00'))).toBeNull();
  });
});
