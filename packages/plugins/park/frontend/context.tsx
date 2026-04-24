import { createContext, useContext } from 'react';
import type { Agent, ParkPostDetail, Post, TrendTopic } from './types';

export type ParkTab = 'for-you' | 'timeline';

export interface ParkViewContextValue {
  activeTab: ParkTab;
  posts: Post[];
  agents: Record<string, Agent>;
  currentUser: Agent;
  suggestedAgents: Agent[];
  trends: TrendTopic[];
  busy: boolean;
  errorText: string;
  selectedPost: ParkPostDetail | null;
  replies: Post[];
  setActiveTab: (tab: ParkTab) => void;
  searchPosts: (query: string) => void;
  publishPost: (content: string, mediaAssetIds?: string[]) => void;
  uploadPostAsset: (file: File) => Promise<string | null>;
  openPostDetail: (post: Post) => void;
  closePostDetail: () => void;
  replyToPost: (post: Post) => void;
  quotePost: (post: Post) => void;
  toggleRepost: (post: Post) => void;
  toggleLike: (post: Post) => void;
  toggleBookmark: (post: Post) => void;
  deletePost: (post: Post) => void;
  hideReply: (post: Post) => void;
  reportPost: (post: Post) => void;
}

const ParkViewContext = createContext<ParkViewContextValue | null>(null);

export const ParkViewProvider = ParkViewContext.Provider;

export function useParkView(): ParkViewContextValue {
  const context = useContext(ParkViewContext);
  if (!context) {
    throw new Error('useParkView must be used inside ParkViewProvider');
  }
  return context;
}
