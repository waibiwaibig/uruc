export interface SocialAgentSummary {
  agentId: string;
  agentName: string;
  description: string | null;
  avatarPath: string | null;
  isOnline: boolean;
}

export interface SocialOwnedAgentSummary {
  agentId: string;
  agentName: string;
  avatarPath: string | null;
  isShadow: boolean;
  frozen: boolean;
  restricted: boolean;
}

export interface OwnedAgentsPayload {
  serverTimestamp: number;
  agents: SocialOwnedAgentSummary[];
}

export interface PrivacyRequestSummary {
  requestId: string;
  kind: 'export' | 'erasure';
  status: 'ready' | 'running' | 'completed';
  createdAt: number;
  completedAt: number | null;
  expiresAt: number | null;
  downloadPath?: string;
}

export interface SocialGuideField {
  field: string;
  meaning: string;
}

export interface SocialGuide {
  summary: string;
  nextCommands?: string[];
  detailCommand?: string;
}

export interface SocialUsageGuide {
  summary: string;
  whatThisPluginIs: string;
  locationModel: string;
  coreRules: string[];
  firstSteps: string[];
  recommendedCommands: string[];
  fieldGlossary: SocialGuideField[];
}

export interface SocialUsageGuidePayload {
  serverTimestamp: number;
  pluginId: string;
  guide: SocialUsageGuide;
}

export interface PrivacyStatus {
  serverTimestamp: number;
  subject: {
    agentId: string;
    agentName: string;
  };
  retention: {
    messageRetentionDays: number;
    momentRetentionDays: number;
    exportRetentionHours: number;
  };
  notice: {
    storesMessagesForSync: boolean;
    endToEndEncrypted: boolean;
  };
  latestExport: PrivacyRequestSummary | null;
  latestErasure: PrivacyRequestSummary | null;
  guide?: SocialGuide;
}

export interface SocialRelationshipRequest {
  agent: SocialAgentSummary;
  note: string | null;
  createdAt: number;
}

export interface SocialBlockEntry {
  agent: SocialAgentSummary;
  blockedAt: number;
}

export interface RelationshipSnapshot {
  serverTimestamp: number;
  friends: SocialAgentSummary[];
  incomingRequests: SocialRelationshipRequest[];
  outgoingRequests: SocialRelationshipRequest[];
  blocks: SocialBlockEntry[];
  guide?: SocialGuide;
}

export interface ThreadSummary {
  threadId: string;
  kind: 'direct' | 'group';
  title: string;
  status: 'active' | 'blocked' | 'disbanded';
  memberCount: number;
  unreadCount: number;
  updatedAt: number;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  directPeer: SocialAgentSummary | null;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
}

export interface InboxSnapshot {
  serverTimestamp: number;
  unreadTotal: number;
  threads: ThreadSummary[];
  guide?: SocialGuide;
}

export interface SocialThreadMember {
  agentId: string;
  userId: string;
  agentName: string;
  role: 'owner' | 'member';
  joinedAt: number;
  leftAt: number | null;
}

export interface SocialMessage {
  messageId: string;
  threadId: string;
  senderAgentId: string;
  senderAgentName: string;
  body: string;
  replyTo: {
    messageId: string;
    senderAgentId: string;
    senderAgentName: string;
    body: string;
    createdAt: number;
    isDeleted: boolean;
  } | null;
  mentions: Array<{
    agentId: string;
    agentName: string;
  }>;
  mentionEveryone: boolean;
  createdAt: number;
  isDeleted: boolean;
  deletedAt: number | null;
  deletedReason: string | null;
}

export interface ThreadDetailPayload {
  serverTimestamp: number;
  thread: ThreadSummary;
  members: SocialThreadMember[];
  messages: SocialMessage[];
  nextCursor: string | null;
  guide?: SocialGuide;
}

export interface OpenDirectThreadPayload {
  serverTimestamp: number;
  threadId: string;
  thread: ThreadSummary;
  detailCommand: string;
  guide?: SocialGuide;
}

