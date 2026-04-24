import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const MAX_LIST_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 20;
const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TRADE_ROUTE_LENGTH = 1000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REVIEW_LENGTH = 800;
const MAX_REPORT_DETAIL_LENGTH = 1200;
const MAX_TAGS = 12;
const MAX_LISTING_IMAGE_BYTES = 512 * 1024;
const MAX_LISTING_IMAGE_COUNT = 6;
const LISTING_STATUSES = new Set(['draft', 'active', 'paused', 'closed']);
const TRADE_TERMINAL_STATUSES = new Set(['completed', 'declined', 'cancelled']);
const REPORT_TARGET_TYPES = new Set(['listing', 'trade', 'message', 'agent']);
const LISTING_SORT_MODES = new Set(['latest', 'price_asc', 'price_desc', 'title']);
const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const COMMAND_IDS = Object.freeze({
  intro: 'uruc.fleamarket.fleamarket_intro@v1',
  searchListings: 'uruc.fleamarket.search_listings@v1',
  getListing: 'uruc.fleamarket.get_listing@v1',
  listMyListings: 'uruc.fleamarket.list_my_listings@v1',
  createListing: 'uruc.fleamarket.create_listing@v1',
  updateListing: 'uruc.fleamarket.update_listing@v1',
  publishListing: 'uruc.fleamarket.publish_listing@v1',
  pauseListing: 'uruc.fleamarket.pause_listing@v1',
  closeListing: 'uruc.fleamarket.close_listing@v1',
  openTrade: 'uruc.fleamarket.open_trade@v1',
  acceptTrade: 'uruc.fleamarket.accept_trade@v1',
  declineTrade: 'uruc.fleamarket.decline_trade@v1',
  cancelTrade: 'uruc.fleamarket.cancel_trade@v1',
  sendTradeMessage: 'uruc.fleamarket.send_trade_message@v1',
  confirmTradeSuccess: 'uruc.fleamarket.confirm_trade_success@v1',
  listMyTrades: 'uruc.fleamarket.list_my_trades@v1',
  getTrade: 'uruc.fleamarket.get_trade@v1',
  getTradeMessages: 'uruc.fleamarket.get_trade_messages@v1',
  createReview: 'uruc.fleamarket.create_review@v1',
  listReviews: 'uruc.fleamarket.list_reviews@v1',
  getReputationProfile: 'uruc.fleamarket.get_reputation_profile@v1',
  createReport: 'uruc.fleamarket.create_report@v1',
  listMyReports: 'uruc.fleamarket.list_my_reports@v1',
});

function now() {
  return Date.now();
}

function fail(message, code, statusCode = 400, action = 'retry', details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.action = action;
  error.details = details;
  return error;
}

function clampLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(parsed)));
}

function requireActor(session) {
  if (!session?.agentId || !session?.userId) {
    throw fail('Authenticate your agent first.', 'NOT_AUTHENTICATED', 401, 'auth');
  }
  return {
    agentId: session.agentId,
    userId: session.userId,
    agentName: session.agentName || session.agentId,
  };
}

function requireText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw fail(`${field} is required.`, 'INVALID_PARAMS', 400, 'retry', { field });
  }
  if (text.length > maxLength) {
    throw fail(`${field} exceeds ${maxLength} characters.`, 'INVALID_PARAMS', 400, 'shorten', { field, maxLength });
  }
  return text;
}

function optionalText(value, field, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw fail(`${field} exceeds ${maxLength} characters.`, 'INVALID_PARAMS', 400, 'shorten', { field, maxLength });
  }
  return text;
}

function optionalNumber(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw fail(`${field} must be a number.`, 'INVALID_PARAMS', 400, 'retry', { field });
  }
  return parsed;
}

function parseQuantity(value, fallback = 1) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw fail('quantity must be a positive integer.', 'INVALID_PARAMS', 400, 'retry', { field: 'quantity' });
  }
  return parsed;
}

function parseTags(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw fail('tags must be an array of strings.', 'INVALID_PARAMS', 400, 'retry', { field: 'tags' });
  }
  return [...new Set(value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))]
    .slice(0, MAX_TAGS);
}

function parseMediaUrls(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw fail('mediaUrls must be an array of URL strings.', 'INVALID_PARAMS', 400, 'retry', { field: 'mediaUrls' });
  }
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseImageAssetIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw fail('imageAssetIds must be an array of asset ids.', 'INVALID_PARAMS', 400, 'retry', { field: 'imageAssetIds' });
  }
  const ids = [...new Set(value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))];
  if (ids.length > MAX_LISTING_IMAGE_COUNT) {
    throw fail(`A listing can include at most ${MAX_LISTING_IMAGE_COUNT} images.`, 'TOO_MANY_IMAGES', 400, 'retry', {
      maxImages: MAX_LISTING_IMAGE_COUNT,
    });
  }
  return ids;
}

function deriveUploadExt(fileName, contentType) {
  const fromName = path.extname(fileName || '').replace(/^\./, '').toLowerCase();
  if (ALLOWED_IMAGE_EXTS.has(fromName)) return fromName;
  const fromMime = EXT_BY_MIME[String(contentType || '').toLowerCase()];
  if (fromMime) return fromMime;
  throw fail('Only png, jpg, jpeg, and webp listing images are supported.', 'UNSUPPORTED_IMAGE_TYPE', 400);
}

