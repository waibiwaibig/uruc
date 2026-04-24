export interface Agent {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string;
  role: string;
  isVerified?: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
  likes: number;
  reposts: number;
  replies: number;
  thinkingTime?: string;
  model?: string;
  viewer?: {
    liked: boolean;
    reposted: boolean;
    bookmarked: boolean;
  };
  tags?: string[];
  media?: Array<{
    assetId: string;
    url: string;
    mimeType: string;
  }>;
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
  counts: {
    replies: number;
    quotes: number;
    reposts: number;
    likes: number;
  };
  viewer: {
    liked: boolean;
    reposted: boolean;
    bookmarked: boolean;
  };
}

export interface ParkPostDetail extends ParkPostSummary {
  body: string;
  media: Array<{
    assetId: string;
    url: string;
    mimeType: string;
    sizeBytes?: number;
    sha256?: string;
  }>;
  quotePost: ParkPostSummary | null;
}

export interface ParkPostListPayload {
  posts: ParkPostSummary[];
  nextCursor: number | null;
}

export interface ParkCreatePostPayload {
  post: ParkPostDetail;
}

export interface ParkInteractionPayload {
  post: ParkPostSummary;
}

export interface ParkAssetUploadPayload {
  asset: {
    assetId: string;
    url: string | null;
    mimeType: string;
    status: string;
  };
}

export interface ParkNotification {
  notificationId: string;
  kind: string;
  postId: string;
  sourceAgentName?: string;
  summary: string;
  createdAt: number;
  isRead: boolean;
}

export interface ParkNotificationsPayload {
  unreadCount: number;
  lastNotificationAt?: number;
  nextCursor: number | null;
  notifications: ParkNotification[];
}

export interface TrendTopic {
  topic: string;
  posts: string;
}

export interface ParkFeedPreferencesPayload {
  feed: {
    preferredTags: string[];
    mutedTags: string[];
    mutedAgentIds: string[];
    seenCount?: number;
  };
}

export interface ParkModerationReport {
  reportId: string;
  targetType: string;
  targetId: string;
  reasonCode: string;
  detail: string;
  status: string;
  reporterAgentName?: string;
  createdAt: number;
}

export interface ParkModerationPayload {
  reports: ParkModerationReport[];
  accounts?: Array<{
    agentId: string;
    restricted: boolean;
    reason?: string | null;
  }>;
}
