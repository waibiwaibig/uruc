import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { FleamarketService } from '../service.mjs';

function createFakeCtx() {
  const collections = new Map();
  const pushes = [];

  function collection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }

  return {
    pushes,
    storage: {
      async get(name, id) {
        return collection(name).get(id) ?? null;
      },
      async put(name, id, value) {
        collection(name).set(id, structuredClone(value));
      },
      async delete(name, id) {
        collection(name).delete(id);
      },
      async list(name) {
        return [...collection(name).entries()].map(([id, value]) => ({
          id,
          value: structuredClone(value),
          updatedAt: value.updatedAt ?? value.createdAt ?? 0,
        }));
      },
    },
    messaging: {
      sendToAgent(agentId, type, payload) {
        pushes.push({ agentId, type, payload });
      },
    },
  };
}

function session(agentId, userId = `${agentId}-user`) {
  return { agentId, userId, agentName: agentId, role: 'agent' };
}

async function publishedListing(service, seller = session('seller')) {
  const created = await service.createListing(seller, {
    title: 'GPU time block',
    description: 'One reserved compute window for model evaluation.',
    category: 'compute',
    tags: ['gpu', 'benchmark'],
    priceText: '120 city credits',
    priceAmount: 120,
    quantity: 2,
    condition: 'available',
    tradeRoute: 'Meet at market-hall, settle with agreed city credits, then seller transfers access token offline.',
    mediaUrls: ['https://example.test/gpu.png'],
  });
  return service.publishListing(seller, { listingId: created.listing.listingId });
}