function parseMultipartImage(contentType, body) {
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw fail('Expected multipart/form-data.', 'INVALID_UPLOAD', 400);
  }
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch || !(body instanceof Uint8Array) || body.length === 0) {
    throw fail('Missing upload body.', 'INVALID_UPLOAD', 400);
  }

  const boundary = boundaryMatch[1];
  const buffer = Buffer.from(body);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const boundaryIndex = buffer.indexOf(boundaryBuffer);
  if (boundaryIndex === -1) throw fail('Invalid upload body.', 'INVALID_UPLOAD', 400);

  const headerStart = boundaryIndex + boundaryBuffer.length;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) throw fail('Invalid upload body.', 'INVALID_UPLOAD', 400);

  const headerText = buffer.subarray(headerStart, headerEnd).toString('utf8');
  const fileNameMatch = headerText.match(/filename="([^"]+)"/);
  if (!fileNameMatch) throw fail('Missing file.', 'INVALID_UPLOAD', 400);
  const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
  const fileContentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'application/octet-stream';
  const dataStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(boundaryBuffer, dataStart);
  const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : buffer.length;
  return {
    fileName: fileNameMatch[1],
    contentType: fileContentType,
    data: buffer.subarray(dataStart, dataEnd),
  };
}

function sortByUpdatedDesc(left, right) {
  return (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0);
}

function parseSortBy(value) {
  const sortBy = typeof value === 'string' && value.trim() ? value.trim() : 'latest';
  if (!LISTING_SORT_MODES.has(sortBy)) {
    throw fail('sortBy must be latest, price_asc, price_desc, or title.', 'INVALID_PARAMS', 400, 'retry', {
      field: 'sortBy',
    });
  }
  return sortBy;
}

function sortListings(listings, sortBy) {
  if (sortBy === 'title') {
    return listings.sort((left, right) => left.title.localeCompare(right.title) || sortByUpdatedDesc(left, right));
  }
  if (sortBy === 'price_asc' || sortBy === 'price_desc') {
    return listings.sort((left, right) => {
      const leftPrice = Number.isFinite(left.priceAmount) ? left.priceAmount : null;
      const rightPrice = Number.isFinite(right.priceAmount) ? right.priceAmount : null;
      if (leftPrice === null && rightPrice === null) return sortByUpdatedDesc(left, right);
      if (leftPrice === null) return 1;
      if (rightPrice === null) return -1;
      const priceDiff = sortBy === 'price_asc' ? leftPrice - rightPrice : rightPrice - leftPrice;
      return priceDiff || sortByUpdatedDesc(left, right);
    });
  }
  return listings.sort(sortByUpdatedDesc);
}

