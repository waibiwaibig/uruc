import { isPluginCommandError } from '@uruc/plugin-sdk/frontend';
import { Boxes, Cpu, Database, LayoutGrid, Package, Wrench, type LucideIcon } from 'lucide-react';
import type { FleamarketImage, FleamarketTrade, ListingDetail, ListingFormState } from './types';

export const EMPTY_FORM: ListingFormState = {
  title: '',
  description: '',
  category: 'compute',
  tags: '',
  priceText: '',
  priceAmount: '',
  quantity: '1',
  condition: '',
  tradeRoute: '',
  mediaUrls: '',
};

export const MARKET_CATEGORIES: Array<{ id: string; name: string; icon: LucideIcon; backendCategory?: string }> = [
  { id: 'all', name: 'All Listings', icon: LayoutGrid },
  { id: 'compute', name: 'Compute', icon: Cpu, backendCategory: 'compute' },
  { id: 'data', name: 'Data', icon: Database, backendCategory: 'data' },
  { id: 'tool', name: 'Tools', icon: Wrench, backendCategory: 'tool' },
  { id: 'service', name: 'Services', icon: Boxes, backendCategory: 'service' },
  { id: 'artifact', name: 'Artifacts', icon: Package, backendCategory: 'artifact' },
];

export const CATEGORY_OPTIONS = MARKET_CATEGORIES.map((category) => category.id);
export const NON_TERMINAL_TRADES = new Set(['open', 'accepted', 'buyer_confirmed', 'seller_confirmed']);

export function backendCategoryFor(categoryId: string) {
  return MARKET_CATEGORIES.find((category) => category.id === categoryId)?.backendCategory ?? categoryId;
}

export function getErrorText(error: unknown, fallback: string) {
  if (isPluginCommandError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function initials(name: string) {
  const value = name.trim() || 'Agent';
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function parseCommaList(value: string) {
  return [...new Set(value
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

export function heroImage(images?: FleamarketImage[]) {
  return images?.find((image) => image.url)?.url ?? null;
}

export function isWritableStatus(trade: FleamarketTrade | null) {
  return Boolean(trade && NON_TERMINAL_TRADES.has(trade.status));
}

export function roleForTrade(trade: FleamarketTrade | null, agentId: string | null) {
  if (!trade || !agentId) return null;
  if (trade.sellerAgentId === agentId) return 'seller';
  if (trade.buyerAgentId === agentId) return 'buyer';
  return null;
}

export function formFromListing(listing: ListingDetail): ListingFormState {
  return {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    tags: listing.tags.join(', '),
    priceText: listing.priceText,
    priceAmount: listing.priceAmount === null || listing.priceAmount === undefined ? '' : String(listing.priceAmount),
    quantity: String(listing.quantity),
    condition: listing.condition,
    tradeRoute: listing.tradeRoute,
    mediaUrls: listing.mediaUrls.join(', '),
  };
}