describe('FleamarketService listing and discovery', () => {
  it('uploads bounded listing images and exposes attached image URLs in listing details', async () => {
    const assetDir = await mkdtemp(path.join(os.tmpdir(), 'fleamarket-assets-'));
    try {
      const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket', assetDir });
      await service.start();
      const seller = session('seller');
      const uploaded = await service.createListingAsset(seller, {
        fileName: 'gpu.png',
        contentType: 'image/png',
        data: Buffer.from('small-image'),
      });

      expect(uploaded.asset).toMatchObject({
        mimeType: 'image/png',
        sizeBytes: 11,
        status: 'temp',
      });

      const created = await service.createListing(seller, {
        title: 'GPU time block',
        description: 'One reserved compute window for model evaluation.',
        category: 'compute',
        priceText: '120 city credits',
        quantity: 1,
        condition: 'available',
        tradeRoute: 'Meet at market-hall and settle offline.',
        imageAssetIds: [uploaded.asset.assetId],
      });

      expect(created.listing.images).toEqual([
        expect.objectContaining({
          assetId: uploaded.asset.assetId,
          url: `/api/plugins/uruc.fleamarket/v1/assets/${uploaded.asset.assetId}`,
        }),
      ]);
      await expect(service.readAsset(uploaded.asset.assetId)).resolves.toMatchObject({
        mimeType: 'image/png',
        data: expect.any(Buffer),
      });
    } finally {
      await rm(assetDir, { recursive: true, force: true });
    }
  });

  it('rejects oversized uploads and listings with too many images', async () => {
    const assetDir = await mkdtemp(path.join(os.tmpdir(), 'fleamarket-assets-'));
    try {
      const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket', assetDir });
      await service.start();
      const seller = session('seller');

      await expect(service.createListingAsset(seller, {
        fileName: 'huge.png',
        contentType: 'image/png',
        data: Buffer.alloc(512 * 1024 + 1),
      })).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' });

      const uploads = [];
      for (let index = 0; index < 7; index += 1) {
        uploads.push(await service.createListingAsset(seller, {
          fileName: `image-${index}.png`,
          contentType: 'image/png',
          data: Buffer.from(`image-${index}`),
        }));
      }

      await expect(service.createListing(seller, {
        title: 'GPU time block',
        description: 'One reserved compute window for model evaluation.',
        category: 'compute',
        priceText: '120 city credits',
        quantity: 1,
        condition: 'available',
        tradeRoute: 'Meet at market-hall and settle offline.',
        imageAssetIds: uploads.map((upload) => upload.asset.assetId),
      })).rejects.toMatchObject({
        code: 'TOO_MANY_IMAGES',
        details: { maxImages: 6 },
      });
    } finally {
      await rm(assetDir, { recursive: true, force: true });
    }
  });

  it('detaches replaced listing images so sellers can reuse removed uploads', async () => {
    const assetDir = await mkdtemp(path.join(os.tmpdir(), 'fleamarket-assets-'));
    try {
      const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket', assetDir });
      await service.start();
      const seller = session('seller');
      const firstImage = await service.createListingAsset(seller, {
        fileName: 'first.png',
        contentType: 'image/png',
        data: Buffer.from('first-image'),
      });
      const secondImage = await service.createListingAsset(seller, {
        fileName: 'second.png',
        contentType: 'image/png',
        data: Buffer.from('second-image'),
      });

      const firstListing = await service.createListing(seller, {
        title: 'GPU time block',
        description: 'One reserved compute window for model evaluation.',
        category: 'compute',
        priceText: '120 city credits',
        quantity: 1,
        condition: 'available',
        tradeRoute: 'Meet at market-hall and settle offline.',
        imageAssetIds: [firstImage.asset.assetId],
      });

      const updated = await service.updateListing(seller, {
        listingId: firstListing.listing.listingId,
        imageAssetIds: [secondImage.asset.assetId],
      });
      expect(updated.listing.imageAssetIds).toEqual([secondImage.asset.assetId]);
      expect(updated.listing.images.map((image) => image.assetId)).toEqual([secondImage.asset.assetId]);

      const secondListing = await service.createListing(seller, {
        title: 'Dataset bundle',
        description: 'Curated text shards.',
        category: 'data',
        priceText: 'offer',
        quantity: 1,
        condition: 'available',
        tradeRoute: 'Meet at market-hall and settle offline.',
        imageAssetIds: [firstImage.asset.assetId],
      });

      expect(secondListing.listing.images.map((image) => image.assetId)).toEqual([firstImage.asset.assetId]);
    } finally {
      await rm(assetDir, { recursive: true, force: true });
    }
  });

  it('creates a draft listing, publishes it, and returns compact searchable summaries', async () => {
    const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket' });
    const seller = session('seller');

    const draft = await service.createListing(seller, {
      title: 'GPU time block',
      description: 'One reserved compute window for model evaluation.',
      category: 'compute',
      tags: ['gpu', 'benchmark'],
      priceText: '120 city credits',
      priceAmount: 120,
      quantity: 2,
      condition: 'available',
      tradeRoute: 'Meet at market-hall, settle with agreed city credits, then seller transfers access token offline.',
      mediaUrls: ['https://example.test/gpu.png'],
    });
    expect(draft.listing.status).toBe('draft');

    const published = await service.publishListing(seller, { listingId: draft.listing.listingId });
    expect(published.listing.status).toBe('active');

    const results = await service.searchListings({ query: 'GPU', category: 'compute', limit: 10 });
    expect(results.count).toBe(1);
    expect(results.listings[0]).toMatchObject({
      listingId: draft.listing.listingId,
      title: 'GPU time block',
      status: 'active',
      sellerAgentId: 'seller',
      priceText: '120 city credits',
    });
    expect(results.listings[0].description).toBeUndefined();
    expect(results.next).toBe('uruc.fleamarket.get_listing@v1');
  });

  it('requires a trade route because payment and delivery are settled outside the platform', async () => {
    const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket' });

    await expect(service.createListing(session('seller'), {
      title: 'Dataset bundle',
      description: 'Curated text shards.',
      category: 'data',
      priceText: 'offer',
      condition: 'used',
    })).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      details: { field: 'tradeRoute' },
    });
  });
});

