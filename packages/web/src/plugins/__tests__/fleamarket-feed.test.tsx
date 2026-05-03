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
    hasActionLease: true,
    isActionLeaseHolder: true,
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
    hasActionLease: true,
    isActionLeaseHolder: true,
    error: '',
    inCity: true,
    currentLocation: 'uruc.fleamarket.market-hall',
    agentId: 'buyer-a',
    agentName: 'Buyer A',
    connect: async () => undefined,
    disconnect: () => undefined,
    acquireActionLease: async () => createSessionState(),
    releaseActionLease: async () => createSessionState(),
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
    shell: {
      notify: vi.fn(),
    },
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

async function selectValue(element: HTMLSelectElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
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

async function openUserMenu(container: HTMLElement) {
  await clickElement(container.querySelector('button[aria-label="Open Fleamarket account menu"]') as Element);
}

async function openNoticeMenu(container: HTMLElement) {
  await clickElement(container.querySelector('button[aria-label="Fleamarket notifications"]') as Element);
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
          if ((payload as { sellerAgentId?: string })?.sellerAgentId === 'seller-a') {
            return { count: 1, listings: [{ ...listingSummary, listingId: 'seller-listing-2', title: 'Seller Backup Slot' }], hasMore: false, nextCursor: null };
          }
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
          if ((payload as { limit?: number })?.limit && (payload as { limit?: number }).limit > 5) {
            return {
              agentId: 'seller-a',
              count: 2,
              reviews: [
                {
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
                },
                {
                  reviewId: 'review-older',
                  tradeId: 'trade-older',
                  listingId: 'listing-older',
                  reviewerAgentId: 'buyer-older',
                  reviewerAgentName: 'Buyer Older',
                  revieweeAgentId: 'seller-a',
                  rating: 4,
                  comment: 'Easy coordination.',
                  createdAt: 1_700_000_040_000,
                  updatedAt: 1_700_000_040_000,
                },
              ],
              hasMore: false,
            };
          }
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
            hasMore: true,
          };
        case 'uruc.fleamarket.get_reputation_profile@v1':
          return {
            agentId: 'seller-a',
            completedTrades: 7,
            activeListings: 3,
            reviewCount: 4,
            averageRating: 4.75,
            reportCount: 0,
          };
        case 'uruc.fleamarket.open_trade@v1':
          expect(payload).toMatchObject({
            listingId: 'listing-1',
            quantity: 2,
            openingMessage: 'Can start with two hours?',
          });
          return { ok: true, trade: openedTrade };
        case 'uruc.fleamarket.get_trade@v1':
          if ((payload as { tradeId?: string })?.tradeId === 'trade-completed') {
            return { trade: completedTrade };
          }
          return { trade: openedTrade };
        case 'uruc.fleamarket.get_trade_messages@v1':
          if ((payload as { beforeCreatedAt?: number })?.beforeCreatedAt) {
            return {
              trade: openedTrade,
              count: 1,
              messages: [{
                messageId: 'message-older',
                tradeId: 'trade-1',
                senderAgentId: 'buyer-a',
                senderAgentName: 'Buyer A',
                body: 'Earlier route question.',
                createdAt: 1_700_000_205_000,
                updatedAt: 1_700_000_205_000,
              }],
              hasMore: false,
            };
          }
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
            hasMore: (payload as { tradeId?: string })?.tradeId === 'trade-1',
          };
        case 'uruc.fleamarket.list_my_trades@v1':
          if ((payload as { beforeUpdatedAt?: number })?.beforeUpdatedAt) {
            return {
              count: 1,
              trades: [{ ...openedTrade, tradeId: 'trade-older', status: 'open', updatedAt: 1_700_000_100_000 }],
              hasMore: false,
              nextCursor: null,
            };
          }
          return {
            count: 2,
            trades: [
              { ...openedTrade, tradeId: 'trade-1', status: 'open' },
              { ...completedTrade, tradeId: 'trade-completed', status: 'completed' },
            ],
            hasMore: true,
            nextCursor: 1_700_000_190_000,
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
          if ((payload as { title?: string })?.title === 'Draft Dataset') {
            expect(payload).toMatchObject({
              title: 'Draft Dataset',
              tradeRoute: 'Coordinate later.',
            });
            return { ok: true, listing: { ...listingDetail, listingId: 'listing-draft-created', title: 'Draft Dataset', status: 'draft' } };
          }
          expect(payload).toMatchObject({
            title: 'Fresh Dataset',
            category: 'data-coop',
            imageAssetIds: ['asset-uploaded'],
            tradeRoute: 'Coordinate delivery in the trade thread.',
          });
          return { ok: true, listing: { ...listingDetail, listingId: 'listing-created', title: 'Fresh Dataset', status: 'draft' } };
        case 'uruc.fleamarket.list_my_listings@v1':
          if ((payload as { beforeUpdatedAt?: number })?.beforeUpdatedAt) {
            return {
              count: 1,
              listings: [{ ...draftListing, listingId: 'listing-older', title: 'Older Draft', updatedAt: 1_700_000_200_000 }],
              hasMore: false,
              nextCursor: null,
            };
          }
          return {
            count: 2,
            listings: [listingSummary, draftListing],
            hasMore: true,
            nextCursor: 1_700_000_250_000,
          };
        case 'uruc.fleamarket.update_listing@v1':
          expect(payload).toMatchObject({
            listingId: 'listing-draft',
            title: 'Edited Dataset',
            tradeRoute: 'Updated offline route.',
            imageAssetIds: ['asset-uploaded'],
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
          expect(payload).toEqual(expect.objectContaining({ targetAgentId: expect.any(String) }));
          return { ok: true, report: submittedReport };
        case 'uruc.fleamarket.list_my_reports@v1':
          if ((payload as { beforeUpdatedAt?: number })?.beforeUpdatedAt) {
            return { count: 0, reports: [], hasMore: false, nextCursor: null };
          }
          return { count: 1, reports: [submittedReport], hasMore: true, nextCursor: 1_700_000_240_000 };
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

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.search_listings@v1', { limit: 20, sortBy: 'latest' });
    expect(mounted.container.querySelector('header.sticky')).toBeTruthy();
    expect(mounted.container.textContent).toContain('uruc | fleamarket');
    expect(mounted.container.textContent).toContain('Discover, trade, and connect.');
    expect(mounted.container.textContent).toContain('All Listings');
    expect(mounted.container.textContent).toContain('Compute');
    expect(mounted.container.textContent).toContain('Data');
    expect(mounted.container.textContent).toContain('Tools');
    expect(mounted.container.querySelector('section.bg-white.rounded-3xl')).toBeTruthy();
    expect(mounted.container.querySelector('[data-testid="fleamarket-listing-grid"]')).toBeTruthy();
    expect(mounted.container.querySelector('.fleamarket-tabs')).toBeFalsy();
    expect(mounted.container.querySelector('.fleamarket-hero__stats')).toBeFalsy();
    expect(mounted.container.querySelector('.fleamarket-topbar')).toBeFalsy();
    expect(mounted.container.textContent).not.toContain('coordinate offline settlement');
    expect(mounted.container.textContent).toContain('Vector Search Compute Window');

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-listing-1"]') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_listing@v1', { listingId: 'listing-1' });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_reputation_profile@v1', { agentId: 'seller-a' });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_reviews@v1', { agentId: 'seller-a', limit: 5 });
    expect(mounted.container.textContent).toContain('Coordinate USDC payment and SSH handoff');
    expect(mounted.container.textContent).toContain('4.75');
    expect(mounted.container.textContent).toContain('Clear route and quick handoff.');
    expect(mounted.container.querySelector('img[src="/api/plugins/uruc.fleamarket/v1/assets/asset-1"]')).toBeTruthy();
    expect(findButtonByText(mounted.container, 'Refresh profile')).toBeTruthy();

    await clickElement(findButtonByText(mounted.container, 'Refresh profile') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_reputation_profile@v1', { agentId: 'seller-a' });
    await clickElement(findButtonByText(mounted.container, 'View more reviews') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_reviews@v1', { agentId: 'seller-a', limit: 20 });
    await clickElement(findButtonByText(mounted.container, 'View seller listings') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.search_listings@v1', {
      limit: 20,
      sortBy: 'latest',
      sellerAgentId: 'seller-a',
    });

    await mounted.unmount();
  });

  it('passes category chips and sort selection through to backend search', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Compute') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.search_listings@v1', {
      limit: 20,
      category: 'compute',
      sortBy: 'latest',
    });

    await selectValue(mounted.container.querySelector('select[aria-label="Sort listings"]') as HTMLSelectElement, 'priceLow');
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.search_listings@v1', {
      limit: 20,
      category: 'compute',
      sortBy: 'price_asc',
    });

    await mounted.unmount();
  });

  it('opens a trade, sends a message, and confirms offline completion through backend commands', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-listing-1"]') as Element);
    await inputText(mounted.container.querySelector('input[aria-label="Trade quantity"]') as HTMLInputElement, '2');
    await inputText(mounted.container.querySelector('textarea[aria-label="Opening trade message"]') as HTMLTextAreaElement, 'Can start with two hours?');
    await clickElement(findButtonByText(mounted.container, 'Open trade') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.open_trade@v1', {
      listingId: 'listing-1',
      quantity: 2,
      openingMessage: 'Can start with two hours?',
    });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_listing@v1', { listingId: 'listing-1' });
    expect(mounted.container.textContent).toContain('Still available.');
    expect(mounted.container.textContent).toContain('Both-side confirmation');
    expect(mounted.container.textContent).not.toContain('Payment Sent');
    expect(mounted.container.textContent).not.toContain('escrow');

    await clickElement(findButtonByText(mounted.container, 'Load earlier messages') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.get_trade_messages@v1', {
      tradeId: 'trade-1',
      limit: 50,
      beforeCreatedAt: 1_700_000_210_000,
    });
    expect(mounted.container.textContent).toContain('Earlier route question.');

    const messageInput = mounted.container.querySelector('input[aria-label="Trade message"]') as HTMLInputElement;
    await inputText(messageInput, 'Can we start at 20:00?');
    await clickElement(mounted.container.querySelector('button[aria-label="Send"]') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.send_trade_message@v1', { tradeId: 'trade-1', body: 'Can we start at 20:00?' });
    expect(mounted.container.textContent).toContain('Can we start at 20:00?');

    await mounted.unmount();
  });

  it('uploads selected listing images before create_listing and publishes the draft', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const pageData = createPageData(runtime);
    const notify = vi.fn();
    pageData.shell.notify = notify;
    const mounted = await mountPluginPageDom(pageData, <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Post an Item') as Element);
    await inputText(mounted.container.querySelector('input[name="title"]') as HTMLInputElement, 'Fresh Dataset');
    await inputText(mounted.container.querySelector('textarea[name="description"]') as HTMLTextAreaElement, 'Curated retrieval dataset.');
    await selectValue(mounted.container.querySelector('select[name="categoryPreset"]') as HTMLSelectElement, 'custom');
    await inputText(mounted.container.querySelector('input[name="category"]') as HTMLInputElement, 'data-coop');
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
      category: 'data-coop',
      imageAssetIds: ['asset-uploaded'],
    }));
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.publish_listing@v1', { listingId: 'listing-created' });
    expect(notify).toHaveBeenCalledWith({ type: 'success', message: 'Listing created and published.' });

    await mounted.unmount();
  });

  it('saves a draft listing without publishing it immediately', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Post an Item') as Element);
    await inputText(mounted.container.querySelector('input[name="title"]') as HTMLInputElement, 'Draft Dataset');
    await inputText(mounted.container.querySelector('textarea[name="description"]') as HTMLTextAreaElement, 'Still in progress.');
    await inputText(mounted.container.querySelector('textarea[name="tradeRoute"]') as HTMLTextAreaElement, 'Coordinate later.');
    await clickElement(findButtonByText(mounted.container, 'Save draft') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_listing@v1', expect.objectContaining({
      title: 'Draft Dataset',
      tradeRoute: 'Coordinate later.',
    }));
    expect(sendCommandMock.mock.calls.some(([commandId]) => commandId === 'uruc.fleamarket.publish_listing@v1')).toBe(false);
    expect(mounted.container.textContent).toContain('My listings');
    expect(mounted.container.textContent).toContain('Draft Dataset');

    await mounted.unmount();
  });

  it('explains why read-only agents cannot post listings', async () => {
    const { runtime } = createRuntime({
      hasActionLease: true,
      isActionLeaseHolder: false,
      sendCommand: sendCommandMock,
    });
    const pageData = createPageData(runtime);
    const notify = vi.fn();
    pageData.shell.notify = notify;
    const mounted = await mountPluginPageDom(pageData, <FleamarketHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Post an Item') as Element);

    expect(notify).toHaveBeenCalledWith({
      type: 'error',
      message: 'Acquire the action lease before posting a listing.',
    });
    expect(mounted.container.querySelector('input[name="title"]')).toBeFalsy();

    await mounted.unmount();
  });

  it('loads My trades and lets a participant open, accept, cancel, and confirm trades', async () => {
    const { runtime } = createRuntime({ agentId: 'seller-a', agentName: 'Seller A', sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime, { id: 'seller-a', name: 'Seller A' }), <FleamarketHomePage />);

    await openUserMenu(mounted.container);
    await clickElement(findButtonByText(mounted.container, 'My trades') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_trades@v1', { limit: 20 });
    expect(mounted.container.textContent).toContain('trade-1');
    expect(mounted.container.textContent).toContain('trade-completed');

    await selectValue(mounted.container.querySelector('select[name="tradeStatus"]') as HTMLSelectElement, 'open');
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_trades@v1', { limit: 20, status: 'open' });
    await clickElement(findButtonByText(mounted.container, 'Load more') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_trades@v1', {
      limit: 20,
      status: 'open',
      beforeUpdatedAt: 1_700_000_190_000,
    });

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

    await openUserMenu(mounted.container);
    await clickElement(findButtonByText(mounted.container, 'My trades') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-trade-completed"]') as Element);
    await clickElement(mounted.container.querySelector('button[aria-label="Rate 5"]') as Element);
    await inputText(mounted.container.querySelector('textarea[aria-label="Review comment"]') as HTMLTextAreaElement, 'Clean handoff.');
    await clickElement(findButtonByText(mounted.container, 'Submit review') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_review@v1', {
      tradeId: 'trade-completed',
      rating: 5,
      comment: 'Clean handoff.',
    });
    expect(mounted.container.textContent).toContain('Review submitted.');

    await mounted.unmount();
  });

  it('loads My listings and supports edit, publish, pause, and close actions', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await openUserMenu(mounted.container);
    await clickElement(findButtonByText(mounted.container, 'My listings') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_listings@v1', { limit: 20 });
    expect(mounted.container.textContent).toContain('Draft Dataset');

    await selectValue(mounted.container.querySelector('select[name="listingStatus"]') as HTMLSelectElement, 'draft');
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_listings@v1', { limit: 20, status: 'draft' });
    await clickElement(findButtonByText(mounted.container, 'Load more') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_listings@v1', {
      limit: 20,
      status: 'draft',
      beforeUpdatedAt: 1_700_000_250_000,
    });

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-edit-listing-draft"]') as Element);
    expect(mounted.container.textContent).toContain('Keep attached images');
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-remove-image-asset-1"]') as Element);
    await uploadFiles(mounted.container.querySelector('input[type="file"]') as HTMLInputElement, [new File(['new-image'], 'edited.png', { type: 'image/png' })]);
    await inputText(mounted.container.querySelector('input[name="title"]') as HTMLInputElement, 'Edited Dataset');
    await inputText(mounted.container.querySelector('textarea[name="tradeRoute"]') as HTMLTextAreaElement, 'Updated offline route.');
    await clickElement(findButtonByText(mounted.container, 'Save listing') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.update_listing@v1', expect.objectContaining({
      listingId: 'listing-draft',
      title: 'Edited Dataset',
      tradeRoute: 'Updated offline route.',
      imageAssetIds: ['asset-uploaded'],
    }));

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

    await openUserMenu(mounted.container);
    await clickElement(findButtonByText(mounted.container, 'My trades') as Element);
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
      runtimeHarness.emit('fleamarket_trade_message', {
        tradeId: 'trade-third',
        messageId: 'message-third',
        summary: 'A fleamarket trade received a new message.',
      });
    });
    await settle();
    await openNoticeMenu(mounted.container);
    expect(mounted.container.textContent).toContain('trade-other');
    expect(mounted.container.textContent).toContain('trade-third');

    await mounted.unmount();
  });

  it('uses a report modal for listing reports and lists submitted reports', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <FleamarketHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-listing-1"]') as Element);
    await clickElement(findButtonByText(mounted.container, 'Report Listing') as Element);
    await selectValue(mounted.container.querySelector('select[aria-label="Report reason code"]') as HTMLSelectElement, 'safety_review');
    await inputText(mounted.container.querySelector('textarea[aria-label="Report detail"]') as HTMLTextAreaElement, 'Needs review.');
    await clickElement(findButtonByText(mounted.container, 'Submit report') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_report@v1', expect.objectContaining({
      targetType: 'listing',
      targetId: 'listing-1',
      targetAgentId: 'seller-a',
      reasonCode: 'safety_review',
      detail: 'Needs review.',
    }));

    await openUserMenu(mounted.container);
    await clickElement(findButtonByText(mounted.container, 'My trades') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="fleamarket-open-trade-1"]') as Element);
    await clickElement(findButtonByText(mounted.container, 'File a Report') as Element);
    await selectValue(mounted.container.querySelector('select[aria-label="Report reason code"]') as HTMLSelectElement, 'no_show');
    await inputText(mounted.container.querySelector('textarea[aria-label="Report detail"]') as HTMLTextAreaElement, 'Counterparty missed the route.');
    await clickElement(findButtonByText(mounted.container, 'Submit report') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.create_report@v1', expect.objectContaining({
      targetType: 'trade',
      targetId: 'trade-1',
      targetAgentId: 'seller-a',
      reasonCode: 'no_show',
      detail: 'Counterparty missed the route.',
    }));

    await openUserMenu(mounted.container);
    await clickElement(findButtonByText(mounted.container, 'My reports') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_reports@v1', { limit: 20 });
    await clickElement(findButtonByText(mounted.container, 'Load more') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.fleamarket.list_my_reports@v1', {
      limit: 20,
      beforeUpdatedAt: 1_700_000_240_000,
    });
    expect(mounted.container.textContent).toContain('report-1');

    await mounted.unmount();
  });
});
