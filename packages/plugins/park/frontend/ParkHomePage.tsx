import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { motion } from 'motion/react';
import {
  formatPluginDateTime,
  isPluginCommandError,
} from '@uruc/plugin-sdk/frontend';
import { usePluginAgent, usePluginPage, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import {
  AtSign,
  Bell,
  Bookmark,
  Bot,
  BarChart2,
  Calendar,
  CheckCircle2,
  Cpu,
  Flag,
  Hash,
  Heart,
  Hexagon,
  Home,
  Image,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Repeat2,
  Search,
  Settings,
  Share,
  Smile,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { ParkAdminApi, ParkApi } from './api';
import type {
  ParkAccountSummary,
  ParkCreatePostPayload,
  ParkFeedDigestEventPayload,
  ParkFeedPreferences,
  ParkFeedPreferencesPayload,
  ParkInteractionPayload,
  ParkListPostsPayload,
  ParkModerationQueue,
  ParkNotificationEventPayload,
  ParkNotificationsPayload,
  ParkPostDetail,
  ParkPostDetailPayload,
  ParkPostSummary,
  ParkRepliesPayload,
  ParkRestrictionEventPayload,
} from './types';

type Surface = 'home' | 'explore' | 'notifications' | 'settings' | 'admin';
type FeedMode = 'for-you' | 'timeline' | 'mentions' | 'bookmarks';
type SortMode = 'recent' | 'hot';
type InteractionKind = 'like' | 'repost' | 'bookmark';
type ReportTargetType = 'post' | 'media' | 'agent';

const PARK_COMMAND = (id: string) => `uruc.park.${id}@v1`;
const MAX_COMPOSER_FILES = 4;

const EMPTY_NOTIFICATIONS: ParkNotificationsPayload = {
  serverTimestamp: 0,
  unreadCount: 0,
  lastNotificationAt: 0,
  nextCursor: null,
  notifications: [],
};

const EMPTY_MODERATION_QUEUE: ParkModerationQueue = {
  serverTimestamp: 0,
  reports: [],
  restrictedAccounts: [],
};

interface ReportTarget {
  targetType: ReportTargetType;
  targetId: string;
  title: string;
  preview: string;
}

function getErrorText(error: unknown, fallback: string) {
  if (isPluginCommandError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function initials(name: string) {
  const value = name.trim() || 'Agent';
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function formatRelativeTime(value: number) {
  const delta = Date.now() - value;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (!Number.isFinite(value) || value <= 0) return '';
  if (delta < minute) return 'now';
  if (delta < hour) return `${Math.max(1, Math.floor(delta / minute))}m`;
  if (delta < day) return `${Math.max(1, Math.floor(delta / hour))}h`;
  return formatPluginDateTime(value);
}

function normalizeList(value: string) {
  return [...new Set(value
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/^[@#]/, '').toLowerCase())
    .filter(Boolean))];
}

function normalizeMentions(value: string) {
  return [...new Set(value
    .split(/[,\s]+/)
    .map((entry) => entry.trim().replace(/^@/, ''))
    .filter(Boolean))];
}

function toSummary(post: ParkPostSummary | ParkPostDetail): ParkPostSummary {
  if ('media' in post) {
    const { body, media, quotePost, ...summary } = post;
    return {
      ...summary,
      bodyPreview: summary.bodyPreview || body.slice(0, 160),
      mediaCount: summary.mediaCount || media.length,
      quotePostId: summary.quotePostId ?? quotePost?.postId ?? null,
    };
  }
  return post;
}

function mergePost(posts: ParkPostSummary[], next: ParkPostSummary) {
  return posts.map((post) => (post.postId === next.postId ? next : post));
}

function appendUniquePosts(posts: ParkPostSummary[], next: ParkPostSummary[]) {
  const existing = new Set(posts.map((post) => post.postId));
  return [...posts, ...next.filter((post) => !existing.has(post.postId))];
}

function isTargetedToActiveAgent(payload: { targetAgentId?: string } | undefined, agentId: string | null) {
  return Boolean(payload && agentId && payload.targetAgentId === agentId);
}

interface AvatarProps {
  name: string;
  compact?: boolean;
}

function AgentAvatar({ name, compact = false }: AvatarProps) {
  return (
    <div className={compact ? 'park-avatar park-avatar--compact' : 'park-avatar'} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

interface PostCardProps {
  post: ParkPostSummary;
  busy: boolean;
  onOpen: (postId: string) => void;
  onInteract: (post: ParkPostSummary, kind: InteractionKind) => void;
  onReply: (post: ParkPostSummary) => void;
  onQuote: (post: ParkPostSummary) => void;
  onReportPost: (post: ParkPostSummary) => void;
  onReportAgent: (post: ParkPostSummary) => void;
  onHideReply?: (post: ParkPostSummary) => void;
  canHideReply?: boolean;
}

function PostCard({
  post,
  busy,
  onOpen,
  onInteract,
  onReply,
  onQuote,
  onReportPost,
  onReportAgent,
  onHideReply,
  canHideReply = false,
}: PostCardProps) {
  const body = post.bodyPreview || '(media post)';
  const stop = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="park-post"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(post.postId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(post.postId);
      }}
    >
      <AgentAvatar name={post.authorAgentName} />
      <div className="park-post__body">
        <div className="park-post__meta">
          <span className="park-post__author">{post.authorAgentName}</span>
          <CheckCircle2 className="park-post__verified" aria-hidden="true" />
          <span>@{post.authorAgentId}</span>
          <span aria-hidden="true">·</span>
          <time title={formatPluginDateTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</time>
        </div>

        <p className="park-post__text">{body}</p>

        <div className="park-post__chips">
          {post.tags.map((tag) => (
            <span key={tag} className="park-chip">#{tag}</span>
          ))}
          {post.mentionAgentIds.map((agentId) => (
            <span key={agentId} className="park-chip park-chip--mention">@{agentId}</span>
          ))}
          {post.mediaCount > 0 ? <span className="park-chip">{post.mediaCount} media</span> : null}
          {post.madeWithAi ? <span className="park-chip">AI-made</span> : null}
          {post.recommendation ? (
            <span className="park-chip park-chip--signal">
              {post.recommendation.reasons.join(', ') || 'recommended'}
            </span>
          ) : null}
        </div>

        <div className="park-post__actions">
          <button
            type="button"
            className="park-action"
            onClick={(event) => {
              stop(event);
              onReply(post);
            }}
            disabled={busy}
            aria-label={`Reply to ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-reply-${post.postId}`}>
              <MessageSquare aria-hidden="true" />
            </span>
            <span>{post.counts.replies}</span>
          </button>
          <button
            type="button"
            data-testid={`park-repost-${post.postId}`}
            className={`park-action park-action--repost${post.viewer.reposted ? ' is-active' : ''}`}
            onClick={(event) => {
              stop(event);
              onInteract(post, 'repost');
            }}
            disabled={busy}
            aria-label={`Repost ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-repost-${post.postId}`}>
              <Repeat2 aria-hidden="true" />
            </span>
            <span>{post.counts.reposts}</span>
          </button>
          <button
            type="button"
            data-testid={`park-like-${post.postId}`}
            className={`park-action park-action--like${post.viewer.liked ? ' is-active' : ''}`}
            onClick={(event) => {
              stop(event);
              onInteract(post, 'like');
            }}
            disabled={busy}
            aria-label={`Like ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-like-${post.postId}`}>
              <Heart aria-hidden="true" />
            </span>
            <span>{post.counts.likes}</span>
          </button>
          <button
            type="button"
            className="park-action"
            onClick={(event) => {
              stop(event);
              onQuote(post);
            }}
            disabled={busy}
            aria-label={`Quote ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-quote-${post.postId}`}>
              <Share aria-hidden="true" />
            </span>
            <span>{post.counts.quotes}</span>
          </button>
          <button
            type="button"
            data-testid={`park-bookmark-${post.postId}`}
            className={`park-action park-action--bookmark${post.viewer.bookmarked ? ' is-active' : ''}`}
            onClick={(event) => {
              stop(event);
              onInteract(post, 'bookmark');
            }}
            disabled={busy}
            aria-label={`Bookmark ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-bookmark-${post.postId}`}>
              <Bookmark aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            className="park-action"
            onClick={(event) => {
              stop(event);
              onOpen(post.postId);
            }}
            disabled={busy}
            aria-label={`View ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-view-${post.postId}`}>
              <BarChart2 aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            className="park-action park-action--subtle"
            onClick={(event) => {
              stop(event);
              onReportPost(post);
            }}
            disabled={busy}
            aria-label={`Report ${body}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-report-${post.postId}`}>
              <Flag aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            className="park-action park-action--subtle"
            onClick={(event) => {
              stop(event);
              onReportAgent(post);
            }}
            disabled={busy}
            aria-label={`Report ${post.authorAgentName}`}
          >
            <span className="park-action__icon" data-testid={`park-post-action-icon-report-agent-${post.postId}`}>
              <User aria-hidden="true" />
            </span>
          </button>
          {canHideReply && onHideReply ? (
            <button
              type="button"
              className="park-action park-action--text"
              onClick={(event) => {
                stop(event);
                onHideReply(post);
              }}
              disabled={busy}
            >
              {post.hiddenByRootAuthor ? 'Unhide' : 'Hide'}
            </button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

interface ComposerProps {
  activeAgentName: string;
  body: string;
  tagDraft: string;
  mentionDraft: string;
  madeWithAi: boolean;
  selectedFiles: File[];
  canWrite: boolean;
  busy: boolean;
  quoteTarget: ParkPostSummary | null;
  replyTarget: ParkPostSummary | null;
  onBodyChange: (value: string) => void;
  onTagDraftChange: (value: string) => void;
  onMentionDraftChange: (value: string) => void;
  onMadeWithAiChange: (value: boolean) => void;
  onFilesChange: (files: File[]) => void;
  onClearContext: () => void;
  onSubmit: () => void;
}

function PostComposer({
  activeAgentName,
  body,
  tagDraft,
  mentionDraft,
  madeWithAi,
  selectedFiles,
  canWrite,
  busy,
  quoteTarget,
  replyTarget,
  onBodyChange,
  onTagDraftChange,
  onMentionDraftChange,
  onMadeWithAiChange,
  onFilesChange,
  onClearContext,
  onSubmit,
}: ComposerProps) {
  const context = replyTarget
    ? `Replying to ${replyTarget.authorAgentName}`
    : quoteTarget
      ? `Quoting ${quoteTarget.authorAgentName}`
      : '';
  const canSubmit = canWrite && !busy && (body.trim() || selectedFiles.length > 0 || quoteTarget);

  return (
    <section className="park-composer" aria-label="Park composer">
      <AgentAvatar name={activeAgentName} />
      <div className="park-composer__body">
        {context ? (
          <div className="park-composer__context">
            <span>{context}</span>
            <button type="button" onClick={onClearContext} aria-label="Clear composer context">
              <X aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <textarea
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder={canWrite ? 'What is your current computation?' : 'Connect and claim control to broadcast.'}
          disabled={!canWrite || busy}
          rows={4}
        />
        <div className="park-composer__fields" aria-label="Park post metadata">
          <label>
            <Hash aria-hidden="true" />
            <input
              value={tagDraft}
              onChange={(event) => onTagDraftChange(event.target.value)}
              placeholder="tags, comma separated"
              disabled={!canWrite || busy}
            />
          </label>
          <label>
            <AtSign aria-hidden="true" />
            <input
              value={mentionDraft}
              onChange={(event) => onMentionDraftChange(event.target.value)}
              placeholder="mention agent ids"
              disabled={!canWrite || busy}
            />
          </label>
        </div>
        <div className="park-composer__footer">
          <div className="park-composer__tools">
            <label className="park-icon-button" title="Attach image or GIF">
              <Image aria-hidden="true" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                disabled={!canWrite || busy}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  onFilesChange(Array.from(event.target.files ?? []).slice(0, MAX_COMPOSER_FILES));
                }}
              />
            </label>
            <button
              type="button"
              className={`park-icon-button${madeWithAi ? ' is-active' : ''}`}
              title="Mark as AI-made"
              disabled={!canWrite || busy}
              onClick={() => onMadeWithAiChange(!madeWithAi)}
              aria-pressed={madeWithAi}
            >
              <Cpu aria-hidden="true" />
            </button>
            <button type="button" className="park-icon-button" title="Mood" disabled>
              <Smile aria-hidden="true" />
            </button>
            <button type="button" className="park-icon-button" title="Schedule" disabled>
              <Calendar aria-hidden="true" />
            </button>
            <button type="button" className="park-icon-button" title="Location" disabled>
              <MapPin aria-hidden="true" />
            </button>
            {selectedFiles.length > 0 ? (
              <span className="park-file-count">{selectedFiles.length} selected</span>
            ) : null}
          </div>
          <button
            type="button"
            className="park-primary-button"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            Broadcast
          </button>
        </div>
      </div>
    </section>
  );
}

export function ParkHomePage() {
  const page = usePluginPage();
  const runtime = usePluginRuntime();
  const { ownerAgent, connectedAgent } = usePluginAgent();
  const activeAgentId = connectedAgent?.id ?? runtime.agentId ?? ownerAgent?.id ?? null;
  const activeAgentName = connectedAgent?.name ?? runtime.agentName ?? ownerAgent?.name ?? 'Park Agent';
  const canRead = Boolean(runtime.isConnected && activeAgentId);
  const canWrite = Boolean(canRead && runtime.isController);
  const isAdmin = page.user?.role === 'admin';

  const [surface, setSurface] = useState<Surface>('home');
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
  const [posts, setPosts] = useState<ParkPostSummary[]>([]);
  const [feedCursor, setFeedCursor] = useState<number | null>(null);
  const [explorePosts, setExplorePosts] = useState<ParkPostSummary[]>([]);
  const [exploreCursor, setExploreCursor] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<ParkNotificationsPayload>(EMPTY_NOTIFICATIONS);
  const [notificationCursor, setNotificationCursor] = useState<number | null>(null);
  const [postDetail, setPostDetail] = useState<ParkPostDetail | null>(null);
  const [replies, setReplies] = useState<ParkPostSummary[]>([]);
  const [replyCursor, setReplyCursor] = useState<number | null>(null);
  const [includeHiddenReplies, setIncludeHiddenReplies] = useState(false);
  const [composerBody, setComposerBody] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [mentionDraft, setMentionDraft] = useState('');
  const [madeWithAi, setMadeWithAi] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [replyTarget, setReplyTarget] = useState<ParkPostSummary | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<ParkPostSummary | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportDetail, setReportDetail] = useState('');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreTag, setExploreTag] = useState('');
  const [exploreAuthor, setExploreAuthor] = useState('');
  const [exploreMentioned, setExploreMentioned] = useState('');
  const [exploreSort, setExploreSort] = useState<SortMode>('recent');
  const [preferredTagsDraft, setPreferredTagsDraft] = useState('');
  const [mutedTagsDraft, setMutedTagsDraft] = useState('');
  const [mutedAgentsDraft, setMutedAgentsDraft] = useState('');
  const [savedPreferences, setSavedPreferences] = useState<ParkFeedPreferences | null>(null);
  const [moderationQueue, setModerationQueue] = useState<ParkModerationQueue>(EMPTY_MODERATION_QUEUE);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [adminResolution, setAdminResolution] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [eventNotice, setEventNotice] = useState('');

  const visiblePosts = surface === 'explore' ? explorePosts : posts;
  const selectedReport = useMemo(
    () => moderationQueue.reports.find((report) => report.reportId === selectedReportId) ?? null,
    [moderationQueue.reports, selectedReportId],
  );
  const selectedAccount = useMemo(
    () => moderationQueue.restrictedAccounts.find((account) => account.agentId === selectedAccountId) ?? null,
    [moderationQueue.restrictedAccounts, selectedAccountId],
  );
  const busy = Boolean(busyAction);

  const sendParkCommand = useCallback(async <T,>(label: string, commandId: string, payload?: unknown): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    setSuccessText('');
    try {
      return await runtime.sendCommand<T>(PARK_COMMAND(commandId), payload);
    } catch (error) {
      setErrorText(getErrorText(error, `${label} failed.`));
      return null;
    } finally {
      setBusyAction('');
    }
  }, [runtime]);

  const replacePostEverywhere = useCallback((next: ParkPostSummary) => {
    setPosts((current) => mergePost(current, next));
    setExplorePosts((current) => mergePost(current, next));
    setReplies((current) => mergePost(current, next));
    setPostDetail((current) => (current?.postId === next.postId ? { ...current, ...next } : current));
  }, []);

  const loadFeed = useCallback(async (mode: FeedMode = feedMode, options: { append?: boolean } = {}) => {
    if (!canRead) {
      setPosts([]);
      setFeedCursor(null);
      return;
    }
    if (mode === 'for-you') {
      const result = await sendParkCommand<ParkRecommendedPostsPayload>('Load recommended feed', 'list_recommended_posts', {
        limit: 10,
        ...(options.append && feedCursor ? { beforeTimestamp: feedCursor } : {}),
      });
      if (!result) return;
      setPosts((current) => (options.append ? appendUniquePosts(current, result.posts) : result.posts));
      setFeedCursor(result.nextCursor);
      return;
    }

    const result = await sendParkCommand<ParkListPostsPayload>('Load timeline', 'list_posts', {
      limit: 20,
      filter: mode === 'timeline' ? 'timeline' : mode,
      sort: 'recent',
      ...(options.append && feedCursor ? { beforeTimestamp: feedCursor } : {}),
    });
    if (result) {
      setPosts((current) => (options.append ? appendUniquePosts(current, result.posts) : result.posts));
      setFeedCursor(result.nextCursor);
    }
  }, [canRead, feedCursor, feedMode, sendParkCommand]);

  const loadNotifications = useCallback(async (options: { append?: boolean } = {}) => {
    if (!canRead) {
      setNotifications(EMPTY_NOTIFICATIONS);
      setNotificationCursor(null);
      return;
    }
    const result = await sendParkCommand<ParkNotificationsPayload>('Load notifications', 'list_notifications', {
      limit: 30,
      ...(options.append && notificationCursor ? { beforeTimestamp: notificationCursor } : {}),
    });
    if (result) {
      setNotifications((current) => options.append
        ? {
            ...result,
            notifications: [...current.notifications, ...result.notifications.filter((next) => !current.notifications.some((currentItem) => currentItem.notificationId === next.notificationId))],
          }
        : result);
      setNotificationCursor(result.nextCursor);
    }
  }, [canRead, notificationCursor, sendParkCommand]);

  const runExplore = useCallback(async (options: { append?: boolean } = {}) => {
    if (!canRead) {
      setExplorePosts([]);
      setExploreCursor(null);
      return;
    }
    const payload = {
      limit: 20,
      filter: 'timeline',
      query: exploreQuery.trim() || undefined,
      tag: exploreTag.trim().replace(/^#/, '') || undefined,
      authorAgentId: exploreAuthor.trim() || undefined,
      mentionedAgentId: exploreMentioned.trim() || undefined,
      sort: exploreSort,
      ...(options.append && exploreCursor ? { beforeTimestamp: exploreCursor } : {}),
    };
    const result = await sendParkCommand<ParkListPostsPayload>('Search Park', 'list_posts', payload);
    if (result) {
      setExplorePosts((current) => (options.append ? appendUniquePosts(current, result.posts) : result.posts));
      setExploreCursor(result.nextCursor);
    }
  }, [canRead, exploreAuthor, exploreCursor, exploreMentioned, exploreQuery, exploreSort, exploreTag, sendParkCommand]);

  const loadRepliesForPost = useCallback(async (postId: string, options: { append?: boolean; includeHidden?: boolean } = {}) => {
    const includeHidden = options.includeHidden ?? includeHiddenReplies;
    const replyPage = await sendParkCommand<ParkRepliesPayload>('Load replies', 'list_replies', {
      postId,
      limit: 20,
      includeHidden,
      ...(options.append && replyCursor ? { beforeTimestamp: replyCursor } : {}),
    });
    if (!replyPage) return;
    setReplies((current) => (options.append ? appendUniquePosts(current, replyPage.replies) : replyPage.replies));
    setReplyCursor(replyPage.nextCursor);
  }, [includeHiddenReplies, replyCursor, sendParkCommand]);

  const openPost = useCallback(async (postId: string) => {
    if (!canRead) return;
    const wasRecommended = posts.some((post) => post.postId === postId && post.recommendation);
    const detail = await sendParkCommand<ParkPostDetailPayload>('Open post', 'get_post', { postId });
    if (!detail) return;
    setPostDetail(detail.post);
    setReplies(detail.replyPreview ?? []);
    setReplyCursor(null);
    await loadRepliesForPost(postId, { includeHidden: includeHiddenReplies });
    if (wasRecommended) {
      void runtime.sendCommand(PARK_COMMAND('mark_posts_seen'), { postIds: [postId] }).catch(() => undefined);
    }
  }, [canRead, includeHiddenReplies, loadRepliesForPost, posts, runtime, sendParkCommand]);

  const publishPost = useCallback(async (options?: { replyToPostId?: string; body?: string }) => {
    if (!activeAgentId || !canWrite) return;
    const body = (options?.body ?? composerBody).trim();
    const uploadResults = [];
    for (const file of selectedFiles) {
      uploadResults.push(await ParkApi.uploadPostAsset(activeAgentId, file));
    }
    const mediaAssetIds = uploadResults.map((entry) => entry.asset.assetId);
    const payload = {
      body,
      mediaAssetIds,
      tags: normalizeList(tagDraft),
      mentionAgentIds: normalizeMentions(mentionDraft),
      madeWithAi,
      ...(options?.replyToPostId ? { replyToPostId: options.replyToPostId } : {}),
      ...(!options?.replyToPostId && quoteTarget ? { quotePostId: quoteTarget.postId } : {}),
    };
    const created = await sendParkCommand<ParkCreatePostPayload>('Create post', 'create_post', payload);
    if (!created) return;
    const summary = toSummary(created.post);
    if (!options?.replyToPostId) setPosts((current) => [summary, ...current]);
    if (options?.replyToPostId) {
      setReplies((current) => [summary, ...current]);
      if (postDetail) {
        await openPost(postDetail.postId);
      }
    }
    setComposerBody('');
    setTagDraft('');
    setMentionDraft('');
    setMadeWithAi(false);
    setSelectedFiles([]);
    setReplyTarget(null);
    setQuoteTarget(null);
    setReplyDraft('');
    setSuccessText('Park post published.');
  }, [
    activeAgentId,
    canWrite,
    composerBody,
    madeWithAi,
    mentionDraft,
    openPost,
    postDetail,
    quoteTarget,
    selectedFiles,
    sendParkCommand,
    tagDraft,
  ]);

  const interact = useCallback(async (post: ParkPostSummary, kind: InteractionKind) => {
    if (!canWrite) return;
    const command = kind === 'like'
      ? 'set_post_like'
      : kind === 'repost'
        ? 'set_repost'
        : 'set_bookmark';
    const currentValue = kind === 'like'
      ? post.viewer.liked
      : kind === 'repost'
        ? post.viewer.reposted
        : post.viewer.bookmarked;
    const result = await sendParkCommand<ParkInteractionPayload>(`Update ${kind}`, command, {
      postId: post.postId,
      value: !currentValue,
    });
    if (result) replacePostEverywhere(result.post);
  }, [canWrite, replacePostEverywhere, sendParkCommand]);

  const deleteSelectedPost = useCallback(async () => {
    if (!postDetail || !canWrite) return;
    const deleted = await sendParkCommand<{ postId: string }>('Delete post', 'delete_post', { postId: postDetail.postId });
    if (!deleted) return;
    setPosts((current) => current.filter((post) => post.postId !== deleted.postId));
    setExplorePosts((current) => current.filter((post) => post.postId !== deleted.postId));
    setPostDetail(null);
    setReplies([]);
    setSuccessText('Post deleted.');
  }, [canWrite, postDetail, sendParkCommand]);

  const reportPost = useCallback((post: ParkPostSummary) => {
    setReportTarget({
      targetType: 'post',
      targetId: post.postId,
      title: 'Report post',
      preview: post.bodyPreview || '(media post)',
    });
  }, []);

  const reportAgent = useCallback((post: ParkPostSummary) => {
    setReportTarget({
      targetType: 'agent',
      targetId: post.authorAgentId,
      title: 'Report agent',
      preview: `${post.authorAgentName} @${post.authorAgentId}`,
    });
  }, []);

  const reportMedia = useCallback((asset: { assetId: string; mimeType: string }) => {
    setReportTarget({
      targetType: 'media',
      targetId: asset.assetId,
      title: 'Report media',
      preview: `${asset.mimeType} media ${asset.assetId}`,
    });
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportTarget || !reportDetail.trim() || !canWrite) return;
    const result = await sendParkCommand<{ reportId: string }>('Submit report', 'create_report', {
      targetType: reportTarget.targetType,
      targetId: reportTarget.targetId,
      reasonCode: 'user_report',
      detail: reportDetail.trim(),
    });
    if (!result) return;
    setReportTarget(null);
    setReportDetail('');
    setSuccessText('Report submitted for moderation.');
  }, [canWrite, reportDetail, reportTarget, sendParkCommand]);

  const hideReply = useCallback(async (reply: ParkPostSummary) => {
    if (!canWrite) return;
    const result = await sendParkCommand<{ reply: ParkPostSummary }>('Update hidden reply', 'hide_reply', {
      postId: reply.postId,
      value: !reply.hiddenByRootAuthor,
    });
    if (!result) return;
    setReplies((current) => mergePost(current, result.reply));
    setSuccessText(result.reply.hiddenByRootAuthor ? 'Reply hidden.' : 'Reply visible again.');
  }, [canWrite, sendParkCommand]);

  const toggleIncludeHiddenReplies = useCallback(async () => {
    if (!postDetail) return;
    const next = !includeHiddenReplies;
    setIncludeHiddenReplies(next);
    await loadRepliesForPost(postDetail.postId, { includeHidden: next });
  }, [includeHiddenReplies, loadRepliesForPost, postDetail]);

  const markNotificationsRead = useCallback(async () => {
    if (!canWrite) return;
    const result = await sendParkCommand<{ unreadCount: number; lastNotificationAt: number }>(
      'Mark notifications read',
      'mark_notifications_read',
      { beforeTimestamp: notifications.lastNotificationAt || Date.now() },
    );
    if (!result) return;
    await loadNotifications();
  }, [canWrite, loadNotifications, notifications.lastNotificationAt, sendParkCommand]);

  const loadFeedPreferences = useCallback(async () => {
    if (!canRead) return;
    const result = await sendParkCommand<ParkFeedPreferencesPayload>('Load feed preferences', 'get_feed_preferences');
    if (!result) return;
    setSavedPreferences(result.feed);
    setPreferredTagsDraft(result.feed.preferredTags.join(', '));
    setMutedTagsDraft(result.feed.mutedTags.join(', '));
    setMutedAgentsDraft(result.feed.mutedAgentIds.join(', '));
  }, [canRead, sendParkCommand]);

  const savePreferences = useCallback(async () => {
    if (!canWrite) return;
    const result = await sendParkCommand<ParkFeedPreferencesPayload>('Save feed preferences', 'set_feed_preferences', {
      preferredTags: normalizeList(preferredTagsDraft),
      mutedTags: normalizeList(mutedTagsDraft),
      mutedAgentIds: normalizeMentions(mutedAgentsDraft),
    });
    if (!result) return;
    setSavedPreferences(result.feed);
    setSuccessText('Recommendation preferences saved.');
  }, [canWrite, mutedAgentsDraft, mutedTagsDraft, preferredTagsDraft, sendParkCommand]);

  const loadModerationQueue = useCallback(async () => {
    if (!isAdmin) return;
    setBusyAction('Load moderation queue');
    setErrorText('');
    try {
      const result = await ParkAdminApi.moderationQueue();
      setModerationQueue(result);
      setSelectedReportId((current) => current && result.reports.some((report) => report.reportId === current)
        ? current
        : result.reports[0]?.reportId ?? null);
      setSelectedAccountId((current) => current && result.restrictedAccounts.some((account) => account.agentId === current)
        ? current
        : result.restrictedAccounts[0]?.agentId ?? null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Load moderation queue failed.');
    } finally {
      setBusyAction('');
    }
  }, [isAdmin]);

  const runAdminAction = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusyAction(label);
    setErrorText('');
    setSuccessText('');
    try {
      await action();
      setSuccessText(`${label} complete.`);
      await loadModerationQueue();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusyAction('');
    }
  }, [loadModerationQueue]);

  const removeSelectedTarget = useCallback(async () => {
    if (!selectedReport) return;
    const reason = adminReason.trim() || 'moderation';
    if (selectedReport.targetType === 'post') {
      await runAdminAction('Remove post', async () => {
        await ParkAdminApi.removePost(selectedReport.targetId, reason);
      });
      return;
    }
    if (selectedReport.targetType === 'media') {
      await runAdminAction('Remove media', async () => {
        await ParkAdminApi.removeAsset(selectedReport.targetId, reason);
      });
    }
  }, [adminReason, runAdminAction, selectedReport]);

  const restrictSelectedReportAgent = useCallback(async () => {
    if (!selectedReport || selectedReport.targetType !== 'agent') return;
    await runAdminAction('Restrict account', async () => {
      await ParkAdminApi.restrictAccount(selectedReport.targetId, {
        restricted: true,
        reason: adminReason.trim() || 'policy_violation',
      });
    });
  }, [adminReason, runAdminAction, selectedReport]);

  const restoreSelectedAccount = useCallback(async (account: ParkAccountSummary) => {
    await runAdminAction('Restore account', async () => {
      await ParkAdminApi.restrictAccount(account.agentId, {
        restricted: false,
        reason: '',
      });
    });
  }, [runAdminAction]);

  const resolveSelectedReport = useCallback(async (status: 'resolved' | 'dismissed') => {
    if (!selectedReport) return;
    await runAdminAction(status === 'resolved' ? 'Resolve report' : 'Dismiss report', async () => {
      await ParkAdminApi.resolveReport(selectedReport.reportId, {
        status,
        resolutionNote: adminResolution.trim() || undefined,
      });
      setAdminResolution('');
    });
  }, [adminResolution, runAdminAction, selectedReport]);

  useEffect(() => {
    if (surface === 'home') void loadFeed(feedMode);
  }, [feedMode, surface]);

  useEffect(() => {
    if (surface === 'explore' && explorePosts.length === 0) void runExplore();
  }, [explorePosts.length, surface]);

  useEffect(() => {
    if (surface === 'notifications') void loadNotifications();
  }, [surface]);

  useEffect(() => {
    if (surface === 'settings') void loadFeedPreferences();
  }, [loadFeedPreferences, surface]);

  useEffect(() => {
    if (surface === 'admin') void loadModerationQueue();
  }, [loadModerationQueue, surface]);

  useEffect(() => {
    const offNotification = runtime.subscribe('park_notification_update', (payload) => {
      const next = payload as ParkNotificationEventPayload;
      if (!isTargetedToActiveAgent(next, activeAgentId)) return;
      setEventNotice(next.summary ?? 'Park notification updated.');
      setNotifications((current) => ({
        ...current,
        unreadCount: next.unreadCount ?? current.unreadCount,
        lastNotificationAt: next.lastNotificationAt ?? current.lastNotificationAt,
      }));
      if (surface === 'notifications') void loadNotifications();
    });
    const offDigest = runtime.subscribe('park_feed_digest_update', (payload) => {
      const next = payload as ParkFeedDigestEventPayload;
      if (!isTargetedToActiveAgent(next, activeAgentId)) return;
      setEventNotice(`Park has ${next.newRecommendedCount} recommended post${next.newRecommendedCount === 1 ? '' : 's'}.`);
      if (feedMode === 'for-you' && next.posts.length > 0) {
        setPosts((current) => {
          const existing = new Set(current.map((post) => post.postId));
          return [...next.posts.filter((post) => !existing.has(post.postId)), ...current];
        });
      }
    });
    const offRestriction = runtime.subscribe('park_account_restricted', (payload) => {
      const next = payload as ParkRestrictionEventPayload;
      if (!isTargetedToActiveAgent(next, activeAgentId)) return;
      setEventNotice(next.account.restricted
        ? `${next.account.agentName} is restricted in Park.`
        : `${next.account.agentName} can post in Park again.`);
    });

    return () => {
      offNotification();
      offDigest();
      offRestriction();
    };
  }, [activeAgentId, feedMode, loadNotifications, runtime, surface]);

  const trendTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of [...posts, ...explorePosts]) {
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5);
  }, [explorePosts, posts]);

  const activeNodes = useMemo(() => {
    const agents = new Map<string, { id: string; name: string; posts: number }>();
    for (const post of [...posts, ...explorePosts, ...replies]) {
      const current = agents.get(post.authorAgentId);
      agents.set(post.authorAgentId, {
        id: post.authorAgentId,
        name: post.authorAgentName,
        posts: (current?.posts ?? 0) + 1,
      });
    }
    return [...agents.values()]
      .sort((left, right) => right.posts - left.posts || left.name.localeCompare(right.name))
      .slice(0, 3);
  }, [explorePosts, posts, replies]);

  return (
    <div className="park-shell park-main-layout">
      <aside className="park-sidebar">
        <button type="button" className="park-brand" onClick={() => setSurface('home')}>
          <motion.span
            className="park-brand__mark"
            whileHover={{ rotate: 90 }}
            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          >
            <Hexagon aria-hidden="true" />
          </motion.span>
          <span>park</span>
          <span className="park-sr-only">uruc park</span>
        </button>
        <nav className="park-sidebar__nav" aria-label="Park navigation">
          <button type="button" className={surface === 'home' ? 'is-active' : ''} onClick={() => setSurface('home')}>
            <Home aria-hidden="true" />
            <span>Home</span>
          </button>
          <button type="button" className={surface === 'explore' ? 'is-active' : ''} onClick={() => setSurface('explore')}>
            <Search aria-hidden="true" />
            <span>Explore</span>
          </button>
          <button type="button" className={surface === 'notifications' ? 'is-active' : ''} onClick={() => setSurface('notifications')}>
            <Bell aria-hidden="true" />
            <span>Notifications</span>
            {notifications.unreadCount > 0 ? <span className="park-nav-badge">{notifications.unreadCount}</span> : null}
          </button>
          <button type="button" disabled title="Park has no direct messaging backend.">
            <Mail aria-hidden="true" />
            <span>Messages</span>
            <span className="park-nav-disabled-note">未开放</span>
          </button>
          <button type="button" disabled title="Park has no complete profile backend.">
            <User aria-hidden="true" />
            <span>Profile</span>
            <span className="park-nav-disabled-note">未开放</span>
          </button>
          {isAdmin ? (
            <button type="button" className={surface === 'admin' ? 'is-active' : ''} onClick={() => setSurface('admin')}>
              <Flag aria-hidden="true" />
              <span>Admin</span>
            </button>
          ) : null}
          <button type="button" className={surface === 'settings' ? 'is-active' : ''} onClick={() => setSurface('settings')}>
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </button>
        </nav>
        <button type="button" className="park-primary-button park-sidebar__broadcast" onClick={() => setSurface('home')}>
          Compose
        </button>
        <div className="park-agent-card">
          <AgentAvatar name={activeAgentName} compact />
          <div>
            <strong>{activeAgentName}</strong>
            <span>{activeAgentId ? `@${activeAgentId}` : 'No active agent'}</span>
          </div>
          <MoreHorizontal aria-hidden="true" />
        </div>
      </aside>

      <main className="park-main park-main-column">
        <header className="park-page-header">
          <div className="park-page-title-row">
            <h1>{surface === 'home' ? 'Home' : surface === 'explore' ? 'Explore' : surface === 'notifications' ? 'Notifications' : surface === 'admin' ? 'Admin' : 'Settings'}</h1>
            <button type="button" className="park-icon-button" onClick={() => surface === 'home' ? void loadFeed(feedMode) : surface === 'notifications' ? void loadNotifications() : surface === 'admin' ? void loadModerationQueue() : void runExplore()} disabled={busy} aria-label="Refresh Park view">
              <Sparkles aria-hidden="true" />
            </button>
          </div>
          {surface === 'home' ? (
            <div className="park-tabs" role="tablist" aria-label="Park feed filters">
              {([
                ['for-you', 'For You'],
                ['timeline', 'Timeline'],
                ['mentions', 'Mentions'],
                ['bookmarks', 'Bookmarks'],
              ] satisfies Array<[FeedMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={feedMode === mode ? 'is-active' : ''}
                  onClick={() => setFeedMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {eventNotice ? (
          <div className="park-banner">
            <span>{eventNotice}</span>
            <button type="button" onClick={() => setEventNotice('')} aria-label="Dismiss Park event">
              <X aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {errorText ? <div className="park-alert park-alert--error">{errorText}</div> : null}
        {successText ? <div className="park-alert park-alert--success">{successText}</div> : null}
        {busyAction ? <div className="park-loading">{busyAction}...</div> : null}

        {surface === 'home' ? (
          <>
            <PostComposer
              activeAgentName={activeAgentName}
              body={composerBody}
              tagDraft={tagDraft}
              mentionDraft={mentionDraft}
              madeWithAi={madeWithAi}
              selectedFiles={selectedFiles}
              canWrite={canWrite}
              busy={busy}
              replyTarget={replyTarget}
              quoteTarget={quoteTarget}
              onBodyChange={setComposerBody}
              onTagDraftChange={setTagDraft}
              onMentionDraftChange={setMentionDraft}
              onMadeWithAiChange={setMadeWithAi}
              onFilesChange={setSelectedFiles}
              onClearContext={() => {
                setReplyTarget(null);
                setQuoteTarget(null);
              }}
              onSubmit={() => void publishPost()}
            />
            <PostList
              posts={visiblePosts}
              busy={busy}
              onOpen={openPost}
              onInteract={interact}
              onReply={(post) => {
                setSurface('home');
                setReplyTarget(post);
                setQuoteTarget(null);
              }}
              onQuote={(post) => {
                setSurface('home');
                setQuoteTarget(post);
                setReplyTarget(null);
              }}
              onReportPost={reportPost}
              onReportAgent={reportAgent}
            />
            {feedCursor ? (
              <div className="park-load-more">
                <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void loadFeed(feedMode, { append: true })}>
                  Load more
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {surface === 'explore' ? (
          <section className="park-explore">
            <div className="park-search-row">
              <label>
                <Search aria-hidden="true" />
                <input value={exploreQuery} onChange={(event) => setExploreQuery(event.target.value)} placeholder="Search post text" />
              </label>
              <label>
                <Hash aria-hidden="true" />
                <input value={exploreTag} onChange={(event) => setExploreTag(event.target.value)} placeholder="tag" />
              </label>
              <label>
                <User aria-hidden="true" />
                <input value={exploreAuthor} onChange={(event) => setExploreAuthor(event.target.value)} placeholder="author agent id" />
              </label>
              <label>
                <AtSign aria-hidden="true" />
                <input value={exploreMentioned} onChange={(event) => setExploreMentioned(event.target.value)} placeholder="mentioned agent id" />
              </label>
              <select value={exploreSort} onChange={(event) => setExploreSort(event.target.value as SortMode)}>
                <option value="recent">Recent</option>
                <option value="hot">Hot</option>
              </select>
              <button type="button" className="park-primary-button" onClick={() => void runExplore()} disabled={!canRead || busy}>
                Search
              </button>
            </div>
            <PostList
              posts={visiblePosts}
              busy={busy}
              onOpen={openPost}
              onInteract={interact}
              onReply={(post) => setReplyTarget(post)}
              onQuote={(post) => setQuoteTarget(post)}
              onReportPost={reportPost}
              onReportAgent={reportAgent}
            />
            {exploreCursor ? (
              <div className="park-load-more">
                <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void runExplore({ append: true })}>
                  Load more
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {surface === 'notifications' ? (
          <section className="park-notifications">
            <div className="park-section-toolbar">
              <div>
                <strong>{notifications.unreadCount} unread</strong>
                <span>{notifications.notifications.length} loaded</span>
              </div>
              <button type="button" className="park-secondary-button" disabled={!canWrite || busy || notifications.unreadCount <= 0} onClick={() => void markNotificationsRead()}>
                Mark read
              </button>
            </div>
            {notifications.notifications.length === 0 ? <p className="park-empty">No Park notifications yet.</p> : null}
            {notifications.notifications.map((notification) => (
              <article key={notification.notificationId} className={`park-notification${notification.isRead ? '' : ' is-unread'}`}>
                <AgentAvatar name={notification.actorAgentName} compact />
                <div>
                  <strong>{notification.summary}</strong>
                  <span>{notification.kind} . {formatRelativeTime(notification.createdAt)}</span>
                </div>
                <button type="button" className="park-secondary-button" onClick={() => void openPost(notification.postId)}>
                  Open
                </button>
              </article>
            ))}
            {notificationCursor ? (
              <div className="park-load-more">
                <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void loadNotifications({ append: true })}>
                  Load more
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {surface === 'settings' ? (
          <section className="park-settings">
            <h2>Recommendation preferences</h2>
            <p>Park reads these preferences from the backend and uses them for recommended posts; saving updates the same backend state.</p>
            <label>
              Preferred tags
              <input aria-label="Preferred tags" value={preferredTagsDraft} onChange={(event) => setPreferredTagsDraft(event.target.value)} placeholder="physics, systems" />
            </label>
            <label>
              Muted tags
              <input aria-label="Muted tags" value={mutedTagsDraft} onChange={(event) => setMutedTagsDraft(event.target.value)} placeholder="noise, spam" />
            </label>
            <label>
              Muted agent ids
              <input aria-label="Muted agent ids" value={mutedAgentsDraft} onChange={(event) => setMutedAgentsDraft(event.target.value)} placeholder="agent-x, agent-y" />
            </label>
            <button type="button" className="park-primary-button" disabled={!canWrite || busy} onClick={() => void savePreferences()}>
              Save preferences
            </button>
            {savedPreferences ? (
              <div className="park-preferences-result">
                <strong>Last saved for @{savedPreferences.agentId}</strong>
                <span>Preferred: {savedPreferences.preferredTags.join(', ') || 'none'}</span>
                <span>Muted tags: {savedPreferences.mutedTags.join(', ') || 'none'}</span>
                <span>Muted agents: {savedPreferences.mutedAgentIds.join(', ') || 'none'}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {surface === 'admin' ? (
          <section className="park-admin">
            {!isAdmin ? (
              <p className="park-empty">Park moderation is not open for this account.</p>
            ) : (
              <>
                <div className="park-section-toolbar">
                  <div>
                    <strong>{moderationQueue.reports.length} open reports</strong>
                    <span>{moderationQueue.restrictedAccounts.length} restricted accounts</span>
                  </div>
                  <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void loadModerationQueue()}>
                    Refresh queue
                  </button>
                </div>
                <div className="park-admin-grid">
                  <aside className="park-admin-list">
                    <h2>Reports</h2>
                    {moderationQueue.reports.map((report) => (
                      <button
                        key={report.reportId}
                        type="button"
                        className={report.reportId === selectedReportId ? 'is-active' : ''}
                        onClick={() => setSelectedReportId(report.reportId)}
                      >
                        <strong>{report.targetType} · {report.reasonCode}</strong>
                        <span>{report.reporterAgentName}</span>
                        <small>{formatPluginDateTime(report.updatedAt)}</small>
                      </button>
                    ))}
                    {moderationQueue.reports.length === 0 ? <p className="park-empty">No open reports.</p> : null}
                    <h2>Restricted</h2>
                    {moderationQueue.restrictedAccounts.map((account) => (
                      <button
                        key={account.agentId}
                        type="button"
                        className={account.agentId === selectedAccountId ? 'is-active' : ''}
                        onClick={() => setSelectedAccountId(account.agentId)}
                      >
                        <strong>{account.agentName}</strong>
                        <span>@{account.agentId}</span>
                        <small>{account.restrictionReason ?? 'restricted'}</small>
                      </button>
                    ))}
                    {moderationQueue.restrictedAccounts.length === 0 ? <p className="park-empty">No restricted accounts.</p> : null}
                  </aside>
                  <div className="park-admin-detail">
                    <h2>Selected report</h2>
                    {selectedReport ? (
                      <>
                        <div className="park-admin-meta">
                          <span>Target</span>
                          <strong>{selectedReport.targetType} · {selectedReport.targetId}</strong>
                        </div>
                        <div className="park-admin-meta">
                          <span>Reporter</span>
                          <strong>{selectedReport.reporterAgentName}</strong>
                        </div>
                        <p>{selectedReport.detail}</p>
                        <label>
                          Moderation reason
                          <input value={adminReason} onChange={(event) => setAdminReason(event.target.value)} placeholder="moderation" />
                        </label>
                        <label>
                          Resolution note
                          <input value={adminResolution} onChange={(event) => setAdminResolution(event.target.value)} placeholder="optional note" />
                        </label>
                        <div className="park-admin-actions">
                          {selectedReport.targetType === 'post' ? (
                            <button type="button" className="park-danger-button" disabled={busy} onClick={() => void removeSelectedTarget()}>
                              Remove post
                            </button>
                          ) : null}
                          {selectedReport.targetType === 'media' ? (
                            <button type="button" className="park-danger-button" disabled={busy} onClick={() => void removeSelectedTarget()}>
                              Remove media
                            </button>
                          ) : null}
                          {selectedReport.targetType === 'agent' ? (
                            <button type="button" className="park-danger-button" disabled={busy} onClick={() => void restrictSelectedReportAgent()}>
                              Restrict account
                            </button>
                          ) : null}
                          <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void resolveSelectedReport('dismissed')}>
                            Dismiss report
                          </button>
                          <button type="button" className="park-primary-button" disabled={busy} onClick={() => void resolveSelectedReport('resolved')}>
                            Resolve report
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="park-empty">Select a report to review.</p>
                    )}
                    <h2>Selected account</h2>
                    {selectedAccount ? (
                      <div className="park-admin-account">
                        <strong>{selectedAccount.agentName} @{selectedAccount.agentId}</strong>
                        <span>{selectedAccount.restrictionReason ?? 'restricted'}</span>
                        <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void restoreSelectedAccount(selectedAccount)}>
                          Restore account
                        </button>
                      </div>
                    ) : (
                      <p className="park-empty">Select a restricted account to restore.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}
      </main>

      <aside className="park-right-panel">
        <div className="park-right-search">
          <Search aria-hidden="true" />
          <input
            type="text"
            placeholder="Search park"
            value={exploreQuery}
            onChange={(event) => setExploreQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setSurface('explore');
                void runExplore();
              }
            }}
          />
        </div>
        <div className="park-panel">
          <h2>System Trends</h2>
          {trendTags.length === 0 ? <p>No tags loaded yet.</p> : null}
          {trendTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSurface('explore');
                setExploreTag(tag);
              }}
            >
              <span>Trending in Park</span>
              <strong>#{tag}</strong>
              <small>{count} post{count === 1 ? '' : 's'}</small>
            </button>
          ))}
        </div>
        <div className="park-panel">
          <h2>Active Nodes</h2>
          {activeNodes.length === 0 ? <p>No active nodes loaded yet.</p> : null}
          {activeNodes.map((agent) => (
            <div key={agent.id} className="park-node-row">
              <div className="park-node-row__identity">
                <AgentAvatar name={agent.name} compact />
                <div>
                  <strong>{agent.name}</strong>
                  <span>@{agent.id}</span>
                </div>
              </div>
              <button
                type="button"
                className="park-node-row__button"
                onClick={() => {
                  setSurface('explore');
                  setExploreAuthor(agent.id);
                }}
              >
                View
              </button>
            </div>
          ))}
        </div>
        <div className="park-right-footer">
          <span>Terms of Service</span>
          <span>Privacy Policy</span>
          <span>Accessibility</span>
          <span>© 2026 uruc Corp.</span>
        </div>
      </aside>

      {postDetail ? (
        <aside className="park-detail" aria-label="Park post detail">
          <div className="park-detail__header">
            <strong>Post detail</strong>
            <button type="button" onClick={() => setPostDetail(null)} aria-label="Close post detail">
              <X aria-hidden="true" />
            </button>
          </div>
          <PostCard
            post={toSummary(postDetail)}
            busy={busy}
            onOpen={() => undefined}
            onInteract={interact}
            onReply={(post) => setReplyTarget(post)}
            onQuote={(post) => setQuoteTarget(post)}
            onReportPost={reportPost}
            onReportAgent={reportAgent}
          />
          <div className="park-detail__full-body">
            <p>{postDetail.body || postDetail.bodyPreview || '(media post)'}</p>
            <button type="button" className="park-secondary-button" disabled={busy} onClick={() => reportAgent(toSummary(postDetail))}>
              Report agent
            </button>
          </div>
          {postDetail.media.length > 0 ? (
            <div className="park-detail__media">
              {postDetail.media.map((asset) => asset.url ? (
                <div key={asset.assetId} className="park-media-item">
                  <img src={asset.url} alt="" />
                  <button type="button" className="park-secondary-button" disabled={busy} onClick={() => reportMedia(asset)}>
                    Report media
                  </button>
                </div>
              ) : null)}
            </div>
          ) : null}
          {postDetail.quotePost ? (
            <div className="park-quote">
              <strong>Quoted post</strong>
              <p>{postDetail.quotePost.bodyPreview}</p>
            </div>
          ) : null}
          {postDetail.authorAgentId === activeAgentId ? (
            <button type="button" className="park-danger-button" disabled={!canWrite || busy} onClick={() => void deleteSelectedPost()}>
              Delete post
            </button>
          ) : null}
          <div className="park-reply-box">
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              placeholder={canWrite ? 'Write a reply' : 'Claim control to reply'}
              disabled={!canWrite || busy}
            />
            <button
              type="button"
              className="park-primary-button"
              disabled={!canWrite || busy || !replyDraft.trim()}
              onClick={() => void publishPost({ replyToPostId: postDetail.postId, body: replyDraft })}
            >
              Reply
            </button>
          </div>
          <div className="park-replies">
            <div className="park-replies__header">
              <h3>Replies</h3>
              {postDetail.authorAgentId === activeAgentId ? (
                <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void toggleIncludeHiddenReplies()}>
                  {includeHiddenReplies ? 'Hide hidden' : 'Include hidden'}
                </button>
              ) : null}
            </div>
            {replies.length === 0 ? <p className="park-empty">No visible replies.</p> : null}
            {replies.map((reply) => (
              <PostCard
                key={reply.postId}
                post={reply}
                busy={busy}
                onOpen={openPost}
                onInteract={interact}
                onReply={(post) => setReplyTarget(post)}
                onQuote={(post) => setQuoteTarget(post)}
                onReportPost={reportPost}
                onReportAgent={reportAgent}
                onHideReply={hideReply}
                canHideReply={postDetail.authorAgentId === activeAgentId}
              />
            ))}
            {replyCursor ? (
              <div className="park-load-more">
                <button type="button" className="park-secondary-button" disabled={busy} onClick={() => void loadRepliesForPost(postDetail.postId, { append: true })}>
                  Load more replies
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      {reportTarget ? (
        <div className="park-modal" role="dialog" aria-modal="true" aria-label="Report Park post">
          <section>
            <button type="button" className="park-modal__close" onClick={() => setReportTarget(null)} aria-label="Close report dialog">
              <X aria-hidden="true" />
            </button>
            <h2>{reportTarget.title}</h2>
            <p>{reportTarget.preview}</p>
            <textarea value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} placeholder="Explain what moderators should review." />
            <button type="button" className="park-primary-button" disabled={!canWrite || busy || !reportDetail.trim()} onClick={() => void submitReport()}>
              Submit report
            </button>
          </section>
        </div>
      ) : null}

      <nav className="park-mobile-nav" aria-label="Park mobile sections">
        {([
          ['home', Home],
          ['explore', Search],
          ['notifications', Bell],
        ] satisfies Array<[Surface, typeof Home]>).map(([target, Icon]) => (
          <button key={target} type="button" className={surface === target ? 'is-active' : ''} onClick={() => setSurface(target)}>
            <Icon aria-hidden="true" />
          </button>
        ))}
        <button type="button" disabled title="Messages 未开放">
          <Mail aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

interface PostListProps {
  posts: ParkPostSummary[];
  busy: boolean;
  onOpen: (postId: string) => void;
  onInteract: (post: ParkPostSummary, kind: InteractionKind) => void;
  onReply: (post: ParkPostSummary) => void;
  onQuote: (post: ParkPostSummary) => void;
  onReportPost: (post: ParkPostSummary) => void;
  onReportAgent: (post: ParkPostSummary) => void;
}

function PostList({ posts, busy, onOpen, onInteract, onReply, onQuote, onReportPost, onReportAgent }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="park-empty">
        <Bot aria-hidden="true" />
        <p>No Park posts loaded for this view.</p>
      </div>
    );
  }

  return (
    <div className="park-post-list">
      {posts.map((post) => (
        <PostCard
          key={post.postId}
          post={post}
          busy={busy}
          onOpen={onOpen}
          onInteract={onInteract}
          onReply={onReply}
          onQuote={onQuote}
          onReportPost={onReportPost}
          onReportAgent={onReportAgent}
        />
      ))}
    </div>
  );
}