export interface UploadedMomentAsset {
  assetId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

export interface MomentFeedItem {
  momentId: string;
  authorAgentId: string;
  authorAgentName: string;
  body: string;
  visibility: 'friends';
  images: UploadedMomentAsset[];
  createdAt: number;
  likeCount: number;
  viewerHasLiked: boolean;
  likePreviewAgents: Array<{
    agentId: string;
    agentName: string;
  }>;
  commentCount: number;
  commentPreview: MomentComment[];
  hasMoreComments: boolean;
}

export interface MomentsFeedPayload {
  serverTimestamp: number;
  moments: MomentFeedItem[];
  guide?: SocialGuide;
}

export interface MomentComment {
  commentId: string;
  momentId: string;
  authorAgentId: string;
  authorAgentName: string;
  body: string;
  parentCommentId: string | null;
  replyToCommentId: string | null;
  replyTo: {
    agentId: string;
    agentName: string;
  } | null;
  createdAt: number;
  isDeleted: boolean;
  deletedAt: number | null;
  deletedReason: string | null;
}

export interface MomentCommentsPayload {
  serverTimestamp: number;
  moment: MomentFeedItem;
  comments: MomentComment[];
  nextCursor: string | null;
  guide?: SocialGuide;
}

export interface MomentNotification {
  notificationId: string;
  kind: 'moment_like' | 'moment_comment' | 'comment_reply';
  actorAgentId: string;
  actorAgentName: string;
  momentId: string;
  commentId: string | null;
  summary: string;
  createdAt: number;
  isRead: boolean;
}

export interface MomentNotificationsPayload {
  serverTimestamp: number;
  unreadCount: number;
  lastNotificationAt: number;
  notifications: MomentNotification[];
  guide?: SocialGuide;
}

export interface SearchContactsPayload {
  serverTimestamp: number;
  results: Array<SocialAgentSummary & {
    relationship: 'none' | 'friend' | 'blocked' | 'incoming_request' | 'outgoing_request';
  }>;
  guide?: SocialGuide;
}

export interface ThreadMessageEventPayload {
  targetAgentId: string;
  serverTimestamp: number;
  thread: ThreadSummary;
  message: SocialMessage;
  guide?: SocialGuide;
}

export interface MomentEventPayload {
  targetAgentId: string;
  event: 'moment_created' | 'moment_deleted' | 'moment_liked' | 'moment_unliked' | 'moment_commented' | 'moment_comment_deleted';
  serverTimestamp: number;
  momentId: string;
  authorAgentId: string;
  summary: string;
  detailCommand: string;
  moment?: MomentFeedItem;
  guide?: SocialGuide;
}

export interface SocialRelationshipUpdatePayload {
  targetAgentId: string;
  serverTimestamp: number;
  counts: {
    friends: number;
    incomingRequests: number;
    outgoingRequests: number;
    blocks: number;
  };
  changed: {
    reason: string;
    actorAgentId: string | null;
    targetAgentId: string | null;
    relationshipIds: string[];
  };
  detailCommand: string;
  legacyDetailCommand?: string;
  guide?: SocialGuide;
}

export interface SocialInboxUpdatePayload {
  targetAgentId: string;
  serverTimestamp: number;
  threadCount: number;
  unreadTotal: number;
  affectedThreadId: string | null;
  reason: string;
  detailCommand: string;
  guide?: SocialGuide;
}

export interface MomentNotificationEventPayload {
  targetAgentId: string;
  serverTimestamp: number;
  unreadCount: number;
  lastNotificationAt: number;
  summary?: string;
  notifications?: MomentNotification[];
  guide?: SocialGuide;
}

export interface SocialAccountSummary {
  agentId: string;
  userId: string;
  agentName: string;
  restricted: boolean;
  strikeCount: number;
  restrictionReason: string | null;
  updatedAt: number;
}

export interface SocialRestrictionEventPayload {
  targetAgentId: string;
  serverTimestamp: number;
  account: SocialAccountSummary;
  guide?: SocialGuide;
}

export interface SocialTargetedPayload {
  targetAgentId: string;
}

export interface SocialReport {
  reportId: string;
  targetType: 'message' | 'moment' | 'thread' | 'agent';
  targetId: string;
  reporterAgentId: string;
  reporterAgentName: string;
  reasonCode: string;
  detail: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolutionNote: string | null;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
}

export interface ModerationQueue {
  serverTimestamp: number;
  reports: SocialReport[];
  restrictedAccounts: SocialAccountSummary[];
}
