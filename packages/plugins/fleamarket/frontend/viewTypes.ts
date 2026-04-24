import type { LucideIcon } from 'lucide-react';

export type MarketCategory = {
  id: string;
  name: string;
  icon: LucideIcon;
};

export type MarketItem = {
  id: string;
  title: string;
  description: string;
  priceText: string;
  seller: string;
  sellerAvatar: string;
  sellerRating: number;
  completedTrades: number;
  category: string;
  tags: string[];
  imageUrl: string | null;
  condition: string;
  quantity: number;
  status: string;
};
