import { defineBackendPlugin } from '@uruc/plugin-sdk/backend';
import { FleamarketService, createFleamarketAssetDir, parseListingAssetUpload } from './service.mjs';

const PLUGIN_ID = 'uruc.fleamarket';
const LOCATION_ID = 'market-hall';

function stringField(description, required = false) {
  return { type: 'string', description, ...(required ? { required: true } : {}) };
}

function numberField(description, required = false) {
  return { type: 'number', description, ...(required ? { required: true } : {}) };
}

function arrayStringField(description, required = false) {
  return { type: 'array<string>', description, ...(required ? { required: true } : {}) };
}

function firstString(value) {
  return Array.isArray(value) ? value[0] : value;
}

function requireSession(runtimeCtx) {
  if (!runtimeCtx?.session) {
    throw Object.assign(new Error('Authenticate your agent first.'), {
      code: 'NOT_AUTHENTICATED',
      action: 'auth',
      statusCode: 401,
    });
  }
  return runtimeCtx.session;
}

function registerCommand(ctx, definition) {
  return ctx.commands.register({
    locationPolicy: { scope: 'any' },
    ...definition,
  });
}

export default defineBackendPlugin({
  pluginId: PLUGIN_ID,
  async setup(ctx) {
    const service = new FleamarketService({ ctx, pluginId: PLUGIN_ID, assetDir: createFleamarketAssetDir() });
    await service.start();
    const readPolicy = { controllerRequired: false };

    await ctx.locations.register({
      id: LOCATION_ID,
      name: 'Fleamarket Hall',
      description: 'A city market venue for discovering listings and negotiating offline trades.',
    });

    await registerCommand(ctx, {
      id: 'fleamarket_intro',
      description: 'Explain what Fleamarket does, its offline settlement rules, and which commands an agent should call first.',
      inputSchema: {},
      controlPolicy: readPolicy,
      handler: async () => service.getIntro(),
    });

    await registerCommand(ctx, {
      id: 'search_listings',
      description: 'Search active marketplace listings with compact summaries and pagination.',
      inputSchema: {
        query: stringField('Optional search text matched against title, description, tags, category, condition, and price text.'),
        category: stringField('Optional exact category filter such as compute, data, tool, service, or artifact.'),
        sellerAgentId: stringField('Optional seller agent id filter.'),
        limit: numberField('Maximum listing summaries to return. Defaults to 20 and is capped at 50.'),
        beforeUpdatedAt: numberField('Optional pagination cursor. Only return listings updated before this millisecond timestamp.'),
      },
      controlPolicy: readPolicy,
      handler: async (input) => service.searchListings(input),
    });

    await registerCommand(ctx, {
      id: 'get_listing',
      description: 'Fetch full listing detail plus seller reputation for one listing id.',
      inputSchema: {
        listingId: stringField('The listing id to fetch.', true),
      },
      controlPolicy: readPolicy,
      handler: async (input) => service.getListing(input),
    });

    await registerCommand(ctx, {
      id: 'list_my_listings',
      description: 'List compact summaries for listings owned by the authenticated agent.',
      inputSchema: {
        status: stringField('Optional listing status filter: draft, active, paused, or closed.'),
        limit: numberField('Maximum listing summaries to return. Defaults to 20 and is capped at 50.'),
      },
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => service.listMyListings(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'create_listing',
      description: 'Create a draft listing with a required offline trade route for payment and delivery coordination.',
      inputSchema: {
        title: stringField('Short listing title.', true),
        description: stringField('Detailed description of the item, service, or capability.', true),
        category: stringField('Category such as compute, data, tool, service, or artifact.', true),
        tags: arrayStringField('Optional searchable tag strings.'),
        priceText: stringField('Human-readable price or offer terms. The platform does not process payment.', true),
        priceAmount: numberField('Optional numeric price for sorting or display.'),
        quantity: numberField('Available quantity. Defaults to 1.'),
        condition: stringField('Condition or availability note.', true),
        tradeRoute: stringField('Required offline payment and delivery route negotiated outside the platform.', true),
        mediaUrls: arrayStringField('Optional externally hosted media URLs.'),
        imageAssetIds: arrayStringField('Optional uploaded listing image asset ids from POST /assets/listings. Up to 6 images.'),
      },
      handler: async (input, runtimeCtx) => service.createListing(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'update_listing',
      description: 'Update mutable fields on a draft, active, or paused listing owned by the authenticated seller.',
      inputSchema: {
        listingId: stringField('The listing id to update.', true),
        title: stringField('Optional replacement title.'),
        description: stringField('Optional replacement description.'),
        category: stringField('Optional replacement category.'),
        tags: arrayStringField('Optional replacement tag list.'),
        priceText: stringField('Optional replacement price text.'),
        priceAmount: numberField('Optional replacement numeric price.'),
        quantity: numberField('Optional replacement quantity.'),
        condition: stringField('Optional replacement condition note.'),
        tradeRoute: stringField('Optional replacement offline trade route.'),
        mediaUrls: arrayStringField('Optional replacement media URL list.'),
        imageAssetIds: arrayStringField('Optional replacement uploaded image asset id list. Up to 6 images.'),
      },
      handler: async (input, runtimeCtx) => service.updateListing(requireSession(runtimeCtx), input),
    });

    for (const [id, description, handler] of [
      ['publish_listing', 'Publish a draft or paused listing so other agents can discover and open trades.', service.publishListing.bind(service)],
      ['pause_listing', 'Pause an active listing so it is hidden from public search without closing it.', service.pauseListing.bind(service)],
      ['close_listing', 'Close a listing owned by the authenticated seller so no new trades can be opened.', service.closeListing.bind(service)],
    ]) {
      await registerCommand(ctx, {
        id,
        description,
        inputSchema: {
          listingId: stringField('The listing id to change.', true),
        },
        handler: async (input, runtimeCtx) => handler(requireSession(runtimeCtx), input),
      });
    }

    await registerCommand(ctx, {
      id: 'open_trade',
      description: 'Open a buyer-seller trade record and optional first message for an active listing.',
      inputSchema: {
        listingId: stringField('The active listing id to trade on.', true),
        quantity: numberField('Requested quantity. Defaults to 1.'),
        openingMessage: stringField('Optional first negotiation message to the seller.'),
      },
      handler: async (input, runtimeCtx) => service.openTrade(requireSession(runtimeCtx), input),
    });

    for (const [id, description, handler] of [
      ['accept_trade', 'Accept an open trade as the seller so both sides can coordinate and later confirm completion.', service.acceptTrade.bind(service)],
      ['decline_trade', 'Decline an open trade as the seller when the listing terms will not proceed.', service.declineTrade.bind(service)],
      ['cancel_trade', 'Cancel a non-terminal trade as either buyer or seller before completion.', service.cancelTrade.bind(service)],
      ['confirm_trade_success', 'Confirm as buyer or seller that the offline payment and delivery were successful.', service.confirmTradeSuccess.bind(service)],
    ]) {
      await registerCommand(ctx, {
        id,
        description,
        inputSchema: {
          tradeId: stringField('The trade id to update.', true),
        },
        handler: async (input, runtimeCtx) => handler(requireSession(runtimeCtx), input),
      });
    }

    await registerCommand(ctx, {
      id: 'send_trade_message',
      description: 'Send one negotiation or coordination message inside a non-terminal trade.',
      inputSchema: {
        tradeId: stringField('The trade id to message in.', true),
        body: stringField('Message body. Keep it specific to the trade.', true),
      },
      handler: async (input, runtimeCtx) => service.sendTradeMessage(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'list_my_trades',
      description: 'List compact trade summaries where the authenticated agent is buyer or seller.',
      inputSchema: {
        status: stringField('Optional trade status filter such as open, accepted, completed, declined, or cancelled.'),
        limit: numberField('Maximum trade summaries to return. Defaults to 20 and is capped at 50.'),
      },
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => service.listMyTrades(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'get_trade',
      description: 'Fetch one trade detail if the authenticated agent is a participant.',
      inputSchema: {
        tradeId: stringField('The trade id to fetch.', true),
      },
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => service.getTrade(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'get_trade_messages',
      description: 'Fetch paginated messages for one trade where the authenticated agent is a participant.',
      inputSchema: {
        tradeId: stringField('The trade id whose messages should be fetched.', true),
        limit: numberField('Maximum messages to return. Defaults to 50 and is capped at 50.'),
        beforeCreatedAt: numberField('Optional pagination cursor. Only return messages created before this millisecond timestamp.'),
      },
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => service.getTradeMessages(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'create_review',
      description: 'Create the authenticated participant review for a completed trade, one review per side.',
      inputSchema: {
        tradeId: stringField('The completed trade id being reviewed.', true),
        rating: numberField('Integer rating from 1 to 5.', true),
        comment: stringField('Optional concise review comment.'),
      },
      handler: async (input, runtimeCtx) => service.createReview(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'list_reviews',
      description: 'List public review records received by one agent, newest first.',
      inputSchema: {
        agentId: stringField('The reviewed agent id.', true),
        limit: numberField('Maximum reviews to return. Defaults to 20 and is capped at 50.'),
      },
      controlPolicy: readPolicy,
      handler: async (input) => service.listReviews(input),
    });

    await registerCommand(ctx, {
      id: 'get_reputation_profile',
      description: 'Summarize one agent reputation from completed trades, active listings, reviews, and open reports.',
      inputSchema: {
        agentId: stringField('The agent id whose reputation profile should be fetched.', true),
      },
      controlPolicy: readPolicy,
      handler: async (input) => service.getReputationProfile(input),
    });

    await registerCommand(ctx, {
      id: 'create_report',
      description: 'Record a safety report about a listing, trade, message, or agent without changing ratings automatically.',
      inputSchema: {
        targetType: stringField('Required target type: listing, trade, message, or agent.', true),
        targetId: stringField('Required target id for the reported object or agent.', true),
        tradeId: stringField('Optional related trade id for evidence context.'),
        reasonCode: stringField('Short machine-readable reason code.', true),
        detail: stringField('Optional report detail and evidence summary.'),
      },
      handler: async (input, runtimeCtx) => service.createReport(requireSession(runtimeCtx), input),
    });

    await registerCommand(ctx, {
      id: 'list_my_reports',
      description: 'List safety reports submitted by the authenticated agent.',
      inputSchema: {
        limit: numberField('Maximum reports to return. Defaults to 20 and is capped at 50.'),
      },
      controlPolicy: readPolicy,
      handler: async (input, runtimeCtx) => service.listMyReports(requireSession(runtimeCtx), input),
    });

    await ctx.http.registerRoute({
      routeId: 'status',
      method: 'GET',
      path: '/status',
      authPolicy: 'public',
      handler: async () => ({
        ok: true,
        pluginId: PLUGIN_ID,
        version: '0.1.0',
        commands: 23,
        imageLimits: service.getImageLimits(),
      }),
    });

    await ctx.http.registerRoute({
      routeId: 'upload-listing-asset',
      method: 'POST',
      path: '/assets/listings',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => {
        const agentId = firstString(runtimeCtx.request.query.agentId);
        if (typeof agentId !== 'string' || !agentId.trim()) {
          throw Object.assign(new Error('agentId query parameter is required.'), {
            code: 'INVALID_PARAMS',
            action: 'retry',
            details: { field: 'agentId' },
            statusCode: 400,
          });
        }
        const upload = parseListingAssetUpload(
          String(runtimeCtx.request.headers['content-type'] ?? ''),
          runtimeCtx.request.rawBody,
        );
        return service.createListingAsset({
          agentId: agentId.trim(),
          userId: runtimeCtx.httpSession.userId,
          agentName: agentId.trim(),
          role: 'agent',
        }, upload);
      },
    });

    await ctx.http.registerRoute({
      routeId: 'read-asset',
      method: 'GET',
      path: '/assets/:assetId',
      authPolicy: 'user',
      handler: async (_input, runtimeCtx) => {
        const asset = await service.readAsset(runtimeCtx.request.params.assetId);
        return {
          status: 200,
          headers: {
            'Content-Type': asset.mimeType,
            'Cache-Control': 'private, max-age=300',
          },
          body: asset.data,
        };
      },
    });
  },
});
