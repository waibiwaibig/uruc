// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { FleamarketHomePage } from '../../../../plugins/fleamarket/frontend/FleamarketHomePage';

function createSessionState(): PluginSessionState {
  return {
    connected: true,
    hasController: true,
    isController: true,
    inCity: true,
    currentLocation: 'uruc.fleamarket.market-hall',
    citytime: Date.now(),
  };
}

function createRuntime(overrides: Partial<PluginRuntimeApi> = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const sendCommand: PluginRuntimeApi['sendCommand'] = async <T,>() => ({} as T);

  const runtime: PluginRuntimeApi = {
    status: 'connected',
    isConnected: true,
    hasController: true,
    isController: true,
    error: '',
    inCity: true,
    currentLocation: 'uruc.fleamarket.market-hall',
    agentId: 'buyer-a',
    agentName: 'Buyer A',
    connect: async () => undefined,
    disconnect: () => undefined,
    claimControl: async () => createSessionState(),
    releaseControl: async () => createSessionState(),
    refreshSessionState: async () => createSessionState(),
    refreshCommands: async () => undefined,
    sendCommand,
    enterCity: async () => createSessionState(),
    leaveCity: async () => undefined,
    enterLocation: async () => undefined,
    leaveLocation: async () => undefined,
    subscribe: (type, listener) => {
      const bucket = listeners.get(type) ?? new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
      return () => {
        bucket.delete(listener);
      };
    },
    reportEvent: () => undefined,
    ...overrides,
  };

  return {
    runtime,
    emit(type: string, payload: unknown) {
      for (const listener of listeners.get(type) ?? []) {
        listener(payload);
      }
    },
  };
}

function createPageData(runtime: PluginRuntimeApi, agent = { id: 'buyer-a', name: 'Buyer A' }): PluginPageData {
  return {
    pluginId: 'uruc.fleamarket',
    runtime,
    user: {
      id: 'user-a',
      username: 'holder',
      role: 'admin',
      email: 'holder@example.com',
      emailVerified: true,
    },
    ownerAgent: {
      id: agent.id,
      name: agent.name,
    },
    connectedAgent: {
      id: agent.id,
      name: agent.name,
    },
    shell: {},
  };
}

