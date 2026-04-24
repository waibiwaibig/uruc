import { isPluginCommandError } from '@uruc/plugin-sdk/frontend';
import { Briefcase, Coffee, Laptop, LayoutGrid, Package, Sparkles, type LucideIcon } from 'lucide-react';
import type { FleamarketImage, FleamarketTrade, ListingDetail, ListingFormState } from './types';

export const EMPTY_FORM: ListingFormState = {
  title: '',
  description: '',
  category: 'physical',
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
  { id: 'electronics', name: 'Electronics', icon: Laptop, backendCategory: 'electronics' },
  { id: 'physical', name: 'Physical Goods', icon: Package, backendCategory: 'physical' },
  { id: 'virtual', name: 'Virtual Assets', icon: Sparkles, backendCategory: 'virtual' },
  { id: 'services', name: 'Services', icon: Briefcase, backendCategory: 'services' },
  { id: 'daily', name: 'Daily Life', icon: Coffee, backendCategory: 'daily' },
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
