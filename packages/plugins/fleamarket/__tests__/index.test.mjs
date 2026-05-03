import { describe, expect, it } from 'vitest';
import plugin from '../index.mjs';

function createSetupCtx() {
  const commands = [];
  const routes = [];
  const locations = [];
  return {
    registeredCommands: commands,
    registeredRoutes: routes,
    registeredLocations: locations,
    storage: {
      async get() { return null; },
      async put() {},
      async delete() {},
      async list() { return []; },
    },
    messaging: {
      sendToAgent() {},
    },
    lifecycle: {
      onStop() {},
    },
    config: {
      async get() { return {}; },
    },
    logging: {
      async info() {},
      async warn() {},
      async error() {},
    },
    diagnostics: {
      async report() {},
    },
    events: {
      async subscribe() {},
    },
    http: {
      async registerRoute(route) {
        routes.push(route);
      },
    },
    locations: {
      async register(location) {
        locations.push(location);
      },
    },
    commands: {
      async register(command) {
        commands.push(command);
      },
    },
  };
}

describe('fleamarket backend entry', () => {
  it('registers the market location, status route, and complete agent command surface', async () => {
    const ctx = createSetupCtx();
    await plugin.setup(ctx);

    expect(plugin).toMatchObject({
      kind: 'uruc.backend-plugin@v2',
      pluginId: 'uruc.fleamarket',
      apiVersion: 2,
    });
    expect(ctx.registeredLocations).toContainEqual(expect.objectContaining({
      id: 'market-hall',
      name: 'Fleamarket Hall',
    }));
    expect(ctx.registeredRoutes).toContainEqual(expect.objectContaining({
      routeId: 'status',
      method: 'GET',
      path: '/status',
      authPolicy: 'public',
    }));
    expect(ctx.registeredRoutes).toContainEqual(expect.objectContaining({
      routeId: 'upload-listing-asset',
      method: 'POST',
      path: '/assets/listings',
      authPolicy: 'user',
    }));
    expect(ctx.registeredRoutes).toContainEqual(expect.objectContaining({
      routeId: 'read-asset',
      method: 'GET',
      path: '/assets/:assetId',
      authPolicy: 'user',
    }));

    expect(ctx.registeredCommands.map((command) => command.id).sort()).toEqual([
      'accept_trade',
      'cancel_trade',
      'close_listing',
      'confirm_trade_success',
      'create_listing',
      'create_report',
      'create_review',
      'decline_trade',
      'fleamarket_intro',
      'get_listing',
      'get_reputation_profile',
      'get_trade',
      'get_trade_messages',
      'list_my_listings',
      'list_my_reports',
      'list_my_trades',
      'list_reviews',
      'open_trade',
      'pause_listing',
      'publish_listing',
      'search_listings',
      'send_trade_message',
      'update_listing',
    ].sort());
  });

  it('uses useful descriptions, schemas, and read/write action lease policies', async () => {
    const ctx = createSetupCtx();
    await plugin.setup(ctx);

    const readCommands = new Set([
      'fleamarket_intro',
      'search_listings',
      'get_listing',
      'list_my_listings',
      'list_my_trades',
      'get_trade',
      'get_trade_messages',
      'get_reputation_profile',
      'list_reviews',
      'list_my_reports',
    ]);

    for (const command of ctx.registeredCommands) {
      expect(command.description).toEqual(expect.any(String));
      expect(command.description.length).toBeGreaterThan(20);
      expect(command.inputSchema).toEqual(expect.any(Object));
      expect(command.locationPolicy).toEqual({ scope: 'any' });
      if (readCommands.has(command.id)) {
        expect(command.actionLeasePolicy).toEqual({ required: false });
      } else {
        expect(command.actionLeasePolicy?.required ?? true).toBe(true);
      }
    }

    const intro = ctx.registeredCommands.find((command) => command.id === 'fleamarket_intro');
    const introResult = await intro.handler();
    expect(introResult).toMatchObject({
      pluginId: 'uruc.fleamarket',
      firstCommands: expect.arrayContaining([
        'uruc.fleamarket.search_listings@v1',
        'uruc.fleamarket.create_listing@v1',
      ]),
    });
  });
});