async function mountPluginPageDom(pageData: PluginPageData, element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PluginPageContext.Provider value={pageData}>
          {element}
        </PluginPageContext.Provider>
      </MemoryRouter>,
    );
  });

  await settle();

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function settle() {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function clickElement(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

async function inputText(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

async function uploadFiles(input: HTMLInputElement, files: File[]) {
  await act(async () => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: files,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

function findButtonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent?.includes(text));
}

const listingSummary = {
  listingId: 'listing-1',
  title: 'Vector Search Compute Window',
  category: 'compute',
  tags: ['gpu', 'indexing'],
  priceText: '25 USDC per hour',
  priceAmount: 25,
  quantity: 2,
  condition: 'Available tonight',
  status: 'active',
  sellerAgentId: 'seller-a',
  sellerAgentName: 'Seller A',
  updatedAt: 1_700_000_100_000,
  createdAt: 1_700_000_000_000,
  images: [{ assetId: 'asset-1', url: '/api/plugins/uruc.fleamarket/v1/assets/asset-1', mimeType: 'image/png', sizeBytes: 12, status: 'attached', createdAt: 1 }],
};

const listingDetail = {
  ...listingSummary,
  description: 'A short GPU compute slot for vector indexing experiments.',
  sellerUserId: 'seller-user',
  tradeRoute: 'Coordinate USDC payment and SSH handoff in the trade thread.',
  mediaUrls: [],
  imageAssetIds: ['asset-1'],
  closedAt: null,
};

const openedTrade = {
  tradeId: 'trade-1',
  listingId: 'listing-1',
  listingTitle: 'Vector Search Compute Window',
  status: 'open',
  quantity: 1,
  sellerAgentId: 'seller-a',
  sellerAgentName: 'Seller A',
  buyerAgentId: 'buyer-a',
  buyerAgentName: 'Buyer A',
  tradeRouteSnapshot: listingDetail.tradeRoute,
  priceTextSnapshot: listingDetail.priceText,
  confirmations: { buyerConfirmedAt: null, sellerConfirmedAt: null },
  reportCount: 0,
  createdAt: 1_700_000_200_000,
  updatedAt: 1_700_000_200_000,
  completedAt: null,
  cancelledAt: null,
  declinedAt: null,
};

const completedTrade = {
  ...openedTrade,
  tradeId: 'trade-completed',
  status: 'completed',
  confirmations: { buyerConfirmedAt: 1_700_000_230_000, sellerConfirmedAt: 1_700_000_240_000 },
  completedAt: 1_700_000_240_000,
  updatedAt: 1_700_000_240_000,
};

const draftListing = {
  ...listingDetail,
  listingId: 'listing-draft',
  title: 'Draft Dataset',
  status: 'draft',
  updatedAt: 1_700_000_300_000,
};

const submittedReport = {
  reportId: 'report-1',
  reporterAgentId: 'buyer-a',
  reporterAgentName: 'Buyer A',
  targetType: 'listing',
  targetId: 'listing-1',
  targetAgentId: 'seller-a',
  reasonCode: 'safety_review',
  detail: 'Needs review.',
  status: 'open',
  createdAt: 1_700_000_250_000,
  updatedAt: 1_700_000_250_000,
};

describe('FleamarketHomePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let sendCommandMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      asset: {
        assetId: 'asset-uploaded',
        url: '/api/plugins/uruc.fleamarket/v1/assets/asset-uploaded',
        mimeType: 'image/png',
        sizeBytes: 12,
        status: 'temp',
        createdAt: 2,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    sendCommandMock = vi.fn(async (commandId: string, payload?: unknown) => {
      switch (commandId) {
        case 'uruc.fleamarket.search_listings@v1':
          return { count: 1, listings: [listingSummary], hasMore: false, nextCursor: null };
        case 'uruc.fleamarket.get_listing@v1':
          if ((payload as { listingId?: string })?.listingId === 'listing-draft') {
            return {
              listing: draftListing,
              sellerReputation: {
                agentId: 'buyer-a',
                completedTrades: 0,
                activeListings: 1,
                reviewCount: 0,
                averageRating: null,
                reportCount: 0,
              },
            };
          }
          return {
            listing: listingDetail,
            sellerReputation: {
              agentId: 'seller-a',
              completedTrades: 7,
              activeListings: 3,
              reviewCount: 4,
              averageRating: 4.75,
              reportCount: 0,
            },
          };
        case 'uruc.fleamarket.list_reviews@v1':
          return {
            agentId: 'seller-a',
            count: 1,
            reviews: [{
              reviewId: 'review-existing',
              tradeId: 'trade-old',
              listingId: 'listing-old',
              reviewerAgentId: 'buyer-old',
              reviewerAgentName: 'Buyer Old',
              revieweeAgentId: 'seller-a',
              rating: 5,
              comment: 'Clear route and quick handoff.',
              createdAt: 1_700_000_050_000,
              updatedAt: 1_700_000_050_000,
            }],
            hasMore: false,
          };
        case 'uruc.fleamarket.open_trade@v1':
          expect(payload).toMatchObject({ listingId: 'listing-1', quantity: 1 });
          return { ok: true, trade: openedTrade };
        case 'uruc.fleamarket.get_trade@v1':
          if ((payload as { tradeId?: string })?.tradeId === 'trade-completed') {
            return { trade: completedTrade };
          }
          return { trade: openedTrade };
        case 'uruc.fleamarket.get_trade_messages@v1':
          return {
            trade: (payload as { tradeId?: string })?.tradeId === 'trade-completed' ? completedTrade : openedTrade,
            count: 1,
            messages: [{
              messageId: 'message-1',
              tradeId: 'trade-1',
              senderAgentId: 'seller-a',
              senderAgentName: 'Seller A',
              body: 'Still available.',
              createdAt: 1_700_000_210_000,
              updatedAt: 1_700_000_210_000,
            }],
            hasMore: false,
          };
        case 'uruc.fleamarket.list_my_trades@v1':
          return {
            count: 2,
            trades: [
              { ...openedTrade, tradeId: 'trade-1', status: 'open' },
              { ...completedTrade, tradeId: 'trade-completed', status: 'completed' },
            ],
            hasMore: false,
          };
        case 'uruc.fleamarket.accept_trade@v1':
          expect(payload).toEqual({ tradeId: 'trade-1' });
          return { ok: true, trade: { ...openedTrade, status: 'accepted' } };
        case 'uruc.fleamarket.cancel_trade@v1':
          expect(payload).toEqual({ tradeId: 'trade-1' });
          return { ok: true, trade: { ...openedTrade, status: 'cancelled' } };
        case 'uruc.fleamarket.send_trade_message@v1':
          expect(payload).toMatchObject({ tradeId: 'trade-1', body: 'Can we start at 20:00?' });
          return {
            ok: true,
            message: {
              messageId: 'message-2',
              tradeId: 'trade-1',
              senderAgentId: 'buyer-a',
              senderAgentName: 'Buyer A',
              body: 'Can we start at 20:00?',
              createdAt: 1_700_000_220_000,
              updatedAt: 1_700_000_220_000,
            },
          };
        case 'uruc.fleamarket.confirm_trade_success@v1':
          expect(payload).toEqual({ tradeId: 'trade-1' });
          return { ok: true, trade: { ...openedTrade, status: 'buyer_confirmed' } };
        case 'uruc.fleamarket.create_review@v1':
          expect(payload).toEqual({ tradeId: 'trade-completed', rating: 5, comment: 'Clean handoff.' });
          return {
            ok: true,
            review: {
              reviewId: 'trade-completed:buyer-a',
              tradeId: 'trade-completed',
              listingId: 'listing-1',
              reviewerAgentId: 'buyer-a',
              reviewerAgentName: 'Buyer A',
              revieweeAgentId: 'seller-a',
              rating: 5,
              comment: 'Clean handoff.',
              createdAt: 1_700_000_260_000,
              updatedAt: 1_700_000_260_000,
            },
          };
        case 'uruc.fleamarket.create_listing@v1':
          expect(payload).toMatchObject({
            title: 'Fresh Dataset',
            imageAssetIds: ['asset-uploaded'],
            tradeRoute: 'Coordinate delivery in the trade thread.',
          });
          return { ok: true, listing: { ...listingDetail, listingId: 'listing-created', title: 'Fresh Dataset', status: 'draft' } };
        case 'uruc.fleamarket.list_my_listings@v1':
          return {
            count: 2,
            listings: [listingSummary, draftListing],
            hasMore: false,
          };
        case 'uruc.fleamarket.update_listing@v1':
          expect(payload).toMatchObject({
            listingId: 'listing-draft',
            title: 'Edited Dataset',
            tradeRoute: 'Updated offline route.',
          });
          return { ok: true, listing: { ...draftListing, title: 'Edited Dataset', tradeRoute: 'Updated offline route.' } };
        case 'uruc.fleamarket.publish_listing@v1':
          if ((payload as { listingId?: string })?.listingId === 'listing-created') {
            return { ok: true, listing: { ...listingDetail, listingId: 'listing-created', title: 'Fresh Dataset', status: 'active' } };
          }
          expect(payload).toEqual({ listingId: 'listing-draft' });
          return { ok: true, listing: { ...draftListing, status: 'active' } };
        case 'uruc.fleamarket.pause_listing@v1':
          expect(payload).toEqual({ listingId: 'listing-1' });
          return { ok: true, listing: { ...listingDetail, status: 'paused' } };
        case 'uruc.fleamarket.close_listing@v1':
          expect(payload).toEqual({ listingId: 'listing-1' });
          return { ok: true, listing: { ...listingDetail, status: 'closed' } };
        case 'uruc.fleamarket.create_report@v1':
          expect(payload).toMatchObject({
            targetType: 'listing',
            targetId: 'listing-1',
            reasonCode: 'safety_review',
            detail: 'Needs review.',
          });
          return { ok: true, report: submittedReport };
        case 'uruc.fleamarket.list_my_reports@v1':
          return { count: 1, reports: [submittedReport], hasMore: false };
        default:
          return {};
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads listing summaries and opens backend listing detail with reputation and tradeRoute', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.search_listings@v1', { limit: 20 });
    expect(mounted.container.textContent).toContain('Vector Search Compute Window');

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-listing-1"]') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_listing@v1', { listingId: 'listing-1' });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_reviews@v1', { agentId: 'seller-a', limit: 5 });
    expect(mounted.container.textContent).toContain('Coordinate USDC payment and SSH handoff');
    expect(mounted.container.textContent).toContain('4.75');
    expect(mounted.container.textContent).toContain('Clear route and quick handoff.');
    expect(mounted.container.querySelector('img[src="/api/plugins/uruc.fleamarket/v1/assets/asset-1"]')).toBeTruthy();

    await mounted.unmount();
  });

  it('opens a trade, sends a message, and confirms offline completion through backend commands', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-listing-1"]') as Element);
    await clickElement(findButtonByText(mounted.container, 'Open trade') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.open_trade@v1', expect.objectContaining({ listingId: 'listing-1' }));
    expect(mounted.container.textContent).toContain('Still available.');

    const messageInput = mounted.container.querySelector('textarea[aria-label="Trade message"]') as HTMLTextAreaElement;
    await inputText(messageInput, 'Can we start at 20:00?');
    await clickElement(findButtonByText(mounted.container, 'Send') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.send_trade_message@v1', { tradeId: 'trade-1', body: 'Can we start at 20:00?' });
    expect(mounted.container.textContent).toContain('Can we start at 20:00?');

    await mounted.unmount();
  });

  it('uploads selected listing images before create_listing and publishes the draft', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Post listing') as Element);
    await inputText(mounted.container.querySelector('input[name="title"]') as HTMLInputElement, 'Fresh Dataset');
    await inputText(mounted.container.querySelector('textarea[name="description"]') as HTMLTextAreaElement, 'Curated retrieval dataset.');
    await inputText(mounted.container.querySelector('input[name="category"]') as HTMLInputElement, 'data');
    await inputText(mounted.container.querySelector('input[name="priceText"]') as HTMLInputElement, '15 USDC');
    await inputText(mounted.container.querySelector('input[name="condition"]') as HTMLInputElement, 'Ready');
    await inputText(mounted.container.querySelector('textarea[name="tradeRoute"]') as HTMLTextAreaElement, 'Coordinate delivery in the trade thread.');
    await uploadFiles(mounted.container.querySelector('input[type="file"]') as HTMLInputElement, [new File(['image-bytes'], 'dataset.png', { type: 'image/png' })]);
    await clickElement(findButtonByText(mounted.container, 'Create and publish') as Element);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/uruc.fleamarket/v1/assets/listings?agentId=buyer-a',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_listing@v1', expect.objectContaining({
      title: 'Fresh Dataset',
      imageAssetIds: ['asset-uploaded'],
    }));
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.publish_listing@v1', { listingId: 'listing-created' });

    await mounted.unmount();
  });

  it('loads My trades and lets a participant open, accept, cancel, and confirm trades', async () => {
    const { runtime } = createRuntime({ agentId: 'seller-a', agentName: 'Seller A', sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime, { id: 'seller-a', name: 'Seller A' }), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Trades') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_trades@v1', { limit: 20 });
    expect(mounted.container.textContent).toContain('trade-1');
    expect(mounted.container.textContent).toContain('trade-completed');

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-trade-1"]') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_trade@v1', { tradeId: 'trade-1' });
    await clickElement(findButtonByText(mounted.container, 'Accept trade') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.accept_trade@v1', { tradeId: 'trade-1' });
    await clickElement(findButtonByText(mounted.container, 'Confirm success') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.confirm_trade_success@v1', { tradeId: 'trade-1' });
    await clickElement(findButtonByText(mounted.container, 'Cancel trade') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.cancel_trade@v1', { tradeId: 'trade-1' });

    await mounted.unmount();
  });

  it('submits reviews for completed trades from My trades', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Trades') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-trade-completed"]') as Element);
    await inputText(mounted.container.querySelector('input[aria-label="Review rating"]') as HTMLInputElement, '5');
    await inputText(mounted.container.querySelector('textarea[aria-label="Review comment"]') as HTMLTextAreaElement, 'Clean handoff.');
    await clickElement(findButtonByText(mounted.container, 'Submit review') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_review@v1', {
      tradeId: 'trade-completed',
      rating: 5,
      comment: 'Clean handoff.',
    });

    await mounted.unmount();
  });

  it('loads My listings and supports edit, publish, pause, and close actions', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'My listings') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_listings@v1', { limit: 20 });
    expect(mounted.container.textContent).toContain('Draft Dataset');

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-edit-listing-draft"]') as Element);
    await inputText(mounted.container.querySelector('input[name="title"]') as HTMLInputElement, 'Edited Dataset');
    await inputText(mounted.container.querySelector('textarea[name="tradeRoute"]') as HTMLTextAreaElement, 'Updated offline route.');
    await clickElement(findButtonByText(mounted.container, 'Save listing') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.update_listing@v1', expect.objectContaining({
      listingId: 'listing-draft',
      title: 'Edited Dataset',
      tradeRoute: 'Updated offline route.',
    }));

    await clickElement(findButtonByText(mounted.container, 'My listings') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-publish-listing-draft"]') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.publish_listing@v1', { listingId: 'listing-draft' });
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-pause-listing-1"]') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.pause_listing@v1', { listingId: 'listing-1' });
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-close-listing-1"]') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.close_listing@v1', { listingId: 'listing-1' });

    await mounted.unmount();
  });

  it('subscribes to Fleamarket trade pushes and refreshes the active trade or shows an event notice', async () => {
    const runtimeHarness = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtimeHarness.runtime), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Trades') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-trade-1"]') as Element);

    await act(async () => {
      runtimeHarness.emit('fleamarket_trade_message', {
        tradeId: 'trade-1',
        messageId: 'message-push',
        summary: 'A fleamarket trade received a new message.',
      });
    });
    await settle();
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_trade_messages@v1', { tradeId: 'trade-1', limit: 50 });

    await act(async () => {
      runtimeHarness.emit('fleamarket_trade_update', {
        tradeId: 'trade-other',
        status: 'accepted',
        summary: 'A fleamarket trade changed status.',
      });
    });
    await settle();
    expect(mounted.container.textContent).toContain('trade-other');

    await mounted.unmount();
  });

  it('uses a report modal for listing reports and lists submitted reports', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-listing-1"]') as Element);
    await clickElement(findButtonByText(mounted.container, 'Report listing') as Element);
    await inputText(mounted.container.querySelector('input[aria-label="Report reason code"]') as HTMLInputElement, 'safety_review');
    await inputText(mounted.container.querySelector('textarea[aria-label="Report detail"]') as HTMLTextAreaElement, 'Needs review.');
    await clickElement(findButtonByText(mounted.container, 'Submit report') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_report@v1', expect.objectContaining({
      targetType: 'listing',
      targetId: 'listing-1',
      reasonCode: 'safety_review',
      detail: 'Needs review.',
    }));

    await clickElement(findButtonByText(mounted.container, 'Reports') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_reports@v1', { limit: 20 });
    expect(mounted.container.textContent).toContain('report-1');

    await mounted.unmount();
  });
});
