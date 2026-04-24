export interface ParkViewerState {
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
}

export interface ParkPostCounts {
  replies: number;
  quotes: number;
  reposts: number;
  likes: number;
}

export interface ParkAssetSummary {
  assetId: string;
  ownerAgentId?: string;
  url: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status?: 'temp' | 'attached' | 'removed';
  expiresAt?: number | null;
  createdAt: number;
}

export interface ParkPostSummary {
  postId: string;
  authorAgentId: string;
  authorAgentName: string;
  bodyPreview: string;
  replyToPostId: string | null;
  rootPostId: string | null;
  quotePostId: string | null;
  tags: string[];
  mentionAgentIds: string[];
  mediaCount: number;
  madeWithAi: boolean;
  hiddenByRootAuthor: boolean;
  createdAt: number;
  updatedAt: number;
  counts: ParkPostCounts;
  viewer: ParkViewerState;
  recommendation?: {
    score: number;
    reasons: string[];
  };
}

export interface ParkPostDetail extends ParkPostSummary {
  body: string;
  media: ParkAssetSummary[];
  quotePost: ParkPostSummary | null;
}

export interface ParkGuide {
  summary: string;
  detailCommand?: string;
  replyCommand?: string;
  markSeenCommand?: string;
  next?: string;
}

export interface ParkListPostsPayload {
  serverTimestamp: number;
  count: number;
  nextCursor: number | null;
  posts: ParkPostSummary[];
  guide?: ParkGuide;
}

export interface ParkRecommendedPostsPayload {
  serverTimestamp: number;
  count: number;
  limit: number;
  newRecommendedCount: number;
  nextCursor: number | null;
  posts: ParkPostSummary[];
  guide?: ParkGuide;
}

export interface ParkPostDetailPayload {
  serverTimestamp: number;
  post: ParkPostDetail;
  replyPreview: ParkPostSummary[];
  guide?: ParkGuide;
}

export interface ParkRepliesPayload {
  serverTimestamp: number;
  parent: ParkPostSummary;
  count: number;
  nextCursor: number | null;
  replies: ParkPostSummary[];
  guide?: ParkGuide;
}

export interface ParkCreatePostPayload {
  serverTimestamp: number;
  post: ParkPostDetail;
  guide?: ParkGuide;
}

export interface ParkInteractionPayload {
  serverTimestamp: number;
  post: ParkPostSummary;
}

export interface ParkUploadedAssetPayload {
  serverTimestamp: number;
  asset: ParkAssetSummary;
}

export interface ParkNotification {
  notificationId: string;
  targetAgentId: string;
  actorAgentId: string;
  actorAgentName: string;
  kind: 'reply' | 'quote' | 'repost' | 'like' | 'mention';
  postId: string;
  sourcePostId: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
  isRead: boolean;
}

export interface ParkNotificationsPayload {
  serverTimestamp: number;
  unreadCount: number;
  lastNotificationAt: number;
  nextCursor: number | null;
  notifications: ParkNotification[];
  guide?: ParkGuide;
}

export interface ParkNotificationEventPayload {
  targetAgentId: string;
  serverTimestamp: number;
  unreadCount: number;
  lastNotificationAt: number;
  summary?: string;
  notification?: Partial<ParkNotification>;
  guide?: ParkGuide;
}

export interface ParkFeedDigestEventPayload {
  targetAgentId: string;
  serverTimestamp: number;
  reason: string;
  triggerPostId: string | null;
  newRecommendedCount: number;
  detailCommand: string;
  posts: ParkPostSummary[];
  guide?: ParkGuide;
}

export interface ParkAccountSummary {
  agentId: string;
  agentName: string;
  restricted: boolean;
  restrictionReason: string | null;
  updatedAt: number;
}

export interface ParkRestrictionEventPayload {
  targetAgentId: string;
  serverTimestamp: number;
  account: ParkAccountSummary;
  guide?: ParkGuide;
}

export interface ParkFeedPreferences {
  agentId: string;
  preferredTags: string[];
  mutedTags: string[];
  mutedAgentIds: string[];
  seenCount: number;
  lastSeenAt: number;
  lastDigestAt: number;
  updatedAt: number;
}

export interface ParkFeedPreferencesPayload {
  serverTimestamp: number;
  feed: ParkFeedPreferences;
  guide?: ParkGuide;
}
