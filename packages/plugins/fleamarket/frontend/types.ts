export interface FleamarketImage {
  assetId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  status: 'temp' | 'attached' | 'removed' | string;
  createdAt: number;
}

export interface ListingSummary {
  listingId: string;
  title: string;
  category: string;
  tags: string[];
  priceText: string;
  priceAmount: number | null;
  quantity: number;
  condition: string;
  status: 'draft' | 'active' | 'paused' | 'closed' | string;
  sellerAgentId: string;
  sellerAgentName: string;
  updatedAt: number;
  createdAt: number;
  images?: FleamarketImage[];
}

export interface ListingDetail extends ListingSummary {
  description: string;
  sellerUserId?: string;
  tradeRoute: string;
  mediaUrls: string[];
  imageAssetIds: string[];
  closedAt: number | null;
}

export interface ReputationProfile {
  agentId: string;
  completedTrades: number;
  activeListings: number;
  reviewCount: number;
  averageRating: number | null;
  reportCount: number;
}

export interface SearchListingsPayload {
  count: number;
  listings: ListingSummary[];
  hasMore: boolean;
  nextCursor: number | null;
}

export interface ListingDetailPayload {
  listing: ListingDetail;
  sellerReputation: ReputationProfile;
}

export interface FleamarketTrade {
  tradeId: string;
  listingId: string;
  listingTitle: string;
  status: 'open' | 'accepted' | 'buyer_confirmed' | 'seller_confirmed' | 'completed' | 'declined' | 'cancelled' | string;
  quantity: number;
  sellerAgentId: string;
  sellerAgentName?: string;
  buyerAgentId: string;
  buyerAgentName?: string;
  tradeRouteSnapshot?: string;
  priceTextSnapshot?: string;
  confirmations?: {
    buyerConfirmedAt: number | null;
    sellerConfirmedAt: number | null;
  };
  reportCount?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number | null;
  cancelledAt?: number | null;
  declinedAt?: number | null;
}

export type TradeSummary = Pick<
  FleamarketTrade,
  'tradeId' | 'listingId' | 'listingTitle' | 'status' | 'quantity' | 'sellerAgentId' | 'buyerAgentId' | 'updatedAt' | 'createdAt'
>;

export interface FleamarketMessage {
  messageId: string;
  tradeId: string;
  senderAgentId: string;
  senderAgentName: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface TradeMessagesPayload {
  trade: FleamarketTrade;
  count: number;
  messages: FleamarketMessage[];
  hasMore: boolean;
}

export interface UploadedListingAssetPayload {
  ok: true;
  asset: FleamarketImage;
  limits: {
    maxImagesPerListing: number;
    maxBytesPerImage: number;
    allowedMimeTypes: string[];
  };
}

export interface MyListingsPayload {
  count: number;
  listings: ListingSummary[];
  hasMore: boolean;
}

export interface MyTradesPayload {
  count: number;
  trades: TradeSummary[];
  hasMore: boolean;
}

export interface FleamarketReview {
  reviewId: string;
  tradeId: string;
  listingId: string;
  reviewerAgentId: string;
  reviewerAgentName: string;
  revieweeAgentId: string;
  rating: number;
  comment: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewsPayload {
  agentId: string;
  count: number;
  reviews: FleamarketReview[];
  hasMore: boolean;
}

export interface FleamarketReport {
  reportId: string;
  reporterAgentId: string;
  reporterAgentName: string;
  targetType: 'listing' | 'trade' | 'message' | 'agent' | string;
  targetId: string;
  targetAgentId: string | null;
  tradeId?: string | null;
  reasonCode: string;
  detail: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReportsPayload {
  count: number;
  reports: FleamarketReport[];
  hasMore: boolean;
}

export interface ListingFormState {
  title: string;
  description: string;
  category: string;
  tags: string;
  priceText: string;
  priceAmount: string;
  quantity: string;
  condition: string;
  tradeRoute: string;
  mediaUrls: string;
}

export type ReportTarget = {
  targetType: 'listing' | 'trade' | 'message' | 'agent';
  targetId: string;
  tradeId?: string;
  label: string;
};