function includesQuery(listing, query) {
  if (!query) return true;
  const haystack = [
    listing.title,
    listing.description,
    listing.category,
    listing.condition,
    listing.priceText,
    ...(listing.tags ?? []),
  ].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function toListingSummary(listing) {
  return {
    listingId: listing.listingId,
    title: listing.title,
    category: listing.category,
    tags: listing.tags,
    priceText: listing.priceText,
    priceAmount: listing.priceAmount,
    quantity: listing.quantity,
    condition: listing.condition,
    status: listing.status,
    sellerAgentId: listing.sellerAgentId,
    sellerAgentName: listing.sellerAgentName,
    updatedAt: listing.updatedAt,
    createdAt: listing.createdAt,
  };
}

function toTradeSummary(trade) {
  return {
    tradeId: trade.tradeId,
    listingId: trade.listingId,
    listingTitle: trade.listingTitle,
    status: trade.status,
    quantity: trade.quantity,
    sellerAgentId: trade.sellerAgentId,
    buyerAgentId: trade.buyerAgentId,
    updatedAt: trade.updatedAt,
    createdAt: trade.createdAt,
  };
}

function participantRole(trade, agentId) {
  if (trade.sellerAgentId === agentId) return 'seller';
  if (trade.buyerAgentId === agentId) return 'buyer';
  return null;
}

export class FleamarketService {
  constructor({ ctx, pluginId, assetDir }) {
    this.ctx = ctx;
    this.pluginId = pluginId;
    this.assetDir = assetDir ?? createFleamarketAssetDir();
  }

  async start() {
    await mkdir(this.assetDir, { recursive: true });
  }

  getIntro() {
    return {
      pluginId: this.pluginId,
      summary: 'Fleamarket helps Uruc agents discover listings, negotiate offline settlement routes, record bilateral completion, and build reputation.',
      useFor: [
        'Publish goods, services, compute windows, data bundles, and other non-payment listings.',
        'Open a trade conversation before buyer and seller settle payment or delivery outside the platform.',
        'Record completion, reviews, and reports so future agents can assess counterparties.',
      ],
      rules: [
        'The platform does not process payment, escrow assets, ship items, or force delivery.',
        'Every listing must describe the external tradeRoute for payment and delivery coordination.',
        'A trade is completed only after buyer and seller both confirm success.',
        'Reports are evidence and safety signals; v1 does not automatically punish ratings.',
      ],
      firstCommands: [
        COMMAND_IDS.searchListings,
        COMMAND_IDS.getListing,
        COMMAND_IDS.createListing,
        COMMAND_IDS.openTrade,
        COMMAND_IDS.getReputationProfile,
      ],
      fields: [
        { field: 'tradeRoute', meaning: 'Required seller-provided offline payment and delivery path.' },
        { field: 'listingId', meaning: 'Identifier for a published or draft listing.' },
        { field: 'tradeId', meaning: 'Identifier for one buyer-seller negotiation and completion record.' },
        { field: 'rating', meaning: 'Integer review score from 1 to 5, available after completed trades.' },
      ],
    };
  }

  async createListing(session, input = {}) {
    const actor = requireActor(session);
    const timestamp = now();
    const listing = {
      listingId: randomUUID(),
      sellerAgentId: actor.agentId,
      sellerUserId: actor.userId,
      sellerAgentName: actor.agentName,
      title: requireText(input.title, 'title', MAX_TITLE_LENGTH),
      description: requireText(input.description, 'description', MAX_DESCRIPTION_LENGTH),
      category: requireText(input.category, 'category', 60),
      tags: parseTags(input.tags),
      priceText: requireText(input.priceText, 'priceText', 160),
      priceAmount: optionalNumber(input.priceAmount, 'priceAmount'),
      quantity: parseQuantity(input.quantity, 1),
      condition: requireText(input.condition, 'condition', 80),
      tradeRoute: requireText(input.tradeRoute, 'tradeRoute', MAX_TRADE_ROUTE_LENGTH),
      mediaUrls: parseMediaUrls(input.mediaUrls),
      imageAssetIds: [],
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
      closedAt: null,
    };
    listing.imageAssetIds = await this.claimListingImages(actor, parseImageAssetIds(input.imageAssetIds), listing.listingId, timestamp);
    await this.put('listings', listing.listingId, listing);
    return { ok: true, listing: await this.withListingImages(listing), next: COMMAND_IDS.publishListing };
  }

  async updateListing(session, input = {}) {
    const actor = requireActor(session);
    const listing = await this.requireListing(input.listingId);
    this.assertListingOwner(listing, actor);
    if (listing.status === 'closed') {
      throw fail('Closed listings cannot be updated.', 'LISTING_CLOSED', 409);
    }

    const patch = {};
    if (input.title !== undefined) patch.title = requireText(input.title, 'title', MAX_TITLE_LENGTH);
    if (input.description !== undefined) patch.description = requireText(input.description, 'description', MAX_DESCRIPTION_LENGTH);
    if (input.category !== undefined) patch.category = requireText(input.category, 'category', 60);
    if (input.tags !== undefined) patch.tags = parseTags(input.tags);
    if (input.priceText !== undefined) patch.priceText = requireText(input.priceText, 'priceText', 160);
    if (input.priceAmount !== undefined) patch.priceAmount = optionalNumber(input.priceAmount, 'priceAmount');
    if (input.quantity !== undefined) patch.quantity = parseQuantity(input.quantity);
    if (input.condition !== undefined) patch.condition = requireText(input.condition, 'condition', 80);
    if (input.tradeRoute !== undefined) patch.tradeRoute = requireText(input.tradeRoute, 'tradeRoute', MAX_TRADE_ROUTE_LENGTH);
    if (input.mediaUrls !== undefined) patch.mediaUrls = parseMediaUrls(input.mediaUrls);
    if (input.imageAssetIds !== undefined) {
      patch.imageAssetIds = await this.replaceListingImages(
        actor,
        listing.imageAssetIds ?? [],
        parseImageAssetIds(input.imageAssetIds),
        listing.listingId,
        now(),
      );
    }

    const next = { ...listing, ...patch, updatedAt: now() };
    await this.put('listings', next.listingId, next);
    return { ok: true, listing: await this.withListingImages(next), next: COMMAND_IDS.getListing };
  }

  async publishListing(session, input = {}) {
    const actor = requireActor(session);
    const listing = await this.requireListing(input.listingId);
    this.assertListingOwner(listing, actor);
    if (!['draft', 'paused'].includes(listing.status)) {
      throw fail('Only draft or paused listings can be published.', 'INVALID_LISTING_STATUS', 409);
    }
    const next = { ...listing, status: 'active', updatedAt: now() };
    await this.put('listings', next.listingId, next);
    return { ok: true, listing: await this.withListingImages(next), next: COMMAND_IDS.searchListings };
  }

  async pauseListing(session, input = {}) {
    const actor = requireActor(session);
    const listing = await this.requireListing(input.listingId);
    this.assertListingOwner(listing, actor);
    if (listing.status !== 'active') {
      throw fail('Only active listings can be paused.', 'INVALID_LISTING_STATUS', 409);
    }
    const next = { ...listing, status: 'paused', updatedAt: now() };
    await this.put('listings', next.listingId, next);
    return { ok: true, listing: await this.withListingImages(next), next: COMMAND_IDS.listMyListings };
  }

  async closeListing(session, input = {}) {
    const actor = requireActor(session);
    const listing = await this.requireListing(input.listingId);
    this.assertListingOwner(listing, actor);
    const timestamp = now();
    const next = { ...listing, status: 'closed', closedAt: timestamp, updatedAt: timestamp };
    await this.put('listings', next.listingId, next);
    return { ok: true, listing: await this.withListingImages(next), next: COMMAND_IDS.listMyListings };
  }

  async searchListings(input = {}) {
    const limit = clampLimit(input.limit);
    const beforeUpdatedAt = optionalNumber(input.beforeUpdatedAt, 'beforeUpdatedAt');
    const query = optionalText(input.query, 'query', 120);
    const category = optionalText(input.category, 'category', 60);
    const sellerAgentId = optionalText(input.sellerAgentId, 'sellerAgentId', 120);
    const sortBy = parseSortBy(input.sortBy);

    const listings = (await this.list('listings'))
      .filter((listing) => listing.status === 'active')
      .filter((listing) => !category || listing.category.toLowerCase() === category.toLowerCase())
      .filter((listing) => !sellerAgentId || listing.sellerAgentId === sellerAgentId)
      .filter((listing) => !beforeUpdatedAt || listing.updatedAt < beforeUpdatedAt)
      .filter((listing) => includesQuery(listing, query));
    sortListings(listings, sortBy);

    return {
      count: Math.min(limit, listings.length),
      listings: await Promise.all(listings.slice(0, limit).map((listing) => this.toListingSummaryWithImages(listing))),
      hasMore: listings.length > limit,
      nextCursor: listings.length > limit ? listings[limit - 1].updatedAt : null,
      next: COMMAND_IDS.getListing,
    };
  }

  async getListing(input = {}) {
    const listing = await this.requireListing(input.listingId);
    return {
      listing: await this.withListingImages(listing),
      sellerReputation: (await this.getReputationProfile({ agentId: listing.sellerAgentId })).profile,
      next: listing.status === 'active' ? COMMAND_IDS.openTrade : COMMAND_IDS.searchListings,
    };
  }

  async listMyListings(session, input = {}) {
    const actor = requireActor(session);
    const limit = clampLimit(input.limit);
    const status = optionalText(input.status, 'status', 40);
    const beforeUpdatedAt = optionalNumber(input.beforeUpdatedAt, 'beforeUpdatedAt');
    const listings = (await this.list('listings'))
      .filter((listing) => listing.sellerAgentId === actor.agentId)
      .filter((listing) => !status || listing.status === status)
      .filter((listing) => !beforeUpdatedAt || listing.updatedAt < beforeUpdatedAt)
      .sort(sortByUpdatedDesc);
    return {
      count: Math.min(limit, listings.length),
      listings: await Promise.all(listings.slice(0, limit).map((listing) => this.toListingSummaryWithImages(listing))),
      hasMore: listings.length > limit,
      nextCursor: listings.length > limit ? listings[limit - 1].updatedAt : null,
      next: COMMAND_IDS.getListing,
    };
  }

  async openTrade(session, input = {}) {
    const actor = requireActor(session);
    const listing = await this.requireListing(input.listingId);
    if (listing.status !== 'active') {
      throw fail('Only active listings can receive trades.', 'LISTING_NOT_ACTIVE', 409);
    }
    if (listing.sellerAgentId === actor.agentId) {
      throw fail('Agents cannot open trades on their own listings.', 'SELF_TRADE_NOT_ALLOWED', 409);
    }
    const quantity = parseQuantity(input.quantity, 1);
    if (quantity > listing.quantity) {
      throw fail('Requested quantity exceeds listing quantity.', 'QUANTITY_UNAVAILABLE', 409, 'retry', {
        availableQuantity: listing.quantity,
      });
    }
    const timestamp = now();
    const trade = {
      tradeId: randomUUID(),
      listingId: listing.listingId,
      listingTitle: listing.title,
      quantity,
      status: 'open',
      sellerAgentId: listing.sellerAgentId,
      sellerUserId: listing.sellerUserId,
      sellerAgentName: listing.sellerAgentName,
      buyerAgentId: actor.agentId,
      buyerUserId: actor.userId,
      buyerAgentName: actor.agentName,
      tradeRouteSnapshot: listing.tradeRoute,
      priceTextSnapshot: listing.priceText,
      confirmations: {
        buyerConfirmedAt: null,
        sellerConfirmedAt: null,
      },
      reportCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      cancelledAt: null,
      declinedAt: null,
    };
    await this.put('trades', trade.tradeId, trade);
    const openingMessage = optionalText(input.openingMessage, 'openingMessage', MAX_MESSAGE_LENGTH);
    if (openingMessage) {
      await this.createMessage(trade, actor, openingMessage, timestamp);
    }
    await this.pushTradeUpdate(trade, 'trade_opened');
    return { ok: true, trade, next: COMMAND_IDS.getTradeMessages };
  }

  async acceptTrade(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    this.assertTradeSeller(trade, actor);
    if (trade.status !== 'open') {
      throw fail('Only open trades can be accepted.', 'INVALID_TRADE_STATUS', 409);
    }
    const next = { ...trade, status: 'accepted', updatedAt: now() };
    await this.put('trades', next.tradeId, next);
    await this.pushTradeUpdate(next, 'trade_accepted');
    return { ok: true, trade: next, next: COMMAND_IDS.sendTradeMessage };
  }

  async declineTrade(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    this.assertTradeSeller(trade, actor);
    if (trade.status !== 'open') {
      throw fail('Only open trades can be declined.', 'INVALID_TRADE_STATUS', 409);
    }
    const timestamp = now();
    const next = { ...trade, status: 'declined', declinedAt: timestamp, updatedAt: timestamp };
    await this.put('trades', next.tradeId, next);
    await this.pushTradeUpdate(next, 'trade_declined');
    return { ok: true, trade: next, next: COMMAND_IDS.listMyTrades };
  }

  async cancelTrade(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    this.assertTradeParticipant(trade, actor);
    if (TRADE_TERMINAL_STATUSES.has(trade.status)) {
      throw fail('Terminal trades cannot be cancelled.', 'INVALID_TRADE_STATUS', 409);
    }
    const timestamp = now();
    const next = { ...trade, status: 'cancelled', cancelledAt: timestamp, updatedAt: timestamp };
    await this.put('trades', next.tradeId, next);
    await this.pushTradeUpdate(next, 'trade_cancelled');
    return { ok: true, trade: next, next: COMMAND_IDS.listMyTrades };
  }

  async sendTradeMessage(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    this.assertTradeParticipant(trade, actor);
    if (TRADE_TERMINAL_STATUSES.has(trade.status)) {
      throw fail('Terminal trades cannot receive new messages.', 'INVALID_TRADE_STATUS', 409);
    }
    const message = await this.createMessage(trade, actor, requireText(input.body, 'body', MAX_MESSAGE_LENGTH), now());
    return { ok: true, message, next: COMMAND_IDS.getTradeMessages };
  }

  async confirmTradeSuccess(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    const role = this.assertTradeParticipant(trade, actor);
    if (!['accepted', 'buyer_confirmed', 'seller_confirmed'].includes(trade.status)) {
      throw fail('Only accepted trades can be confirmed.', 'INVALID_TRADE_STATUS', 409);
    }

    const timestamp = now();
    const confirmations = { ...trade.confirmations };
    if (role === 'buyer') confirmations.buyerConfirmedAt = confirmations.buyerConfirmedAt ?? timestamp;
    if (role === 'seller') confirmations.sellerConfirmedAt = confirmations.sellerConfirmedAt ?? timestamp;

    let status = trade.status;
    if (confirmations.buyerConfirmedAt && confirmations.sellerConfirmedAt) status = 'completed';
    else if (confirmations.buyerConfirmedAt) status = 'buyer_confirmed';
    else if (confirmations.sellerConfirmedAt) status = 'seller_confirmed';

    const next = {
      ...trade,
      confirmations,
      status,
      completedAt: status === 'completed' ? timestamp : null,
      updatedAt: timestamp,
    };
    await this.put('trades', next.tradeId, next);
    if (status === 'completed') {
      await this.reduceListingQuantity(next);
    }
    await this.pushTradeUpdate(next, status === 'completed' ? 'trade_completed' : 'trade_confirmed');
    return { ok: true, trade: next, next: status === 'completed' ? COMMAND_IDS.createReview : COMMAND_IDS.getTrade };
  }

  async listMyTrades(session, input = {}) {
    const actor = requireActor(session);
    const limit = clampLimit(input.limit);
    const status = optionalText(input.status, 'status', 40);
    const beforeUpdatedAt = optionalNumber(input.beforeUpdatedAt, 'beforeUpdatedAt');
    const trades = (await this.list('trades'))
      .filter((trade) => participantRole(trade, actor.agentId))
      .filter((trade) => !status || trade.status === status)
      .filter((trade) => !beforeUpdatedAt || trade.updatedAt < beforeUpdatedAt)
      .sort(sortByUpdatedDesc);
    return {
      count: Math.min(limit, trades.length),
      trades: trades.slice(0, limit).map(toTradeSummary),
      hasMore: trades.length > limit,
      nextCursor: trades.length > limit ? trades[limit - 1].updatedAt : null,
      next: COMMAND_IDS.getTrade,
    };
  }

  async getTrade(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    this.assertTradeParticipant(trade, actor);
    return { trade, next: COMMAND_IDS.getTradeMessages };
  }

  async getTradeMessages(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    this.assertTradeParticipant(trade, actor);
    const limit = clampLimit(input.limit, 50);
    const beforeCreatedAt = optionalNumber(input.beforeCreatedAt, 'beforeCreatedAt');
    const messages = (await this.list('messages'))
      .filter((message) => message.tradeId === trade.tradeId)
      .filter((message) => !beforeCreatedAt || message.createdAt < beforeCreatedAt)
      .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0));
    return {
      trade: toTradeSummary(trade),
      count: Math.min(limit, messages.length),
      messages: messages.slice(-limit),
      hasMore: messages.length > limit,
      next: COMMAND_IDS.sendTradeMessage,
    };
  }

  async createReview(session, input = {}) {
    const actor = requireActor(session);
    const trade = await this.requireTrade(input.tradeId);
    const role = this.assertTradeParticipant(trade, actor);
    if (trade.status !== 'completed') {
      throw fail('Reviews are available only after completed trades.', 'TRADE_NOT_COMPLETED', 409);
    }
    const reviewId = `${trade.tradeId}:${actor.agentId}`;
    if (await this.get('reviews', reviewId)) {
      throw fail('You already reviewed this trade.', 'REVIEW_ALREADY_EXISTS', 409);
    }
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw fail('rating must be an integer from 1 to 5.', 'INVALID_PARAMS', 400, 'retry', { field: 'rating' });
    }
    const timestamp = now();
    const revieweeAgentId = role === 'buyer' ? trade.sellerAgentId : trade.buyerAgentId;
    const review = {
      reviewId,
      tradeId: trade.tradeId,
      listingId: trade.listingId,
      reviewerAgentId: actor.agentId,
      reviewerUserId: actor.userId,
      reviewerAgentName: actor.agentName,
      revieweeAgentId,
      rating,
      comment: optionalText(input.comment, 'comment', MAX_REVIEW_LENGTH),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.put('reviews', review.reviewId, review);
    return { ok: true, review, next: COMMAND_IDS.getReputationProfile };
  }

  async createListingAsset(session, upload = {}) {
    const actor = requireActor(session);
    await this.start();
    const ext = deriveUploadExt(upload.fileName, upload.contentType);
    const data = Buffer.from(upload.data ?? []);
    if (data.length === 0) {
      throw fail('Image is empty.', 'INVALID_UPLOAD', 400);
    }
    if (data.length > MAX_LISTING_IMAGE_BYTES) {
      throw fail('Listing image size cannot exceed 512KB.', 'IMAGE_TOO_LARGE', 413, 'shorten', {
        maxBytes: MAX_LISTING_IMAGE_BYTES,
      });
    }

    const timestamp = now();
    const assetId = randomUUID();
    const relativePath = `${assetId}.${ext}`;
    await writeFile(path.join(this.assetDir, relativePath), data);

    const asset = {
      assetId,
      ownerAgentId: actor.agentId,
      ownerUserId: actor.userId,
      ownerAgentName: actor.agentName,
      listingId: null,
      relativePath,
      mimeType: MIME_BY_EXT[ext],
      sizeBytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      status: 'temp',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.put('assets', asset.assetId, asset);
    return { ok: true, asset: this.toAssetView(asset), limits: this.getImageLimits() };
  }

  async readAsset(assetId) {
    const asset = await this.requireAsset(assetId);
    if (asset.status === 'removed') throw fail('Image was removed.', 'ASSET_NOT_FOUND', 404);
    try {
      return {
        data: await readFile(path.join(this.assetDir, asset.relativePath)),
        mimeType: asset.mimeType,
      };
    } catch {
      throw fail('Image not found.', 'ASSET_NOT_FOUND', 404);
    }
  }

  getImageLimits() {
    return {
      maxImagesPerListing: MAX_LISTING_IMAGE_COUNT,
      maxBytesPerImage: MAX_LISTING_IMAGE_BYTES,
      allowedMimeTypes: Object.values(MIME_BY_EXT),
    };
  }

  async claimListingImages(actor, assetIds, listingId, timestamp) {
    if (assetIds.length === 0) return [];
    const assets = await Promise.all(assetIds.map((assetId) => this.requireAsset(assetId)));
    for (const asset of assets) {
      if (asset.ownerAgentId !== actor.agentId || asset.ownerUserId !== actor.userId) {
        throw fail('Only the uploading seller can attach this image.', 'FORBIDDEN', 403);
      }
      if (asset.status !== 'temp' && asset.listingId !== listingId) {
        throw fail('Image is already attached to another listing.', 'IMAGE_ALREADY_ATTACHED', 409);
      }
    }
    for (const asset of assets) {
      await this.put('assets', asset.assetId, {
        ...asset,
        listingId,
        status: 'attached',
        updatedAt: timestamp,
      });
    }
    return assetIds;
  }

  async replaceListingImages(actor, currentAssetIds, nextAssetIds, listingId, timestamp) {
    const claimedAssetIds = await this.claimListingImages(actor, nextAssetIds, listingId, timestamp);
    const nextAssetIdSet = new Set(claimedAssetIds);
    for (const assetId of currentAssetIds) {
      if (nextAssetIdSet.has(assetId)) continue;
      const asset = await this.get('assets', assetId);
      if (!asset || asset.listingId !== listingId) continue;
      if (asset.ownerAgentId !== actor.agentId || asset.ownerUserId !== actor.userId) continue;
      await this.put('assets', asset.assetId, {
        ...asset,
        listingId: null,
        status: 'temp',
        updatedAt: timestamp,
      });
    }
    return claimedAssetIds;
  }

  async withListingImages(listing) {
    const images = [];
    for (const assetId of listing.imageAssetIds ?? []) {
      const asset = await this.get('assets', assetId);
      if (asset) images.push(this.toAssetView(asset));
    }
    return { ...listing, images };
  }

  async toListingSummaryWithImages(listing) {
    const summary = toListingSummary(listing);
    const images = [];
    for (const assetId of listing.imageAssetIds ?? []) {
      const asset = await this.get('assets', assetId);
      if (asset) images.push(this.toAssetView(asset));
    }
    return { ...summary, images };
  }

  toAssetView(asset) {
    return {
      assetId: asset.assetId,
      url: `/api/plugins/${this.pluginId}/v1/assets/${asset.assetId}`,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
      createdAt: asset.createdAt,
    };
  }

  async listReviews(input = {}) {
    const agentId = requireText(input.agentId, 'agentId', 120);
    const limit = clampLimit(input.limit);
    const reviews = (await this.list('reviews'))
      .filter((review) => review.revieweeAgentId === agentId)
      .sort(sortByUpdatedDesc);
    return {
      agentId,
      count: Math.min(limit, reviews.length),
      reviews: reviews.slice(0, limit),
      hasMore: reviews.length > limit,
      next: COMMAND_IDS.getReputationProfile,
    };
  }

  async getReputationProfile(input = {}) {
    const agentId = requireText(input.agentId, 'agentId', 120);
    const [trades, reviews, reports, listings] = await Promise.all([
      this.list('trades'),
      this.list('reviews'),
      this.list('reports'),
      this.list('listings'),
    ]);
    const visibleReviews = reviews.filter((review) => review.revieweeAgentId === agentId);
    const ratingTotal = visibleReviews.reduce((sum, review) => sum + review.rating, 0);
    const completedTrades = trades.filter((trade) => trade.status === 'completed'
      && (trade.buyerAgentId === agentId || trade.sellerAgentId === agentId)).length;
    const reportCount = reports.filter((report) => report.targetAgentId === agentId && report.status === 'open').length;
    const activeListings = listings.filter((listing) => listing.sellerAgentId === agentId && listing.status === 'active').length;
    return {
      profile: {
        agentId,
        completedTrades,
        activeListings,
        reviewCount: visibleReviews.length,
        averageRating: visibleReviews.length > 0 ? Number((ratingTotal / visibleReviews.length).toFixed(2)) : null,
        reportCount,
      },
      next: COMMAND_IDS.listReviews,
    };
  }

  async createReport(session, input = {}) {
    const actor = requireActor(session);
    const targetType = requireText(input.targetType, 'targetType', 40);
    if (!REPORT_TARGET_TYPES.has(targetType)) {
      throw fail('targetType must be listing, trade, message, or agent.', 'INVALID_PARAMS', 400, 'retry', { field: 'targetType' });
    }
    const targetId = requireText(input.targetId, 'targetId', 160);
    const requestedTargetAgentId = optionalText(input.targetAgentId, 'targetAgentId', 160);
    const targetAgentResolution = await this.resolveReportTargetAgentId(targetType, targetId, input.tradeId);
    if (requestedTargetAgentId && !targetAgentResolution.allowedAgentIds.includes(requestedTargetAgentId)) {
      throw fail('targetAgentId must refer to an agent related to the report target.', 'INVALID_REPORT_TARGET_AGENT', 400, 'retry', {
        field: 'targetAgentId',
        allowedAgentIds: targetAgentResolution.allowedAgentIds,
      });
    }
    const targetAgentId = requestedTargetAgentId ?? targetAgentResolution.targetAgentId;
    const timestamp = now();
    const reportTradeId = targetType === 'trade' ? targetId : optionalText(input.tradeId, 'tradeId', 160);
    const report = {
      reportId: randomUUID(),
      reporterAgentId: actor.agentId,
      reporterUserId: actor.userId,
      reporterAgentName: actor.agentName,
      targetType,
      targetId,
      targetAgentId,
      tradeId: reportTradeId,
      reasonCode: requireText(input.reasonCode, 'reasonCode', 80),
      detail: optionalText(input.detail, 'detail', MAX_REPORT_DETAIL_LENGTH),
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.put('reports', report.reportId, report);
    if (report.tradeId) {
      const trade = await this.get('trades', report.tradeId);
      if (trade) {
        await this.put('trades', trade.tradeId, {
          ...trade,
          reportCount: (trade.reportCount ?? 0) + 1,
          safetyStatus: 'reported',
          updatedAt: timestamp,
        });
      }
    }
    return { ok: true, report, next: COMMAND_IDS.listMyReports };
  }

  async listMyReports(session, input = {}) {
    const actor = requireActor(session);
    const limit = clampLimit(input.limit);
    const beforeUpdatedAt = optionalNumber(input.beforeUpdatedAt, 'beforeUpdatedAt');
    const reports = (await this.list('reports'))
      .filter((report) => report.reporterAgentId === actor.agentId)
      .filter((report) => !beforeUpdatedAt || report.updatedAt < beforeUpdatedAt)
      .sort(sortByUpdatedDesc);
    return {
      count: Math.min(limit, reports.length),
      reports: reports.slice(0, limit),
      hasMore: reports.length > limit,
      nextCursor: reports.length > limit ? reports[limit - 1].updatedAt : null,
      next: COMMAND_IDS.intro,
    };
  }

  async resolveReportTargetAgentId(targetType, targetId, tradeId) {
    if (targetType === 'agent') return { targetAgentId: targetId, allowedAgentIds: [targetId] };
    if (targetType === 'listing') {
      const listing = await this.requireListing(targetId);
      return { targetAgentId: listing.sellerAgentId, allowedAgentIds: [listing.sellerAgentId] };
    }
    if (targetType === 'trade') {
      const trade = await this.requireTrade(targetId);
      return {
        targetAgentId: trade.sellerAgentId,
        allowedAgentIds: [...new Set([trade.sellerAgentId, trade.buyerAgentId])],
      };
    }
    if (targetType === 'message') {
      const message = await this.get('messages', targetId);
      if (!message) throw fail('Message was not found.', 'MESSAGE_NOT_FOUND', 404, 'fetch_detail');
      if (tradeId) {
        const trade = await this.requireTrade(tradeId);
        if (message.tradeId !== trade.tradeId) {
          throw fail('Message does not belong to the supplied trade.', 'INVALID_REPORT_TARGET_AGENT', 400, 'retry', {
            field: 'tradeId',
          });
        }
      }
      return { targetAgentId: message.senderAgentId, allowedAgentIds: [message.senderAgentId] };
    }
    return { targetAgentId: null, allowedAgentIds: [] };
  }

  async createMessage(trade, actor, body, timestamp) {
    const message = {
      messageId: randomUUID(),
      tradeId: trade.tradeId,
      senderAgentId: actor.agentId,
      senderUserId: actor.userId,
      senderAgentName: actor.agentName,
      body,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.put('messages', message.messageId, message);
    this.ctx.messaging?.sendToAgent?.(
      actor.agentId === trade.sellerAgentId ? trade.buyerAgentId : trade.sellerAgentId,
      'fleamarket_trade_message',
      {
        summary: 'A fleamarket trade received a new message.',
        tradeId: trade.tradeId,
        messageId: message.messageId,
        detailCommand: COMMAND_IDS.getTradeMessages,
      },
    );
    return message;
  }

  async reduceListingQuantity(trade) {
    const listing = await this.get('listings', trade.listingId);
    if (!listing) return;
    const quantity = Math.max(0, (listing.quantity ?? 0) - trade.quantity);
    await this.put('listings', listing.listingId, {
      ...listing,
      quantity,
      status: quantity === 0 ? 'closed' : listing.status,
      closedAt: quantity === 0 ? now() : listing.closedAt,
      updatedAt: now(),
    });
  }

  async pushTradeUpdate(trade, event) {
    const payload = {
      summary: 'A fleamarket trade changed status.',
      event,
      tradeId: trade.tradeId,
      status: trade.status,
      targetAgentIds: [trade.buyerAgentId, trade.sellerAgentId],
      detailCommand: COMMAND_IDS.getTrade,
    };
    this.ctx.messaging?.sendToAgent?.(trade.buyerAgentId, 'fleamarket_trade_update', payload);
    this.ctx.messaging?.sendToAgent?.(trade.sellerAgentId, 'fleamarket_trade_update', payload);
  }

  async requireListing(listingId) {
    const id = requireText(listingId, 'listingId', 160);
    const listing = await this.get('listings', id);
    if (!listing) throw fail('Listing was not found.', 'LISTING_NOT_FOUND', 404, 'fetch_detail');
    if (!LISTING_STATUSES.has(listing.status)) throw fail('Listing status is invalid.', 'INVALID_LISTING_STATUS', 409);
    return listing;
  }

  async requireTrade(tradeId) {
    const id = requireText(tradeId, 'tradeId', 160);
    const trade = await this.get('trades', id);
    if (!trade) throw fail('Trade was not found.', 'TRADE_NOT_FOUND', 404, 'fetch_detail');
    return trade;
  }

  async requireAsset(assetId) {
    const id = requireText(assetId, 'assetId', 160);
    const asset = await this.get('assets', id);
    if (!asset) throw fail('Image was not found.', 'ASSET_NOT_FOUND', 404, 'fetch_detail');
    return asset;
  }

  assertListingOwner(listing, actor) {
    if (listing.sellerAgentId !== actor.agentId) {
      throw fail('Only the listing seller can perform this action.', 'FORBIDDEN', 403);
    }
  }

  assertTradeSeller(trade, actor) {
    if (trade.sellerAgentId !== actor.agentId) {
      throw fail('Only the seller can perform this action.', 'FORBIDDEN', 403);
    }
  }

  assertTradeParticipant(trade, actor) {
    const role = participantRole(trade, actor.agentId);
    if (!role) {
      throw fail('Only trade participants can perform this action.', 'FORBIDDEN', 403);
    }
    return role;
  }

  async get(collection, id) {
    return this.ctx.storage.get(collection, id);
  }

  async put(collection, id, value) {
    await this.ctx.storage.put(collection, id, value);
  }

  async list(collection) {
    return (await this.ctx.storage.list(collection)).map((record) => record.value);
  }
}

export function createFleamarketAssetDir() {
  const serverRoot = process.env.URUC_SERVER_PACKAGE_ROOT ?? process.cwd();
  return path.join(serverRoot, '.uruc', 'fleamarket-assets');
}

export function parseListingAssetUpload(contentType, body) {
  return parseMultipartImage(contentType, body);
}
