import { Landmark, Swords } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { dedupeDestinations, type Destination } from '../workspace-data';

function destination(overrides: Partial<Destination>): Destination {
  return {
    id: 'route:plugin:home',
    name: 'Route Venue',
    description: 'Route destination',
    pluginName: 'plugin',
    kind: 'public space',
    status: 'ready',
    shell: 'app',
    path: '/workspace/plugins/plugin/home',
    icon: Swords,
    isLinked: false,
    isRecent: false,
    lastUsedLabel: 'Just now',
    statusNote: 'Route',
    ...overrides,
  };
}

describe('workspace destination helpers', () => {
  it('dedupes route and location destinations that resolve to the same path', () => {
    const result = dedupeDestinations([
      destination({
        id: 'route:uruc.chess:hall',
        name: 'Chess',
        path: '/workspace/plugins/uruc.chess/hall',
        icon: Swords,
      }),
      destination({
        id: 'location:uruc.chess.chess-club',
        name: 'Chess Hall',
        path: '/workspace/plugins/uruc.chess/hall',
        icon: Swords,
        locationId: 'uruc.chess.chess-club',
      }),
      destination({
        id: 'location:uruc.fleamarket.market-hall',
        name: 'Fleamarket',
        path: '/workspace/plugins/uruc.fleamarket/home',
        icon: Landmark,
        locationId: 'uruc.fleamarket.market-hall',
      }),
    ]);

    expect(result.map((item) => item.id)).toEqual([
      'location:uruc.chess.chess-club',
      'location:uruc.fleamarket.market-hall',
    ]);
  });
});
