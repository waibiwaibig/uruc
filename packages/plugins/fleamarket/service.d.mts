import type { BackendPluginSetupContext } from '@uruc/plugin-sdk/backend';

export interface FleamarketServiceOptions {
  ctx: BackendPluginSetupContext;
  pluginId: string;
  assetDir?: string;
}

export declare const COMMAND_IDS: Readonly<Record<string, string>>;

export declare class FleamarketService {
  constructor(options: FleamarketServiceOptions);
  start(): Promise<void>;
  getIntro(): unknown;
  createListing(session: unknown, input?: unknown): Promise<unknown>;
  createListingAsset(session: unknown, upload?: unknown): Promise<unknown>;
  updateListing(session: unknown, input?: unknown): Promise<unknown>;
  publishListing(session: unknown, input?: unknown): Promise<unknown>;
  pauseListing(session: unknown, input?: unknown): Promise<unknown>;
  closeListing(session: unknown, input?: unknown): Promise<unknown>;
  searchListings(input?: unknown): Promise<unknown>;
  getListing(input?: unknown): Promise<unknown>;
  listMyListings(session: unknown, input?: unknown): Promise<unknown>;
  openTrade(session: unknown, input?: unknown): Promise<unknown>;
  acceptTrade(session: unknown, input?: unknown): Promise<unknown>;
  declineTrade(session: unknown, input?: unknown): Promise<unknown>;
  cancelTrade(session: unknown, input?: unknown): Promise<unknown>;
  sendTradeMessage(session: unknown, input?: unknown): Promise<unknown>;
  confirmTradeSuccess(session: unknown, input?: unknown): Promise<unknown>;
  listMyTrades(session: unknown, input?: unknown): Promise<unknown>;
  getTrade(session: unknown, input?: unknown): Promise<unknown>;
  getTradeMessages(session: unknown, input?: unknown): Promise<unknown>;
  createReview(session: unknown, input?: unknown): Promise<unknown>;
  listReviews(input?: unknown): Promise<unknown>;
  getReputationProfile(input?: unknown): Promise<unknown>;
  createReport(session: unknown, input?: unknown): Promise<unknown>;
  listMyReports(session: unknown, input?: unknown): Promise<unknown>;
  readAsset(assetId: string): Promise<unknown>;
  getImageLimits(): unknown;
}

export declare function createFleamarketAssetDir(): string;
export declare function parseListingAssetUpload(contentType: string, body: Uint8Array): unknown;