describe('FleamarketService trade flow, reputation, and safety', () => {
  it('blocks self-trading and completes a trade only after seller and buyer both confirm', async () => {
    const ctx = createFakeCtx();
    const service = new FleamarketService({ ctx, pluginId: 'uruc.fleamarket' });
    const seller = session('seller');
    const buyer = session('buyer');
    const { listing } = await publishedListing(service, seller);

    await expect(service.openTrade(seller, {
      listingId: listing.listingId,
      quantity: 1,
      openingMessage: 'I want my own listing.',
    })).rejects.toMatchObject({ code: 'SELF_TRADE_NOT_ALLOWED' });

    const opened = await service.openTrade(buyer, {
      listingId: listing.listingId,
      quantity: 1,
      openingMessage: 'Can trade after the next benchmark run.',
    });
    expect(opened.trade.status).toBe('open');

    await expect(service.acceptTrade(buyer, { tradeId: opened.trade.tradeId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const accepted = await service.acceptTrade(seller, { tradeId: opened.trade.tradeId });
    expect(accepted.trade.status).toBe('accepted');

    const buyerConfirmed = await service.confirmTradeSuccess(buyer, { tradeId: opened.trade.tradeId });
    expect(buyerConfirmed.trade.status).toBe('buyer_confirmed');

    const completed = await service.confirmTradeSuccess(seller, { tradeId: opened.trade.tradeId });
    expect(completed.trade.status).toBe('completed');
    expect(completed.trade.confirmations).toEqual(expect.objectContaining({
      buyerConfirmedAt: expect.any(Number),
      sellerConfirmedAt: expect.any(Number),
    }));
    expect(ctx.pushes.some((push) => push.type === 'fleamarket_trade_update')).toBe(true);
  });

  it('allows one review per side after completion and reflects it in reputation', async () => {
    const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket' });
    const seller = session('seller');
    const buyer = session('buyer');
    const { listing } = await publishedListing(service, seller);
    const opened = await service.openTrade(buyer, { listingId: listing.listingId, quantity: 1 });
    await service.acceptTrade(seller, { tradeId: opened.trade.tradeId });
    await service.confirmTradeSuccess(buyer, { tradeId: opened.trade.tradeId });
    await service.confirmTradeSuccess(seller, { tradeId: opened.trade.tradeId });

    const review = await service.createReview(buyer, {
      tradeId: opened.trade.tradeId,
      rating: 5,
      comment: 'Clear route and fast handoff.',
    });
    expect(review.review.revieweeAgentId).toBe('seller');

    await expect(service.createReview(buyer, {
      tradeId: opened.trade.tradeId,
      rating: 4,
    })).rejects.toMatchObject({ code: 'REVIEW_ALREADY_EXISTS' });

    const reputation = await service.getReputationProfile({ agentId: 'seller' });
    expect(reputation.profile).toMatchObject({
      agentId: 'seller',
      completedTrades: 1,
      reviewCount: 1,
      averageRating: 5,
    });
  });

  it('records reports as evidence without changing rating automatically', async () => {
    const service = new FleamarketService({ ctx: createFakeCtx(), pluginId: 'uruc.fleamarket' });
    const seller = session('seller');
    const buyer = session('buyer');
    const { listing } = await publishedListing(service, seller);
    const opened = await service.openTrade(buyer, { listingId: listing.listingId, quantity: 1 });

    const report = await service.createReport(buyer, {
      targetType: 'listing',
      targetId: listing.listingId,
      reasonCode: 'misleading_terms',
      detail: 'The offline route changed after opening the trade.',
      tradeId: opened.trade.tradeId,
    });
    expect(report.report.status).toBe('open');

    const reputation = await service.getReputationProfile({ agentId: 'seller' });
    expect(reputation.profile.reportCount).toBe(1);
    expect(reputation.profile.averageRating).toBeNull();
  });
});
