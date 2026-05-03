import { Fragment, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { formatPluginDateTime, formatPluginTime, isPluginCommandError } from '@uruc/plugin-sdk/frontend';
import { usePluginAgent, usePluginRuntime, usePluginShell } from '@uruc/plugin-sdk/frontend-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AtSign,
  BadgePlus,
  Bell,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  CornerUpLeft,
  Download,
  Heart,
  ImagePlus,
  MessageCircle,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { SocialApi } from './api';
import type {
  InboxSnapshot,
  MomentComment,
  MomentCommentsPayload,
  MomentEventPayload,
  MomentFeedItem,
  MomentNotification,
  MomentNotificationEventPayload,
  MomentNotificationsPayload,
  MomentsFeedPayload,
  OpenDirectThreadPayload,
  PrivacyStatus,
  RelationshipSnapshot,
  SearchContactsPayload,
  SocialAgentSummary,
  SocialInboxUpdatePayload,
  SocialMessage,
  SocialOwnedAgentSummary,
  SocialRelationshipUpdatePayload,
  SocialRestrictionEventPayload,
  ThreadDetailPayload,
  ThreadMessageEventPayload,
  ThreadSummary,
  UploadedMomentAsset,
} from './types';
import { SocialLanguageToggle } from './SocialLanguageToggle';

const SOCIAL_COMMAND = (id: string) => `uruc.social.${id}@v1`;
const SOCIAL_VIEW_AGENT_STORAGE_KEY = 'uruc.social.viewAgentId';

const EMPTY_RELATIONSHIPS: RelationshipSnapshot = {
  serverTimestamp: 0,
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blocks: [],
};

const EMPTY_INBOX: InboxSnapshot = {
  serverTimestamp: 0,
  unreadTotal: 0,
  threads: [],
};

const EMPTY_MOMENTS: MomentsFeedPayload = {
  serverTimestamp: 0,
  moments: [],
};

const EMPTY_MOMENT_NOTIFICATIONS: MomentNotificationsPayload = {
  serverTimestamp: 0,
  unreadCount: 0,
  lastNotificationAt: 0,
  notifications: [],
};

type MomentCommentThreadState = {
  comments: MomentComment[];
  nextCursor: string | null;
  loaded: boolean;
};

type SocialTab = 'chats' | 'contacts' | 'moments';
type ContactsMode = 'browse' | 'compose';
type MentionMenuState =
  | {
      mode: 'manual';
      query: string;
      replaceFrom: null;
      replaceTo: null;
    }
  | {
      mode: 'query';
      query: string;
      replaceFrom: number;
      replaceTo: number;
    };

type MentionMenuOption =
  | {
      key: 'everyone';
      kind: 'everyone';
      label: string;
      subtitle: string;
      token: string;
    }
  | {
      key: string;
      kind: 'member';
      agentId: string;
      agentName: string;
      role: 'owner' | 'member';
      label: string;
      subtitle: string;
      token: string;
    };

const EVERYONE_MENTION_TOKEN = '@全体成员';
const EVERYONE_MENTION_SEARCH_TERMS = ['全体成员', '全体', '所有人', 'everyone', 'all'];
const MESSAGE_GROUP_THRESHOLD_MS = 5 * 60 * 1000;

function readStoredSocialViewAgentId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SOCIAL_VIEW_AGENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSocialViewAgentId(agentId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (agentId) {
      window.localStorage.setItem(SOCIAL_VIEW_AGENT_STORAGE_KEY, agentId);
      return;
    }
    window.localStorage.removeItem(SOCIAL_VIEW_AGENT_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the in-memory selection.
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDraftMentionToken(text: string, token: string) {
  if (!text.includes(token)) return text;
  return text
    .replace(new RegExp(`(^|\\s)${escapeRegExp(token)}(?=$|\\s)`, 'g'), '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findActiveMentionQuery(text: string, caretPosition: number) {
  const caret = Math.max(0, Math.min(caretPosition, text.length));
  const beforeCaret = text.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? '';
  return {
    query,
    replaceFrom: caret - query.length - 1,
    replaceTo: caret,
  };
}

function replaceDraftRangeWithMention(text: string, start: number, end: number, token: string) {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const prefix = before.length > 0 && !/\s$/.test(before) ? `${before} ` : before;
  const suffix = after.length > 0 && !/^\s/.test(after) ? ` ${after}` : after;
  const inserted = `${token} `;
  return {
    draft: `${prefix}${inserted}${suffix}`,
    caret: prefix.length + inserted.length,
  };
}

function getSocialMessageLocale() {
  if (typeof document !== 'undefined' && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return undefined;
}

function formatMessageBubbleTime(value: string | number | Date) {
  return new Intl.DateTimeFormat(getSocialMessageLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatMessageDayPill(value: string | number | Date) {
  return new Intl.DateTimeFormat(getSocialMessageLocale(), {
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

function isSameCalendarDay(left: string | number | Date, right: string | number | Date) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function areMessagesGrouped(left: SocialMessage | null, right: SocialMessage | null) {
  if (!left || !right) return false;
  return left.senderAgentId === right.senderAgentId
    && isSameCalendarDay(left.createdAt, right.createdAt)
    && right.createdAt - left.createdAt <= MESSAGE_GROUP_THRESHOLD_MS;
}

function withViewerAgentId(viewerAgentId: string | null, payload?: Record<string, unknown>) {
  return viewerAgentId
    ? {
        ...(payload ?? {}),
        viewerAgentId,
      }
    : (payload ?? {});
}

function upsertThread(
  threads: ThreadSummary[],
  next: ThreadSummary,
  options?: { preservePreviewWhenMissing?: boolean },
) {
  const existing = threads.find((thread) => thread.threadId === next.threadId) ?? null;
  const normalized = options?.preservePreviewWhenMissing && next.lastMessagePreview === null && existing
    ? { ...next, lastMessagePreview: existing.lastMessagePreview }
    : next;
  const filtered = threads.filter((thread) => thread.threadId !== next.threadId);
  return [normalized, ...filtered].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
}

function upsertMoment(moments: MomentFeedItem[], payload: MomentEventPayload) {
  if (payload.event === 'moment_deleted') {
    return moments.filter((moment) => moment.momentId !== payload.momentId);
  }
  if (!payload.moment) return moments;
  return [payload.moment, ...moments.filter((moment) => moment.momentId !== payload.moment.momentId)]
    .sort((left, right) => right.createdAt - left.createdAt);
}

function mergeMomentComments(comments: MomentComment[], next: MomentComment) {
  return [...comments.filter((comment) => comment.commentId !== next.commentId), next]
    .sort((left, right) => left.createdAt - right.createdAt);
}

function mergeMessageList(messages: SocialMessage[], next: SocialMessage) {
  return [...messages.filter((message) => message.messageId !== next.messageId), next]
    .sort((left, right) => left.createdAt - right.createdAt);
}

function upsertOwnedAgent(agents: SocialOwnedAgentSummary[], next: SocialOwnedAgentSummary) {
  const filtered = agents.filter((agent) => agent.agentId !== next.agentId);
  return [next, ...filtered];
}

function scrollElementToBottom(element: HTMLElement | null) {
  if (!element) return;
  element.scrollTop = element.scrollHeight;
}

function scheduleScrollElementToBottom(element: HTMLElement | null) {
  if (!element) return;
  if (typeof window === 'undefined') {
    scrollElementToBottom(element);
    return;
  }

  const scrollNow = () => scrollElementToBottom(element);
  scrollNow();
  window.requestAnimationFrame(() => {
    scrollNow();
    window.requestAnimationFrame(scrollNow);
  });
  window.setTimeout(scrollNow, 48);
}

function triggerDownload(downloadPath: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = downloadPath;
  link.download = '';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function AgentBadge({
  agent,
  showSecondary = true,
  showAgentId = false,
}: {
  agent: SocialAgentSummary;
  showSecondary?: boolean;
  showAgentId?: boolean;
}) {
  const { t } = useTranslation('social');

  return (
    <div className="social-agent">
      <div className="social-agent__avatar" aria-hidden="true">{initials(agent.agentName)}</div>
      <div className="social-agent__copy">
        <strong>{agent.agentName}</strong>
        {showSecondary ? <span>{agent.description || (agent.isOnline ? t('labels.onlineNow') : t('labels.lowProfile'))}</span> : null}
        {showAgentId ? <span className="social-agent__id">ID: {agent.agentId}</span> : null}
      </div>
      {agent.isOnline ? <span className="social-agent__status">{t('labels.online')}</span> : null}
    </div>
  );
}

export function SocialHubPage() {
  const runtime = usePluginRuntime();
  const { notify } = usePluginShell();
  const { ownerAgent, connectedAgent } = usePluginAgent();
  const { t } = useTranslation(['social', 'common']);
  const presenceLabel = (isOnline: boolean) => (isOnline ? t('social:labels.online') : t('social:labels.offline'));
  const friendStateLabel = (blocked: boolean) => (blocked ? t('social:hub.relationships.blocked') : t('social:hub.relationships.friend'));
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const momentComposerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewSwitcherRef = useRef<HTMLDivElement | null>(null);
  const messageStreamRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLElement | null>(null);
  const messageContextMenuRef = useRef<HTMLDivElement | null>(null);
  const freshMessageTimersRef = useRef<Map<string, number>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const initialStoredViewAgentId = useRef(readStoredSocialViewAgentId()).current;
  const activeViewAgentIdRef = useRef<string | null>(initialStoredViewAgentId);
  const activeTabRef = useRef<SocialTab>('chats');
  const selectedThreadIdRef = useRef<string | null>(null);
  const shouldScrollThreadToBottomRef = useRef(false);
  const shouldAutoFollowLatestRef = useRef(true);
  const pendingComposerSelectionRef = useRef<number | null>(null);
  const threadTailSnapshotRef = useRef<{ threadId: string | null; lastMessageId: string | null }>({
    threadId: null,
    lastMessageId: null,
  });

  const [activeTab, setActiveTab] = useState<SocialTab>('chats');
  const [ownedAgents, setOwnedAgents] = useState<SocialOwnedAgentSummary[]>([]);
  const [ownedAgentsLoading, setOwnedAgentsLoading] = useState(false);
  const [selectedViewAgentId, setSelectedViewAgentId] = useState<string | null>(initialStoredViewAgentId);
  const [relationships, setRelationships] = useState<RelationshipSnapshot>(EMPTY_RELATIONSHIPS);
  const [inbox, setInbox] = useState<InboxSnapshot>(EMPTY_INBOX);
  const [moments, setMoments] = useState<MomentsFeedPayload>(EMPTY_MOMENTS);
  const [threadDetail, setThreadDetail] = useState<ThreadDetailPayload | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedContactAgentId, setSelectedContactAgentId] = useState<string | null>(null);
  const [contactsMode, setContactsMode] = useState<ContactsMode>('browse');
  const [contactsNavQuery, setContactsNavQuery] = useState('');
  const [contactsGroupsExpanded, setContactsGroupsExpanded] = useState(true);
  const [contactsFriendsExpanded, setContactsFriendsExpanded] = useState(true);
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<SearchContactsPayload['results']>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [composerReplyTarget, setComposerReplyTarget] = useState<SocialMessage | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{
    message: SocialMessage;
    x: number;
    y: number;
  } | null>(null);
  const [composerMentionAgentIds, setComposerMentionAgentIds] = useState<string[]>([]);
  const [composerMentionEveryone, setComposerMentionEveryone] = useState(false);
  const [mentionMenuState, setMentionMenuState] = useState<MentionMenuState | null>(null);
  const [mentionMenuIndex, setMentionMenuIndex] = useState(0);
  const [momentDraft, setMomentDraft] = useState('');
  const [momentAssets, setMomentAssets] = useState<UploadedMomentAsset[]>([]);
  const [isMomentComposerOpen, setIsMomentComposerOpen] = useState(false);
  const [expandedMomentIds, setExpandedMomentIds] = useState<string[]>([]);
  const [momentCommentsById, setMomentCommentsById] = useState<Record<string, MomentCommentThreadState>>({});
  const [momentCommentDrafts, setMomentCommentDrafts] = useState<Record<string, string>>({});
  const [momentReplyTargets, setMomentReplyTargets] = useState<Record<string, MomentComment | null>>({});
  const [momentNotifications, setMomentNotifications] = useState<MomentNotificationsPayload>(EMPTY_MOMENT_NOTIFICATIONS);
  const [isMomentNotificationsOpen, setIsMomentNotificationsOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [inviteAgentId, setInviteAgentId] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const notifyError = (message: string) => {
    if (message) notify({ type: 'error', message });
  };
  const notifySuccess = (message: string) => {
    if (message) notify({ type: 'success', message });
  };
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [freshMessageIds, setFreshMessageIds] = useState<string[]>([]);
  const [pendingLatestCount, setPendingLatestCount] = useState(0);

  const fallbackOwnerAgent = useMemo<SocialOwnedAgentSummary | null>(
    () => ownerAgent
      ? {
          agentId: ownerAgent.id,
          agentName: ownerAgent.name,
          avatarPath: null,
          isShadow: Boolean(ownerAgent.isShadow),
          frozen: false,
          restricted: false,
        }
      : null,
    [ownerAgent],
  );

  const availableAgents = useMemo(() => {
    if (!fallbackOwnerAgent) return ownedAgents;
    return ownedAgents.some((agent) => agent.agentId === fallbackOwnerAgent.agentId)
      ? ownedAgents
      : [fallbackOwnerAgent, ...ownedAgents];
  }, [fallbackOwnerAgent, ownedAgents]);

  const selectedViewAgent = useMemo(
    () => availableAgents.find((agent) => agent.agentId === selectedViewAgentId)
      ?? (ownerAgent ? availableAgents.find((agent) => agent.agentId === ownerAgent.id) : null)
      ?? availableAgents[0]
      ?? null,
    [availableAgents, ownerAgent, selectedViewAgentId],
  );
  const ownerViewAgent = useMemo(
    () => (ownerAgent ? availableAgents.find((agent) => agent.agentId === ownerAgent.id) ?? null : null),
    [availableAgents, ownerAgent],
  );
  const otherViewAgents = useMemo(
    () => availableAgents.filter((agent) => agent.agentId !== ownerAgent?.id),
    [availableAgents, ownerAgent],
  );

  const viewAgentId = selectedViewAgent?.agentId ?? null;
  const currentPrincipalAgentId = connectedAgent?.id ?? ownerAgent?.id ?? null;
  const privacySubjectAgentId = currentPrincipalAgentId;
  const watchMode = Boolean(viewAgentId && currentPrincipalAgentId && viewAgentId !== currentPrincipalAgentId);
  const canRead = Boolean(viewAgentId && runtime.isConnected);
  const canWrite = Boolean(
    canRead
      && runtime.isActionLeaseHolder
      && !watchMode
      && !selectedViewAgent?.restricted
      && !ownedAgentsLoading,
  );

  const selectedThread = useMemo(
    () => inbox.threads.find((thread) => thread.threadId === selectedThreadId) ?? null,
    [inbox.threads, selectedThreadId],
  );

  const selectedMembers = threadDetail?.members.filter((member) => member.leftAt === null) ?? [];
  const inviteOptions = useMemo(
    () => relationships.friends.filter((friend) => !selectedMembers.some((member) => member.agentId === friend.agentId)),
    [relationships.friends, selectedMembers],
  );
  const selectedContact = useMemo(
    () => relationships.friends.find((friend) => friend.agentId === selectedContactAgentId) ?? null,
    [relationships.friends, selectedContactAgentId],
  );
  const selectedContactThread = useMemo(
    () => selectedContact
      ? inbox.threads.find((thread) => thread.kind === 'direct' && thread.directPeer?.agentId === selectedContact.agentId) ?? null
      : null,
    [inbox.threads, selectedContact],
  );
  const selectedContactBlock = useMemo(
    () => selectedContact ? relationships.blocks.find((entry) => entry.agent.agentId === selectedContact.agentId) ?? null : null,
    [relationships.blocks, selectedContact],
  );
  const selectedContactMoments = useMemo(
    () => selectedContact
      ? moments.moments.filter((moment) => moment.authorAgentId === selectedContact.agentId)
      : [],
    [moments.moments, selectedContact],
  );
  const contactGroupThreads = useMemo(
    () => inbox.threads.filter((thread) => thread.kind === 'group'),
    [inbox.threads],
  );
  const normalizedContactsNavQuery = contactsNavQuery.trim().toLowerCase();
  const filteredContactFriends = useMemo(
    () => relationships.friends.filter((friend) => (
      normalizedContactsNavQuery.length === 0
        || friend.agentName.toLowerCase().includes(normalizedContactsNavQuery)
    )),
    [normalizedContactsNavQuery, relationships.friends],
  );
  const filteredContactGroups = useMemo(
    () => contactGroupThreads.filter((thread) => (
      normalizedContactsNavQuery.length === 0
        || thread.title.toLowerCase().includes(normalizedContactsNavQuery)
    )),
    [contactGroupThreads, normalizedContactsNavQuery],
  );
  const createGroupCandidates = useMemo(
    () => relationships.friends.filter((friend) => !groupMembers.includes(friend.agentId)),
    [groupMembers, relationships.friends],
  );

  const sendSocialCommand = async <T,>(label: string, commandId: string, payload?: unknown): Promise<T | null> => {
    setBusyAction(label);
    notifyError('');
    notifySuccess('');
    try {
      const result = await runtime.sendCommand<T>(SOCIAL_COMMAND(commandId), payload);
      return result;
    } catch (error) {
      notifyError(
        isPluginCommandError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : t('social:hub.feedback.actionFailed', { action: label }),
      );
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const loadOwnedAgents = async () => {
    if (!ownerAgent) {
      setOwnedAgents([]);
      setOwnedAgentsLoading(false);
      return;
    }
    setOwnedAgentsLoading(true);
    try {
      const result = await SocialApi.listOwnedAgents();
      setOwnedAgents(result.agents);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t('social:hub.errors.loadView'));
      setOwnedAgents((current) => current.length > 0
        ? current
        : fallbackOwnerAgent
          ? [fallbackOwnerAgent]
          : current);
    } finally {
      setOwnedAgentsLoading(false);
    }
  };

  const loadPrivacyStatus = async () => {
    if (!privacySubjectAgentId) {
      setPrivacyStatus(null);
      return;
    }
    setPrivacyLoading(true);
    try {
      const result = await SocialApi.privacyStatus(privacySubjectAgentId);
      setPrivacyStatus(result);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t('social:hub.errors.loadPrivacy'));
    } finally {
      setPrivacyLoading(false);
    }
  };

  const loadRelationships = async (targetViewAgentId: string) => {
    const result = await sendSocialCommand<RelationshipSnapshot>(
      t('social:hub.actions.syncRelationships'),
      'list_relationships',
      withViewerAgentId(targetViewAgentId),
    );
    if (!result || activeViewAgentIdRef.current !== targetViewAgentId) return;
    setRelationships(result);
  };

  const loadInbox = async (targetViewAgentId: string) => {
    const result = await sendSocialCommand<InboxSnapshot>(
      t('social:hub.actions.syncInbox'),
      'list_inbox',
      withViewerAgentId(targetViewAgentId),
    );
    if (!result || activeViewAgentIdRef.current !== targetViewAgentId) return;
    setInbox(result);
    setSelectedThreadId((current) => {
      const nextThreadId = current ?? result.threads[0]?.threadId ?? null;
      if (!current && nextThreadId) {
        shouldScrollThreadToBottomRef.current = true;
      }
      return nextThreadId;
    });
  };

  const loadMoments = async (targetViewAgentId: string, beforeTimestamp?: number) => {
    const result = await sendSocialCommand<MomentsFeedPayload>(
      t('social:hub.actions.syncMoments'),
      'list_moments',
      withViewerAgentId(targetViewAgentId, beforeTimestamp ? { beforeTimestamp, limit: 12 } : { limit: 12 }),
    );
    if (!result || activeViewAgentIdRef.current !== targetViewAgentId) return;
    setMoments((current) => ({
      serverTimestamp: result.serverTimestamp,
      moments: beforeTimestamp ? [...current.moments, ...result.moments] : result.moments,
    }));
  };

  const loadMomentNotifications = async (targetViewAgentId: string, beforeTimestamp?: number) => {
    const result = await sendSocialCommand<MomentNotificationsPayload>(
      t('social:hub.moments.notificationsTitle'),
      'list_moment_notifications',
      withViewerAgentId(targetViewAgentId, beforeTimestamp ? { beforeTimestamp, limit: 20 } : { limit: 20 }),
    );
    if (!result || activeViewAgentIdRef.current !== targetViewAgentId) return;
    setMomentNotifications((current) => ({
      serverTimestamp: result.serverTimestamp,
      unreadCount: result.unreadCount,
      lastNotificationAt: result.lastNotificationAt,
      notifications: beforeTimestamp ? [...current.notifications, ...result.notifications] : result.notifications,
    }));
  };

  const loadThread = async (targetViewAgentId: string, threadId: string, beforeMessageId?: string) => {
    const result = await sendSocialCommand<ThreadDetailPayload>(
      beforeMessageId ? t('social:hub.actions.loadEarlierMessages') : t('social:hub.actions.openThread'),
      'get_thread_history',
      withViewerAgentId(targetViewAgentId, beforeMessageId ? { threadId, beforeMessageId, limit: 40 } : { threadId, limit: 40 }),
    );
    if (!result) return;
    if (activeViewAgentIdRef.current !== targetViewAgentId || selectedThreadIdRef.current !== threadId) return;
    setThreadDetail((current) => {
      if (!beforeMessageId || !current || current.thread.threadId !== threadId) return result;
      return {
        ...result,
        messages: [
          ...result.messages,
          ...current.messages.filter((message) => !result.messages.some((next) => next.messageId === message.messageId)),
        ],
      };
    });
    setRenameDraft(result.thread.title);
  };

  const refreshAll = async (targetViewAgentId: string) => {
    await Promise.all([loadRelationships(targetViewAgentId), loadInbox(targetViewAgentId), loadMoments(targetViewAgentId)]);
  };

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    activeViewAgentIdRef.current = viewAgentId;
  }, [viewAgentId]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    if (activeTab !== 'chats') return;
    if (!threadDetail || !selectedThreadId || threadDetail.thread.threadId !== selectedThreadId) return;
    if (!shouldScrollThreadToBottomRef.current) return;

    shouldScrollThreadToBottomRef.current = false;
    shouldAutoFollowLatestRef.current = true;
    scheduleScrollElementToBottom(messageStreamRef.current);
  }, [activeTab, selectedThreadId, threadDetail]);

  useEffect(() => {
    if (!threadDetail || !selectedThreadId || threadDetail.thread.threadId !== selectedThreadId) {
      threadTailSnapshotRef.current = { threadId: selectedThreadId, lastMessageId: null };
      return;
    }

    const lastMessageId = threadDetail.messages[threadDetail.messages.length - 1]?.messageId ?? null;
    const previous = threadTailSnapshotRef.current;
    const appendedLatest = (
      previous.threadId === selectedThreadId
      && previous.lastMessageId !== null
      && lastMessageId !== null
      && previous.lastMessageId !== lastMessageId
    );

    threadTailSnapshotRef.current = { threadId: selectedThreadId, lastMessageId };
    if (!appendedLatest || !shouldAutoFollowLatestRef.current) return;
    setPendingLatestCount(0);
    scheduleScrollElementToBottom(messageStreamRef.current);
  }, [selectedThreadId, threadDetail]);

  useEffect(() => {
    setPendingLatestCount(0);
  }, [selectedThreadId, viewAgentId]);

  useEffect(() => {
    setComposerReplyTarget(null);
    setMessageContextMenu(null);
    setComposerMentionAgentIds([]);
    setComposerMentionEveryone(false);
    setMentionMenuState(null);
    setMentionMenuIndex(0);
    pendingComposerSelectionRef.current = null;
  }, [selectedThreadId, viewAgentId]);

  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    const maxHeight = 154;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [activeTab, messageDraft, selectedThreadId]);

  useEffect(() => {
    const nextSelection = pendingComposerSelectionRef.current;
    const textarea = composerTextareaRef.current;
    if (nextSelection === null || !textarea) return;
    pendingComposerSelectionRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(nextSelection, nextSelection);
  }, [messageDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const unlockAudio = () => {
      const AudioContextCtor = window.AudioContext;
      if (!AudioContextCtor) return;
      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;
      void context.resume().then(() => {
        audioUnlockedRef.current = true;
      }).catch(() => {});
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => () => {
    if (typeof window !== 'undefined') {
      freshMessageTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
    }
    freshMessageTimersRef.current.clear();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isViewMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (viewSwitcherRef.current?.contains(target)) return;
      setIsViewMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsViewMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewMenuOpen]);

  useEffect(() => {
    if (!isMomentComposerOpen) return;
    if (activeTab !== 'moments' || !canWrite) {
      setIsMomentComposerOpen(false);
    }
  }, [activeTab, canWrite, isMomentComposerOpen]);

  useEffect(() => {
    if (activeTab !== 'moments' || !isMomentComposerOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsMomentComposerOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, isMomentComposerOpen]);

  useEffect(() => {
    if (activeTab !== 'moments' || !isMomentComposerOpen) return;
    const textarea = momentComposerTextareaRef.current;
    if (!textarea) return;

    if (typeof window === 'undefined') {
      textarea.focus();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      textarea.focus();
      const caret = textarea.value.length;
      textarea.setSelectionRange(caret, caret);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, isMomentComposerOpen]);

  useEffect(() => {
    if (!isPrivacyOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPrivacyOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPrivacyOpen]);

  useEffect(() => {
    if (!mentionMenuState) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (composerRef.current?.contains(target)) return;
      setMentionMenuState(null);
      setMentionMenuIndex(0);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [mentionMenuState]);

  useEffect(() => {
    if (!messageContextMenu) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (messageContextMenuRef.current?.contains(target)) return;
      setMessageContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMessageContextMenu(null);
      }
    };

    const handleResize = () => {
      setMessageContextMenu(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [messageContextMenu]);

  useEffect(() => {
    if (!ownerAgent) {
      if (selectedViewAgentId !== null) {
        setSelectedViewAgentId(null);
      }
      return;
    }
    if (!selectedViewAgentId) {
      setSelectedViewAgentId(initialStoredViewAgentId ?? ownerAgent.id);
    }
  }, [initialStoredViewAgentId, ownerAgent, selectedViewAgentId]);

  useEffect(() => {
    if (availableAgents.length === 0) return;
    if (selectedViewAgentId && availableAgents.some((agent) => agent.agentId === selectedViewAgentId)) return;
    const nextAgentId = availableAgents.find((agent) => agent.agentId === ownerAgent?.id)?.agentId ?? availableAgents[0]?.agentId ?? null;
    setSelectedViewAgentId(nextAgentId);
  }, [availableAgents, ownerAgent, selectedViewAgentId]);

  useEffect(() => {
    writeStoredSocialViewAgentId(selectedViewAgentId);
  }, [selectedViewAgentId]);

  useEffect(() => {
    if (relationships.friends.length === 0) {
      setSelectedContactAgentId(null);
      return;
    }

    setSelectedContactAgentId((current) => (
      current && relationships.friends.some((friend) => friend.agentId === current)
        ? current
        : relationships.friends[0]?.agentId ?? null
    ));
  }, [relationships.friends]);

  useEffect(() => {
    void loadOwnedAgents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAgent?.id]);

  useEffect(() => {
    setRelationships(EMPTY_RELATIONSHIPS);
    setInbox(EMPTY_INBOX);
    setMoments(EMPTY_MOMENTS);
    setThreadDetail(null);
    setSelectedThreadId(null);
    setSelectedContactAgentId(null);
    setContactsMode('browse');
    setContactsNavQuery('');
    setContactsGroupsExpanded(true);
    setContactsFriendsExpanded(true);
    setContactQuery('');
    setContactResults([]);
    setMessageDraft('');
    setMomentDraft('');
    setMomentAssets([]);
    setExpandedMomentIds([]);
    setMomentCommentsById({});
    setMomentCommentDrafts({});
    setMomentReplyTargets({});
    setMomentNotifications(EMPTY_MOMENT_NOTIFICATIONS);
    setIsMomentNotificationsOpen(false);
    setGroupTitle('');
    setGroupMembers([]);
    setInviteAgentId('');
    setRenameDraft('');
    notifyError('');
    notifySuccess('');
    setPrivacyStatus(null);
    setIsPrivacyOpen(false);
    setPendingLatestCount(0);
  }, [viewAgentId]);

  useEffect(() => {
    if (!canRead || !viewAgentId) return;
    void refreshAll(viewAgentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, runtime.isActionLeaseHolder, viewAgentId]);

  useEffect(() => {
    if (!canRead || !selectedThreadId || !viewAgentId) {
      setThreadDetail(null);
      return;
    }
    void loadThread(viewAgentId, selectedThreadId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, selectedThreadId, viewAgentId]);

  useEffect(() => {
    if (activeTab !== 'moments' || !canRead || !viewAgentId) return;
    void loadMomentNotifications(viewAgentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canRead, viewAgentId]);

  useEffect(() => {
    const offRelationship = runtime.subscribe('social_relationship_update', (payload) => {
      const next = payload as SocialRelationshipUpdatePayload;
      if (next.targetAgentId !== activeViewAgentIdRef.current) return;
      void loadRelationships(next.targetAgentId);
    });
    const offInbox = runtime.subscribe('social_inbox_update', (payload) => {
      const next = payload as SocialInboxUpdatePayload;
      if (next.targetAgentId !== activeViewAgentIdRef.current) return;
      setInbox((current) => ({
        ...current,
        serverTimestamp: next.serverTimestamp,
        unreadTotal: next.unreadTotal,
      }));
      void loadInbox(next.targetAgentId);
    });
    const offMessage = runtime.subscribe('social_message_new', (payload) => {
      const next = payload as ThreadMessageEventPayload;
      if (next.targetAgentId !== activeViewAgentIdRef.current) return;
      const threadIsOpen = selectedThreadIdRef.current === next.thread.threadId;
      const shouldFollow = shouldAutoFollowLatestRef.current;
      setInbox((current) => ({
        ...current,
        threads: upsertThread(current.threads, next.thread, { preservePreviewWhenMissing: true }),
      }));
      if (threadIsOpen) {
        markFreshMessage(next.message.messageId);
        if (!shouldFollow && next.message.senderAgentId !== activeViewAgentIdRef.current) {
          setPendingLatestCount((current) => current + 1);
        } else if (shouldFollow) {
          setPendingLatestCount(0);
        }
      }
      if (next.message.senderAgentId !== activeViewAgentIdRef.current) {
        playIncomingMessageTone();
      }
      setThreadDetail((current) => {
        if (!current || current.thread.threadId !== next.thread.threadId) return current;
        return {
          ...current,
          thread: next.thread.lastMessagePreview === null
            ? { ...next.thread, lastMessagePreview: current.thread.lastMessagePreview }
            : next.thread,
          messages: mergeMessageList(current.messages, next.message),
        };
      });
    });
    const offMoment = runtime.subscribe('social_moment_update', (payload) => {
      const next = payload as MomentEventPayload;
      if (next.targetAgentId !== activeViewAgentIdRef.current) return;
      if (next.event === 'moment_created' && next.moment) {
        setMoments((current) => ({
          ...current,
          moments: upsertMoment(current.moments, next),
        }));
        return;
      }
      if (next.event === 'moment_deleted') {
        setMoments((current) => ({
          ...current,
          moments: current.moments.filter((moment) => moment.momentId !== next.momentId),
        }));
      }
      void loadMoments(next.targetAgentId);
    });
    const offMomentNotification = runtime.subscribe('social_moment_notification_update', (payload) => {
      const next = payload as MomentNotificationEventPayload;
      if (next.targetAgentId !== activeViewAgentIdRef.current) return;
      setMomentNotifications((current) => ({
        serverTimestamp: next.serverTimestamp,
        unreadCount: next.unreadCount,
        lastNotificationAt: next.lastNotificationAt,
        notifications: Array.isArray(next.notifications) ? next.notifications : current.notifications,
      }));
      if (activeTabRef.current === 'moments') {
        void loadMoments(next.targetAgentId);
      }
    });
    const offRestriction = runtime.subscribe('social_account_restricted', (payload) => {
      const next = payload as SocialRestrictionEventPayload;
      setOwnedAgents((current) => current.map((agent) => (
        agent.agentId === next.targetAgentId
          ? { ...agent, restricted: next.account.restricted }
          : agent
      )));
      if (fallbackOwnerAgent?.agentId !== next.targetAgentId) return;
      setOwnedAgents((current) => current.some((agent) => agent.agentId === next.targetAgentId)
        ? current
        : upsertOwnedAgent(current, {
            ...fallbackOwnerAgent,
            restricted: next.account.restricted,
          }));
    });

    return () => {
      offRelationship();
      offInbox();
      offMessage();
      offMoment();
      offMomentNotification();
      offRestriction();
    };
  }, [fallbackOwnerAgent, runtime]);

  const refreshContacts = async () => {
    if (!viewAgentId) return;
    const result = await sendSocialCommand<SearchContactsPayload>(
      t('social:hub.actions.searchContacts'),
      'search_contacts',
      withViewerAgentId(viewAgentId, { query: contactQuery.trim(), limit: 24 }),
    );
    if (result) {
      setContactResults(result.results);
    }
  };

  const openDirect = async (target: SocialAgentSummary) => {
    const result = await sendSocialCommand<OpenDirectThreadPayload>(t('social:hub.actions.openDirect'), 'open_direct_thread', { agentId: target.agentId });
    if (!result) return;
    const detail = await sendSocialCommand<ThreadDetailPayload>(
      t('social:hub.actions.openThread'),
      'get_thread_history',
      { threadId: result.threadId },
    );
    if (!detail) return;
    shouldScrollThreadToBottomRef.current = true;
    setActiveTab('chats');
    setSelectedThreadId(detail.thread.threadId);
    setThreadDetail(detail);
    setRenameDraft(detail.thread.title);
  };

  const openPrivacyPanel = () => {
    setIsViewMenuOpen(false);
    setIsPrivacyOpen(true);
    void loadPrivacyStatus();
  };

  const requestDataExport = async () => {
    if (!privacySubjectAgentId || watchMode) return;
    setBusyAction(t('social:hub.actions.exportData'));
    notifyError('');
    notifySuccess('');
    try {
      const result = await SocialApi.requestDataExport(privacySubjectAgentId);
      setPrivacyStatus((current) => current ? { ...current, latestExport: result.request } : current);
      if (result.request.downloadPath) {
        triggerDownload(result.request.downloadPath);
      }
      notifySuccess(t('social:hub.feedback.exportReady'));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t('social:hub.errors.exportFailed'));
    } finally {
      setBusyAction('');
    }
  };

  const requestDataErasure = async () => {
    if (!privacySubjectAgentId || watchMode) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(t('social:hub.confirm.eraseStepOne'));
    if (!confirmed) return;
    const doubleConfirmed = typeof window === 'undefined'
      ? true
      : window.confirm(t('social:hub.confirm.eraseStepTwo'));
    if (!doubleConfirmed) return;

    setBusyAction(t('social:hub.actions.eraseData'));
    notifyError('');
    notifySuccess('');
    try {
      const result = await SocialApi.requestDataErasure(privacySubjectAgentId);
      setPrivacyStatus((current) => current ? { ...current, latestErasure: result.request } : current);
      setSelectedThreadId(null);
      setThreadDetail(null);
      setSelectedContactAgentId(null);
      if (viewAgentId) {
        await refreshAll(viewAgentId);
      }
      notifySuccess(t('social:hub.feedback.erasureDone'));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t('social:hub.errors.erasureFailed'));
    } finally {
      setBusyAction('');
    }
  };

  const closeMentionMenu = () => {
    setMentionMenuState(null);
    setMentionMenuIndex(0);
  };

  const syncComposerMentionMenu = (draft: string, caretPosition: number | null | undefined) => {
    if (!selectedThreadIsGroup || !canWrite || !!busyAction) {
      closeMentionMenu();
      return;
    }
    const activeQuery = findActiveMentionQuery(draft, caretPosition ?? draft.length);
    if (!activeQuery) {
      closeMentionMenu();
      return;
    }
    setMentionMenuState({
      mode: 'query',
      query: activeQuery.query,
      replaceFrom: activeQuery.replaceFrom,
      replaceTo: activeQuery.replaceTo,
    });
    setMentionMenuIndex(0);
  };

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextDraft = event.currentTarget.value;
    setMessageDraft(nextDraft);
    syncComposerMentionMenu(nextDraft, event.currentTarget.selectionStart);
  };

  const handleComposerSelectionSync = (textarea: HTMLTextAreaElement) => {
    syncComposerMentionMenu(textarea.value, textarea.selectionStart);
  };

  const sendMessage = async () => {
    if (!selectedThreadId || !messageDraft.trim()) return;
    const result = await sendSocialCommand<{ serverTimestamp: number; thread: ThreadSummary; message: SocialMessage }>(t('social:hub.actions.sendMessage'), 'send_thread_message', {
      threadId: selectedThreadId,
      body: messageDraft.trim(),
      replyToMessageId: composerReplyTarget?.messageId,
      mentionAgentIds: selectedThreadIsGroup ? composerMentionAgentIds : [],
      mentionEveryone: selectedThreadIsGroup ? composerMentionEveryone : false,
    });
    if (!result) return;
    setMessageDraft('');
    setComposerReplyTarget(null);
    setComposerMentionAgentIds([]);
    setComposerMentionEveryone(false);
    closeMentionMenu();
    shouldAutoFollowLatestRef.current = true;
    markFreshMessage(result.message.messageId);
    setInbox((current) => ({ ...current, threads: upsertThread(current.threads, result.thread) }));
    setThreadDetail((current) => current
      ? {
          ...current,
          thread: result.thread,
          messages: mergeMessageList(current.messages, result.message),
        }
      : current);
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (mentionMenuState) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionMenuIndex((current) => current + 1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionMenuIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMentionMenu();
        return;
      }
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (!canWrite || !!busyAction || !messageDraft.trim()) return;
    event.preventDefault();
    if (mentionMenuState) {
      const nextOption = mentionMenuOptions[mentionMenuIndex] ?? mentionMenuOptions[0] ?? null;
      if (nextOption) {
        applyMentionOption(nextOption);
        return;
      }
    }
    void sendMessage();
  };

  const selectReplyTarget = (message: SocialMessage) => {
    setMessageContextMenu(null);
    setComposerReplyTarget(message);
    composerTextareaRef.current?.focus();
  };

  const openMessageContextMenu = (event: ReactMouseEvent<HTMLElement>, message: SocialMessage) => {
    if (!canWrite || !!busyAction || typeof window === 'undefined') return;
    event.preventDefault();
    const menuWidth = 156;
    const menuHeight = 52;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);
    setMessageContextMenu({
      message,
      x: Math.max(12, x),
      y: Math.max(12, y),
    });
  };

  const removeMentionAgent = (agentId: string) => {
    setComposerMentionAgentIds((current) => current.filter((value) => value !== agentId));
    const member = mentionableMembers.find((entry) => entry.agentId === agentId);
    if (!member) return;
    setMessageDraft((current) => stripDraftMentionToken(current, `@${member.agentName}`));
  };

  const removeMentionEveryone = () => {
    setComposerMentionEveryone(false);
    setMessageDraft((current) => stripDraftMentionToken(current, EVERYONE_MENTION_TOKEN));
  };

  const applyMentionOption = (option: MentionMenuOption) => {
    const textarea = composerTextareaRef.current;
    const fallbackStart = textarea?.selectionStart ?? messageDraft.length;
    const fallbackEnd = textarea?.selectionEnd ?? messageDraft.length;
    const replaceFrom = mentionMenuState?.mode === 'query' ? mentionMenuState.replaceFrom : fallbackStart;
    const replaceTo = mentionMenuState?.mode === 'query' ? mentionMenuState.replaceTo : fallbackEnd;

    if (option.kind === 'everyone') {
      setComposerMentionEveryone(true);
      setComposerMentionAgentIds([]);
    } else {
      setComposerMentionEveryone(false);
      setComposerMentionAgentIds((current) => (current.includes(option.agentId) ? current : [...current, option.agentId]));
    }

    setMessageDraft((current) => {
      if (mentionMenuState?.mode !== 'query' && current.includes(option.token)) {
        pendingComposerSelectionRef.current = current.indexOf(option.token) + option.token.length;
        return current;
      }
      const nextBase = current;
      const next = replaceDraftRangeWithMention(nextBase, replaceFrom, replaceTo, option.token);
      pendingComposerSelectionRef.current = next.caret;
      return next.draft;
    });

    closeMentionMenu();
    composerTextareaRef.current?.focus();
  };

  const createGroup = async () => {
    const result = await sendSocialCommand<ThreadDetailPayload>(t('social:hub.actions.createGroup'), 'create_group', {
      title: groupTitle.trim(),
      memberAgentIds: groupMembers,
    });
    if (!result) return;
    notifySuccess(t('social:hub.feedback.groupCreated'));
    setGroupTitle('');
    setGroupMembers([]);
    shouldScrollThreadToBottomRef.current = true;
    setActiveTab('chats');
    setSelectedThreadId(result.thread.threadId);
    setThreadDetail(result);
  };

  const renameGroup = async () => {
    if (!selectedThreadId || !renameDraft.trim()) return;
    const result = await sendSocialCommand<{ serverTimestamp: number; thread: ThreadSummary }>(t('social:hub.actions.renameGroup'), 'rename_group', {
      threadId: selectedThreadId,
      title: renameDraft.trim(),
    });
    if (!result) return;
    setInbox((current) => ({ ...current, threads: upsertThread(current.threads, result.thread) }));
    setThreadDetail((current) => current ? { ...current, thread: result.thread } : current);
    notifySuccess(t('social:hub.feedback.groupRenamed'));
  };

  const inviteFriend = async () => {
    if (!selectedThreadId || !inviteAgentId) return;
    const result = await sendSocialCommand<ThreadDetailPayload>(t('social:hub.actions.inviteMember'), 'invite_group_member', {
      threadId: selectedThreadId,
      agentId: inviteAgentId,
    });
    if (!result) return;
    setInviteAgentId('');
    setThreadDetail(result);
    setInbox((current) => ({ ...current, threads: upsertThread(current.threads, result.thread) }));
  };

  const removeMember = async (memberAgentId: string) => {
    if (!selectedThreadId || !window.confirm(t('social:hub.confirm.removeMember'))) return;
    const result = await sendSocialCommand<ThreadDetailPayload>(t('social:hub.actions.removeMember'), 'remove_group_member', {
      threadId: selectedThreadId,
      agentId: memberAgentId,
    });
    if (!result) return;
    setThreadDetail(result);
    setInbox((current) => ({ ...current, threads: upsertThread(current.threads, result.thread) }));
  };

  const leaveOrDisband = async () => {
    if (!selectedThreadId) return;
    const commandId = selectedThread?.ownerAgentId === viewAgentId ? 'disband_group' : 'leave_group';
    const label = commandId === 'disband_group' ? t('social:hub.actions.disbandGroup') : t('social:hub.actions.leaveGroup');
    if (!window.confirm(t('social:hub.confirm.leaveOrDisband', { action: label }))) return;
    const result = await sendSocialCommand<{ serverTimestamp: number; inbox: InboxSnapshot }>(label, commandId, { threadId: selectedThreadId });
    if (!result) return;
    setInbox(result.inbox);
    if (result.inbox.threads[0]?.threadId) {
      shouldScrollThreadToBottomRef.current = true;
    }
    setSelectedThreadId(result.inbox.threads[0]?.threadId ?? null);
  };

  const sendRequest = async (agent: SocialAgentSummary) => {
    const result = await sendSocialCommand(t('social:hub.actions.sendRequest'), 'send_request', {
      agentId: agent.agentId,
      note: t('social:hub.contacts.compose.defaultRequestNote'),
    });
    if (!result) return;
    if (viewAgentId) {
      await loadRelationships(viewAgentId);
    }
    void refreshContacts();
  };

  const respondRequest = async (agentIdValue: string, decision: 'accept' | 'decline') => {
    const result = await sendSocialCommand(
      decision === 'accept' ? t('social:hub.actions.acceptRequest') : t('social:hub.actions.declineRequest'),
      'respond_request',
      { agentId: agentIdValue, decision },
    );
    if (!result) return;
    if (viewAgentId) {
      await loadRelationships(viewAgentId);
    }
    if (viewAgentId) {
      await loadInbox(viewAgentId);
    }
  };

  const blockAgent = async (agentIdValue: string) => {
    if (!window.confirm(t('social:hub.confirm.blockAgent'))) return;
    const result = await sendSocialCommand(t('social:hub.actions.blockAgent'), 'block_agent', { agentId: agentIdValue });
    if (!result) return;
    if (viewAgentId) {
      await loadRelationships(viewAgentId);
    }
    if (viewAgentId) {
      await loadInbox(viewAgentId);
    }
  };

  const unblockAgent = async (agentIdValue: string) => {
    const result = await sendSocialCommand(t('social:hub.actions.unblockAgent'), 'unblock_agent', { agentId: agentIdValue });
    if (!result) return;
    if (viewAgentId) {
      await loadRelationships(viewAgentId);
    }
  };

  const removeFriend = async (agentIdValue: string) => {
    if (!window.confirm(t('social:hub.confirm.removeFriend'))) return;
    const result = await sendSocialCommand(t('social:hub.actions.removeFriend'), 'remove_friend', { agentId: agentIdValue });
    if (!result) return;
    if (viewAgentId) {
      await loadRelationships(viewAgentId);
    }
    if (viewAgentId) {
      await loadInbox(viewAgentId);
    }
  };

  const publishMoment = async () => {
    const result = await sendSocialCommand<{ serverTimestamp: number; moment: MomentFeedItem }>(t('social:hub.actions.publishMoment'), 'create_moment', {
      body: momentDraft.trim(),
      assetIds: momentAssets.map((asset) => asset.assetId),
    });
    if (!result) return;
    setMomentDraft('');
    setMomentAssets([]);
    setIsMomentComposerOpen(false);
    setMoments((current) => ({
      ...current,
      moments: [result.moment, ...current.moments.filter((moment) => moment.momentId !== result.moment.momentId)]
        .sort((left, right) => right.createdAt - left.createdAt),
    }));
    notifySuccess(t('social:hub.feedback.momentPublished'));
  };

  const deleteMoment = async (momentId: string) => {
    if (!window.confirm(t('social:hub.confirm.deleteMoment'))) return;
    const result = await sendSocialCommand<{ serverTimestamp: number }>(t('social:hub.actions.deleteMoment'), 'delete_moment', { momentId });
    if (!result) return;
    setMoments((current) => ({
      ...current,
      moments: current.moments.filter((moment) => moment.momentId !== momentId),
    }));
  };

  const loadMomentComments = async (momentId: string, beforeCommentId?: string) => {
    if (!viewAgentId) return;
    const result = await sendSocialCommand<MomentCommentsPayload>(
      t('social:hub.moments.comment'),
      'list_moment_comments',
      withViewerAgentId(viewAgentId, beforeCommentId ? { momentId, beforeCommentId, limit: 20 } : { momentId, limit: 20 }),
    );
    if (!result || activeViewAgentIdRef.current !== viewAgentId) return;
    setMoments((current) => ({
      ...current,
      moments: current.moments.map((moment) => (
        moment.momentId === result.moment.momentId ? result.moment : moment
      )),
    }));
    setMomentCommentsById((current) => {
      const previous = current[momentId];
      return {
        ...current,
        [momentId]: {
          comments: beforeCommentId && previous
            ? [...result.comments, ...previous.comments.filter((comment) => !result.comments.some((next) => next.commentId === comment.commentId))]
            : result.comments,
          nextCursor: result.nextCursor,
          loaded: true,
        },
      };
    });
  };

  const toggleMomentLike = async (moment: MomentFeedItem) => {
    const result = await sendSocialCommand<{ serverTimestamp: number; moment: MomentFeedItem }>(
      moment.viewerHasLiked ? t('social:hub.moments.unlike') : t('social:hub.moments.like'),
      'set_moment_like',
      {
        momentId: moment.momentId,
        value: !moment.viewerHasLiked,
      },
    );
    if (!result) return;
    setMoments((current) => ({
      ...current,
      moments: current.moments.map((entry) => entry.momentId === result.moment.momentId ? result.moment : entry),
    }));
  };

  const toggleMomentComments = async (momentId: string) => {
    const isExpanded = expandedMomentIds.includes(momentId);
    if (!isExpanded && !momentCommentsById[momentId]?.loaded) {
      await loadMomentComments(momentId);
    }
    setExpandedMomentIds((current) => (
      current.includes(momentId)
        ? current.filter((entry) => entry !== momentId)
        : [...current, momentId]
    ));
  };

  const submitMomentComment = async (momentId: string) => {
    const draft = momentCommentDrafts[momentId]?.trim() ?? '';
    if (!draft) return;
    const replyTarget = momentReplyTargets[momentId] ?? null;
    const result = await sendSocialCommand<{ serverTimestamp: number; moment: MomentFeedItem; comment: MomentComment }>(
      replyTarget ? t('social:hub.moments.reply') : t('social:hub.moments.comment'),
      'create_moment_comment',
      {
        momentId,
        body: draft,
        replyToCommentId: replyTarget?.commentId,
      },
    );
    if (!result) return;
    setMoments((current) => ({
      ...current,
      moments: current.moments.map((moment) => moment.momentId === result.moment.momentId ? result.moment : moment),
    }));
    setExpandedMomentIds((current) => current.includes(momentId) ? current : [...current, momentId]);
    setMomentCommentsById((current) => ({
      ...current,
      [momentId]: {
        comments: mergeMomentComments(current[momentId]?.comments ?? [], result.comment),
        nextCursor: current[momentId]?.nextCursor ?? null,
        loaded: true,
      },
    }));
    setMomentCommentDrafts((current) => ({ ...current, [momentId]: '' }));
    setMomentReplyTargets((current) => ({ ...current, [momentId]: null }));
  };

  const removeMomentComment = async (momentId: string, commentId: string) => {
    const result = await sendSocialCommand<{ serverTimestamp: number; moment: MomentFeedItem; comment: MomentComment }>(
      t('social:hub.moments.deleteComment'),
      'delete_moment_comment',
      { commentId },
    );
    if (!result) return;
    setMoments((current) => ({
      ...current,
      moments: current.moments.map((moment) => moment.momentId === result.moment.momentId ? result.moment : moment),
    }));
    setMomentCommentsById((current) => ({
      ...current,
      [momentId]: {
        comments: mergeMomentComments(current[momentId]?.comments ?? [], result.comment),
        nextCursor: current[momentId]?.nextCursor ?? null,
        loaded: true,
      },
    }));
  };

  const toggleMomentNotifications = async () => {
    const nextOpen = !isMomentNotificationsOpen;
    if (nextOpen) {
      setIsMomentComposerOpen(false);
    }
    setIsMomentNotificationsOpen(nextOpen);
    if (!nextOpen || !viewAgentId) return;
    await loadMomentNotifications(viewAgentId);
  };

  const markMomentNotificationsRead = async () => {
    if (!viewAgentId || watchMode || momentNotifications.unreadCount <= 0) return;
    const targetViewAgentId = viewAgentId;
    const result = await sendSocialCommand<MomentNotificationsPayload>(
      t('social:hub.moments.markNotificationsRead'),
      'mark_moment_notifications_read',
      momentNotifications.lastNotificationAt > 0
        ? { beforeTimestamp: momentNotifications.lastNotificationAt }
        : undefined,
    );
    if (!result || activeViewAgentIdRef.current !== targetViewAgentId) return;
    setMomentNotifications({
      serverTimestamp: result.serverTimestamp,
      unreadCount: result.unreadCount,
      lastNotificationAt: result.lastNotificationAt,
      notifications: result.notifications,
    });
  };

  const onUploadAssets = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!viewAgentId || watchMode || files.length === 0) return;
    setIsMomentComposerOpen(true);
    setBusyAction(t('social:hub.actions.uploadImages'));
    notifyError('');
    try {
      const uploaded: UploadedMomentAsset[] = [];
      for (const file of files.slice(0, 4 - momentAssets.length)) {
        const result = await SocialApi.uploadMomentAsset(viewAgentId, file);
        uploaded.push(result.asset);
      }
      setMomentAssets((current) => [...current, ...uploaded]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : t('social:hub.errors.uploadFailed'));
    } finally {
      event.target.value = '';
      setBusyAction('');
    }
  };

  const selectedThreadIsOwner = selectedThread?.ownerAgentId === viewAgentId;
  const selectedThreadIsGroup = selectedThread?.kind === 'group';
  const closeMomentComposer = () => {
    setIsMomentComposerOpen(false);
  };
  const openMomentComposer = () => {
    if (!canWrite || !!busyAction) return;
    setIsMomentNotificationsOpen(false);
    setIsMomentComposerOpen(true);
  };
  const openMomentComposerImagePicker = () => {
    if (!canWrite || momentAssets.length >= 4 || !!busyAction) return;
    setIsMomentNotificationsOpen(false);
    setIsMomentComposerOpen(true);
    uploadInputRef.current?.click();
  };
  const mentionableMembers = useMemo(
    () => selectedMembers.filter((member) => member.agentId !== viewAgentId),
    [selectedMembers, viewAgentId],
  );
  const mentionMenuOptions = useMemo<MentionMenuOption[]>(() => {
    if (!selectedThreadIsGroup || mentionableMembers.length === 0) return [];
    const normalizedQuery = mentionMenuState?.query.trim().toLowerCase() ?? '';
    const options: MentionMenuOption[] = [];

    if (
      normalizedQuery.length === 0
      || EVERYONE_MENTION_SEARCH_TERMS.some((term) => term.includes(normalizedQuery))
    ) {
      options.push({
        key: 'everyone',
        kind: 'everyone',
        label: t('social:hub.chats.mentionEveryone'),
        subtitle: t('social:hub.chats.mentionEveryoneSubtitle', { count: mentionableMembers.length }),
        token: EVERYONE_MENTION_TOKEN,
      });
    }

    mentionableMembers.forEach((member) => {
      const matchesQuery = normalizedQuery.length === 0
        || member.agentName.toLowerCase().includes(normalizedQuery)
        || member.agentId.toLowerCase().includes(normalizedQuery);
      if (!matchesQuery) return;
      options.push({
        key: member.agentId,
        kind: 'member',
        agentId: member.agentId,
        agentName: member.agentName,
        role: member.role,
        label: member.agentName,
        subtitle: member.role === 'owner' ? t('social:hub.groupPanel.owner') : t('social:hub.chats.groupMember'),
        token: `@${member.agentName}`,
      });
    });

    return options;
  }, [mentionMenuState?.query, mentionableMembers, selectedThreadIsGroup]);
  const isMentionMenuOpen = Boolean(mentionMenuState && mentionMenuOptions.length > 0);
  const selectedMentionAgents = useMemo(
    () => composerMentionAgentIds
      .map((agentId) => mentionableMembers.find((member) => member.agentId === agentId))
      .filter((member): member is (typeof mentionableMembers)[number] => Boolean(member)),
    [composerMentionAgentIds, mentionableMembers],
  );
  const selectedDirectPeer = useMemo(() => {
    if (!selectedThread || selectedThread.kind !== 'direct') return null;
    if (selectedThread.directPeer) return selectedThread.directPeer;
    const peer = selectedMembers.find((member) => member.agentId !== viewAgentId);
    if (!peer) return null;
    return {
      agentId: peer.agentId,
      agentName: peer.agentName,
      description: null,
      avatarPath: null,
      isOnline: false,
    };
  }, [selectedMembers, selectedThread, viewAgentId]);
  const selectedDirectBlock = useMemo(
    () => selectedDirectPeer ? relationships.blocks.find((entry) => entry.agent.agentId === selectedDirectPeer.agentId) ?? null : null,
    [relationships.blocks, selectedDirectPeer],
  );
  const currentMomentCursor = moments.moments[moments.moments.length - 1]?.createdAt;
  const freshMessageIdSet = useMemo(() => new Set(freshMessageIds), [freshMessageIds]);
  useEffect(() => {
    if (!mentionMenuState) return;
    if (mentionMenuOptions.length === 0) {
      closeMentionMenu();
      return;
    }
    setMentionMenuIndex((current) => Math.min(current, mentionMenuOptions.length - 1));
  }, [mentionMenuOptions, mentionMenuState]);
  const unreadDividerMessageId = useMemo(() => {
    if (!threadDetail || !viewAgentId || (selectedThread?.unreadCount ?? 0) === 0) return null;
    let remainingUnread = selectedThread?.unreadCount ?? 0;
    let earliestVisibleUnreadMessageId: string | null = null;
    for (let index = threadDetail.messages.length - 1; index >= 0; index -= 1) {
      const message = threadDetail.messages[index];
      if (message.senderAgentId === viewAgentId || message.isDeleted) continue;
      remainingUnread -= 1;
      earliestVisibleUnreadMessageId = message.messageId;
      if (remainingUnread <= 0) break;
    }
    return earliestVisibleUnreadMessageId;
  }, [selectedThread?.unreadCount, threadDetail, viewAgentId]);

  const markFreshMessage = (messageId: string) => {
    setFreshMessageIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
    if (typeof window === 'undefined') return;
    const existingTimer = freshMessageTimersRef.current.get(messageId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
    const timer = window.setTimeout(() => {
      setFreshMessageIds((current) => current.filter((id) => id !== messageId));
      freshMessageTimersRef.current.delete(messageId);
    }, 1600);
    freshMessageTimersRef.current.set(messageId, timer);
  };

  const playIncomingMessageTone = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || document.visibilityState === 'hidden') {
      return;
    }
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;

    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === 'suspended' && !audioUnlockedRef.current) return;

    const startTone = () => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(768, now);
      oscillator.frequency.exponentialRampToValueAtTime(1060, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.022, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    };

    if (context.state === 'suspended') {
      void context.resume().then(() => {
        audioUnlockedRef.current = true;
        startTone();
      }).catch(() => {});
      return;
    }

    audioUnlockedRef.current = true;
    startTone();
  };

  const focusThread = (threadId: string) => {
    shouldScrollThreadToBottomRef.current = true;
    shouldAutoFollowLatestRef.current = true;
    setPendingLatestCount(0);
    setActiveTab('chats');
    setSelectedThreadId(threadId);
    if (selectedThreadIdRef.current === threadId && typeof window !== 'undefined') {
      scheduleScrollElementToBottom(messageStreamRef.current);
    }
  };

  const activateChatsTab = () => {
    if (activeTab === 'chats') return;
    shouldScrollThreadToBottomRef.current = true;
    shouldAutoFollowLatestRef.current = true;
    setPendingLatestCount(0);
    setActiveTab('chats');
  };

  const handleMessageStreamScroll = () => {
    const element = messageStreamRef.current;
    if (!element) return;
    if (messageContextMenu) {
      setMessageContextMenu(null);
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoFollowLatestRef.current = distanceFromBottom < 96;
    if (distanceFromBottom < 96) {
      setPendingLatestCount(0);
    }
  };

  const jumpToLatestMessages = () => {
    shouldAutoFollowLatestRef.current = true;
    setPendingLatestCount(0);
    scheduleScrollElementToBottom(messageStreamRef.current);
  };

  const markSelectedThreadRead = async () => {
    if (!selectedThread) return;
    const result = await sendSocialCommand<{ serverTimestamp: number; inbox: InboxSnapshot; thread: ThreadSummary }>(
      t('social:hub.actions.markRead'),
      'mark_thread_read',
      { threadId: selectedThread.threadId },
    );
    if (!result) return;
    setInbox(result.inbox);
    setThreadDetail((current) => current ? { ...current, thread: result.thread } : current);
  };

  const currentViewLabel = selectedViewAgent
    ? selectedViewAgent.agentId === ownerAgent?.id
      ? t('social:hub.view.you')
      : selectedViewAgent.agentName
    : t('social:hub.view.defaultLabel');

  return (
    <div className="social-shell">
      {!ownerAgent ? (
        <div className="social-float-stack">
          <article className="social-float-card social-float-card--warning">
            <CircleAlert size={18} />
            <div>
              <strong>{t('social:hub.ownerMissing.title')}</strong>
              <p>{t('social:hub.ownerMissing.body')}</p>
            </div>
            <Link className="social-btn social-btn--ghost" to="/agents">{t('common:actions.goToAgentCenter')}</Link>
          </article>
        </div>
      ) : null}

      <section className="social-stage">
        <aside className="social-panel social-panel--nav">
          <div className="social-nav-head">
            <div className="social-nav-head__controls">
              <div className="social-view-switcher" ref={viewSwitcherRef}>
              <button
                type="button"
                className={`social-view-switcher__trigger${isViewMenuOpen ? ' is-open' : ''}${watchMode ? ' is-watch' : ''}`}
                onClick={() => setIsViewMenuOpen((current) => !current)}
                disabled={!ownerAgent || availableAgents.length === 0}
                aria-haspopup="dialog"
                aria-expanded={isViewMenuOpen}
                aria-label={t('social:hub.view.switchAria', { current: currentViewLabel })}
              >
                <span className="social-view-switcher__avatar" aria-hidden="true">
                  {initials(selectedViewAgent?.agentName ?? ownerAgent?.name ?? 'U')}
                </span>
                {watchMode || selectedViewAgent?.restricted || selectedViewAgent?.frozen ? (
                  <span
                    className={`social-view-switcher__marker${selectedViewAgent?.restricted || selectedViewAgent?.frozen ? ' is-warning' : ''}`}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
              <div className={`social-view-switcher__current-badge${watchMode ? ' is-watch' : ''}`} aria-hidden="true">
                <strong>{currentViewLabel}</strong>
                <span>{watchMode ? t('social:hub.view.watchBadge') : t('social:hub.view.currentBadge')}</span>
              </div>

              {isViewMenuOpen ? (
                <div className="social-view-switcher__popover" role="dialog" aria-label={t('social:hub.view.dialogAria')}>
                  <div className="social-view-switcher__summary">
                    <p className="social-label">{t('social:hub.view.kicker')}</p>
                    <div className="social-view-switcher__summary-row">
                      <div>
                        <strong>{currentViewLabel}</strong>
                        <span>{watchMode ? t('social:hub.view.watchSummary') : t('social:hub.view.currentSummary')}</span>
                      </div>
                      <div className="social-view-switcher__pills">
                        {watchMode ? <span className="social-view-switcher__pill">{t('social:hub.view.watchBadge')}</span> : null}
                        {selectedViewAgent?.restricted ? <span className="social-view-switcher__pill social-view-switcher__pill--warning">{t('social:hub.view.restricted')}</span> : null}
                        {selectedViewAgent?.frozen ? <span className="social-view-switcher__pill social-view-switcher__pill--warning">{t('social:hub.view.frozen')}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="social-view-switcher__list">
                    {ownerViewAgent ? (
                      <div className="social-view-switcher__group">
                        <p className="social-view-switcher__group-label">{t('social:hub.view.ownerGroup')}</p>
                        <button
                          type="button"
                          className={`social-view-switcher__option${ownerViewAgent.agentId === viewAgentId ? ' is-active' : ''}`}
                          onClick={() => {
                            setSelectedViewAgentId(ownerViewAgent.agentId);
                            setIsViewMenuOpen(false);
                          }}
                        >
                          <span className="social-view-switcher__option-avatar" aria-hidden="true">{initials(ownerViewAgent.agentName)}</span>
                          <span className="social-view-switcher__option-copy">
                            <strong>{t('social:hub.view.you')}</strong>
                            <span>{ownerViewAgent.agentName}</span>
                          </span>
                          <span className="social-view-switcher__option-meta">
                            {ownerViewAgent.restricted ? <span className="social-view-switcher__tag social-view-switcher__tag--warning">{t('social:hub.view.restricted')}</span> : null}
                            {ownerViewAgent.frozen ? <span className="social-view-switcher__tag social-view-switcher__tag--warning">{t('social:hub.view.frozen')}</span> : null}
                            {ownerViewAgent.agentId === viewAgentId ? <span className="social-view-switcher__tag">{t('social:hub.view.currentBadge')}</span> : null}
                          </span>
                        </button>
                      </div>
                    ) : null}

                    {otherViewAgents.length > 0 ? (
                      <div className="social-view-switcher__group">
                        <p className="social-view-switcher__group-label">{t('social:hub.view.otherGroup')}</p>
                        {otherViewAgents.map((agent) => (
                          <button
                            key={agent.agentId}
                            type="button"
                            className={`social-view-switcher__option${agent.agentId === viewAgentId ? ' is-active' : ''}`}
                            onClick={() => {
                              setSelectedViewAgentId(agent.agentId);
                              setIsViewMenuOpen(false);
                            }}
                          >
                            <span className="social-view-switcher__option-avatar" aria-hidden="true">{initials(agent.agentName)}</span>
                            <span className="social-view-switcher__option-copy">
                              <strong>{agent.agentName}</strong>
                              <span>{t('social:hub.view.agentPerspective')}</span>
                            </span>
                            <span className="social-view-switcher__option-meta">
                              {agent.restricted ? <span className="social-view-switcher__tag social-view-switcher__tag--warning">{t('social:hub.view.restricted')}</span> : null}
                              {agent.frozen ? <span className="social-view-switcher__tag social-view-switcher__tag--warning">{t('social:hub.view.frozen')}</span> : null}
                              {agent.agentId === viewAgentId ? <span className="social-view-switcher__tag">{t('social:hub.view.currentBadge')}</span> : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="social-view-switcher__footer">
                    <button
                      type="button"
                      className="social-btn social-btn--ghost social-btn--full"
                      onClick={openPrivacyPanel}
                    >
                      <Shield size={14} />
                      {t('social:hub.privacy.title')}
                    </button>
                  </div>
                </div>
              ) : null}
              </div>
              <SocialLanguageToggle />
            </div>
          </div>

          <div className="social-segmented">
            <button className={activeTab === 'chats' ? 'is-active' : ''} onClick={activateChatsTab}>
              <MessagesSquare size={16} />
              {t('social:hub.tabs.chats')}
            </button>
            <button className={activeTab === 'contacts' ? 'is-active' : ''} onClick={() => setActiveTab('contacts')}>
              <Users size={16} />
              {t('social:hub.tabs.contacts')}
            </button>
            <button className={activeTab === 'moments' ? 'is-active' : ''} onClick={() => setActiveTab('moments')}>
              <Sparkles size={16} />
              {t('social:hub.tabs.moments')}
            </button>
          </div>

          {activeTab === 'chats' ? (
            <div className="social-panel__block">
              <div className="social-panel__head">
                <span>{t('social:hub.chatList.title')}</span>
                <strong>{t('social:hub.chatList.unreadCount', { count: inbox.unreadTotal })}</strong>
              </div>
              <div className="social-thread-list">
                {inbox.threads.length === 0 ? (
                  <div className="social-empty">{t('social:hub.chatList.empty')}</div>
                ) : inbox.threads.map((thread) => (
                  <button
                    key={thread.threadId}
                    className={`social-thread-card${thread.threadId === selectedThreadId ? ' is-active' : ''}`}
                    onClick={() => focusThread(thread.threadId)}
                  >
                    <span className={`social-thread-card__avatar${thread.kind === 'group' ? ' is-group' : ''}`} aria-hidden="true">
                      {initials(thread.directPeer?.agentName ?? thread.title)}
                    </span>
                    <div className="social-thread-card__content">
                      <div className="social-thread-card__row">
                        <strong className="social-thread-card__title">{thread.title}</strong>
                        <span className="social-thread-card__time">{thread.lastMessageAt ? formatPluginTime(thread.lastMessageAt) : t('social:hub.chatList.newThread')}</span>
                      </div>
                      <div className="social-thread-card__preview-row">
                        <p className="social-thread-card__preview">{thread.lastMessagePreview || (thread.kind === 'group' ? t('social:hub.chatList.groupPreview') : t('social:hub.chatList.directPreview'))}</p>
                        {thread.unreadCount > 0 ? <span className="social-pill">{thread.unreadCount}</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === 'contacts' ? (
            <div className="social-panel__block">
              <div className="social-contacts-toolbar">
                <label className="social-contacts-search">
                  <Search size={15} />
                  <input
                    value={contactsNavQuery}
                    onChange={(event) => setContactsNavQuery(event.target.value)}
                    placeholder={t('social:hub.contacts.navSearchPlaceholder')}
                  />
                </label>
                <button
                  type="button"
                  className={`social-contacts-toolbar__plus${contactsMode === 'compose' ? ' is-active' : ''}`}
                  onClick={() => setContactsMode((current) => current === 'compose' ? 'browse' : 'compose')}
                  aria-label={contactsMode === 'compose' ? t('social:hub.contacts.composeBackAria') : t('social:hub.contacts.composeOpenAria')}
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="social-contacts-sections">
                <section className="social-contacts-section">
                  <button
                    type="button"
                    className="social-contacts-section__toggle"
                    onClick={() => setContactsGroupsExpanded((current) => !current)}
                  >
                    <span>
                      {contactsGroupsExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {t('social:hub.contacts.groupsTitle')}
                    </span>
                    <strong>{filteredContactGroups.length}</strong>
                  </button>
                  {contactsGroupsExpanded ? (
                    <div className="social-contacts-section__list">
                      {filteredContactGroups.length === 0 ? (
                        <div className="social-empty">{t('social:hub.contacts.emptyGroups')}</div>
                      ) : filteredContactGroups.map((thread) => (
                        <button
                          key={thread.threadId}
                          type="button"
                          className="social-thread-card social-thread-card--contact-group"
                          onClick={() => focusThread(thread.threadId)}
                        >
                          <span className="social-thread-card__avatar is-group" aria-hidden="true">
                            {initials(thread.title)}
                          </span>
                          <div className="social-thread-card__content">
                            <div className="social-thread-card__row">
                              <strong className="social-thread-card__title">{thread.title}</strong>
                              <span className="social-thread-card__time">{thread.lastMessageAt ? formatPluginTime(thread.lastMessageAt) : t('social:hub.chatList.newThread')}</span>
                            </div>
                            <div className="social-thread-card__preview-row">
                              <p className="social-thread-card__preview">{t('social:hub.contacts.groupSummary', { count: thread.memberCount, preview: thread.lastMessagePreview || t('social:hub.contacts.groupSummaryFallback') })}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="social-contacts-section">
                  <button
                    type="button"
                    className="social-contacts-section__toggle"
                    onClick={() => setContactsFriendsExpanded((current) => !current)}
                  >
                    <span>
                      {contactsFriendsExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {t('social:hub.contacts.friendsTitle')}
                    </span>
                    <strong>{filteredContactFriends.length}</strong>
                  </button>
                  {contactsFriendsExpanded ? (
                    <div className="social-contacts-section__list social-friend-list">
                      {filteredContactFriends.length === 0 ? (
                        <div className="social-empty">{t('social:hub.contacts.emptyFriends')}</div>
                      ) : filteredContactFriends.map((friend) => (
                        <button
                          key={friend.agentId}
                          className={`social-friend-card${friend.agentId === selectedContact?.agentId ? ' is-active' : ''}`}
                          onClick={() => {
                            setContactsMode('browse');
                            setSelectedContactAgentId(friend.agentId);
                          }}
                          type="button"
                        >
                          <AgentBadge agent={friend} showSecondary={false} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}
        </aside>

        <main className="social-panel social-panel--main">
          {activeTab === 'chats' ? (
            <div className="social-tab">
              <header className="social-main-header">
                <div>
                  <p className="social-label">{t('social:hub.chats.kicker')}</p>
                  <h2>{selectedThread?.title ?? t('social:hub.chats.title')}</h2>
                </div>
                <div className="social-main-header__meta">
                  {selectedThread ? <span>{selectedThread.kind === 'group' ? t('social:hub.chats.groupType') : t('social:hub.chats.directType')}</span> : <span>{t('social:hub.chats.idleMeta')}</span>}
                  {selectedThread && selectedThread.lastMessageAt ? <span>{formatPluginDateTime(selectedThread.lastMessageAt)}</span> : null}
                </div>
              </header>

              {!selectedThread || !threadDetail ? (
                <div className="social-empty social-empty--hero">
                  <MessageCircle size={22} />
                  <strong>{t('social:hub.chats.emptyTitle')}</strong>
                  <p>{t('social:hub.chats.emptyBody')}</p>
                </div>
              ) : (
                <div className="social-thread-stage">
                  <div ref={messageStreamRef} className="social-message-stream" onScroll={handleMessageStreamScroll}>
                    <button
                      className="social-btn social-btn--ghost social-btn--compact"
                      onClick={() => viewAgentId && void loadThread(viewAgentId, selectedThread.threadId, threadDetail.nextCursor ?? undefined)}
                      disabled={!threadDetail.nextCursor || !!busyAction}
                    >
                      <RefreshCw size={14} />
                      {t('social:hub.actions.loadEarlierMessages')}
                    </button>

                    {threadDetail.messages.map((message, index) => {
                      const mine = message.senderAgentId === viewAgentId;
                      const previousMessage = threadDetail.messages[index - 1] ?? null;
                      const nextMessage = threadDetail.messages[index + 1] ?? null;
                      const groupedWithPrevious = areMessagesGrouped(previousMessage, message);
                      const groupedWithNext = areMessagesGrouped(message, nextMessage);
                      const showDatePill = !previousMessage || !isSameCalendarDay(previousMessage.createdAt, message.createdAt);
                      const showUnreadDivider = !mine && unreadDividerMessageId === message.messageId;
                      const showSenderLabel = selectedThread.kind === 'group' && !mine && !groupedWithPrevious;
                      const tightenWithPrevious = groupedWithPrevious && !showDatePill && !showUnreadDivider;
                      return (
                        <Fragment key={message.messageId}>
                          {showDatePill ? (
                            <div className="social-message-day-pill">
                              <span>{formatMessageDayPill(message.createdAt)}</span>
                            </div>
                          ) : null}
                          {showUnreadDivider ? (
                            <div className="social-unread-divider" role="status" aria-live="polite">
                              <span>{t('social:hub.chats.unreadDivider')}</span>
                            </div>
                          ) : null}
                          <div
                            className={`social-message-row${mine ? ' social-message-row--mine' : ''}${tightenWithPrevious ? ' is-grouped-with-previous' : ''}${groupedWithNext ? ' is-grouped-with-next' : ''}`}
                          >
                            {showSenderLabel ? <div className="social-message-group-label">{message.senderAgentName}</div> : null}
                            <div className="social-message-row__track">
                              <article
                                className={`social-bubble${mine ? ' social-bubble--mine' : ''}${freshMessageIdSet.has(message.messageId) ? ' is-fresh' : ''}`}
                                onContextMenu={(event) => openMessageContextMenu(event, message)}
                              >
                                {message.replyTo ? (
                                  <button
                                    type="button"
                                    className="social-bubble__reply"
                                    onClick={() => {
                                      const replied = threadDetail.messages.find((entry) => entry.messageId === message.replyTo?.messageId);
                                      if (!replied) return;
                                      selectReplyTarget(replied);
                                    }}
                                    title={`${message.replyTo.senderAgentName}: ${message.replyTo.body}`}
                                  >
                                    <strong>{message.replyTo.senderAgentName}</strong>
                                    <span>{message.replyTo.body}</span>
                                  </button>
                                ) : null}
                                {message.mentionEveryone || message.mentions.length > 0 ? (
                                  <div className="social-bubble__mentions">
                                    {message.mentionEveryone ? <span>@{t('social:hub.chats.mentionEveryone')}</span> : null}
                                    {message.mentions.map((mention) => <span key={mention.agentId}>@{mention.agentName}</span>)}
                                  </div>
                                ) : null}
                                <div className="social-bubble__body">
                                  <p className="social-bubble__copy">
                                    <span className="social-bubble__text">{message.body}</span>
                                    <span className="social-bubble__time">{formatMessageBubbleTime(message.createdAt)}</span>
                                  </p>
                                </div>
                              </article>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>

                  {messageContextMenu ? (
                    <div
                      ref={messageContextMenuRef}
                      className="social-message-context-menu"
                      style={{ left: `${messageContextMenu.x}px`, top: `${messageContextMenu.y}px` }}
                    >
                      <button
                        type="button"
                        className="social-message-context-menu__item"
                        onClick={() => selectReplyTarget(messageContextMenu.message)}
                      >
                        <CornerUpLeft size={13} />
                        <span>{t('social:hub.chats.reply')}</span>
                      </button>
                    </div>
                  ) : null}

                  {pendingLatestCount > 0 ? (
                    <button
                      type="button"
                      className="social-latest-banner"
                      onClick={jumpToLatestMessages}
                    >
                      <Bell size={14} />
                      {t('social:hub.chats.latestMessages', { count: pendingLatestCount })}
                    </button>
                  ) : null}

                  <footer ref={composerRef} className="social-composer">
                    {composerReplyTarget ? (
                      <div className="social-composer__replying">
                        <div className="social-composer__replying-copy" title={`${composerReplyTarget.senderAgentName}: ${composerReplyTarget.body}`}>
                          <strong>{t('social:hub.chats.replyingTo', { name: composerReplyTarget.senderAgentName })}</strong>
                          <span>{composerReplyTarget.body}</span>
                        </div>
                        <button type="button" className="social-icon-btn" onClick={() => setComposerReplyTarget(null)}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : null}
                    {composerMentionEveryone || selectedMentionAgents.length > 0 ? (
                      <div className="social-composer__mention-strip">
                        {composerMentionEveryone ? (
                          <button type="button" className="social-composer__mention-chip" onClick={removeMentionEveryone}>
                            @{t('social:hub.chats.mentionEveryone')}
                            <X size={12} />
                          </button>
                        ) : null}
                        {selectedMentionAgents.map((member) => (
                          <button key={member.agentId} type="button" className="social-composer__mention-chip" onClick={() => removeMentionAgent(member.agentId)}>
                            @{member.agentName}
                            <X size={12} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <textarea
                      ref={composerTextareaRef}
                      rows={1}
                      value={messageDraft}
                      onChange={handleComposerChange}
                      onKeyDown={handleComposerKeyDown}
                      onClick={(event) => handleComposerSelectionSync(event.currentTarget)}
                      onSelect={(event) => handleComposerSelectionSync(event.currentTarget)}
                      placeholder={watchMode ? t('social:hub.placeholders.watchMode') : canWrite ? t('social:hub.placeholders.message') : t('social:hub.placeholders.noWrite')}
                      disabled={!canWrite || !!busyAction}
                    />
                    <div className="social-composer__actions">
                      {selectedThreadIsGroup ? (
                        <div className="social-composer__menus">
                          <button
                            type="button"
                            className="social-btn social-btn--ghost social-btn--compact"
                            onClick={() => {
                              if (!mentionableMembers.length) return;
                              setMentionMenuState((current) => current?.mode === 'manual'
                                ? null
                                : {
                                    mode: 'manual',
                                    query: '',
                                    replaceFrom: null,
                                    replaceTo: null,
                                  });
                              setMentionMenuIndex(0);
                              composerTextareaRef.current?.focus();
                            }}
                            disabled={!canWrite || !!busyAction || mentionableMembers.length === 0}
                          >
                            <AtSign size={14} />
                            {t('social:hub.chats.mention')}
                          </button>
                          {isMentionMenuOpen ? (
                            <div className="social-mention-menu">
                              {mentionMenuOptions.map((option, index) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  className={`social-mention-menu__item${mentionMenuIndex === index ? ' is-active' : ''}`}
                                  onClick={() => applyMentionOption(option)}
                                  aria-selected={mentionMenuIndex === index}
                                >
                                  <span className="social-mention-menu__avatar" aria-hidden="true">
                                    {option.kind === 'everyone' ? <Users size={16} /> : initials(option.agentName)}
                                  </span>
                                  <div>
                                    <strong>{option.label}</strong>
                                    <span>{option.subtitle}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <button className="social-btn social-btn--ghost" onClick={() => void markSelectedThreadRead()} disabled={!canWrite || !!busyAction}>
                        <Bell size={14} />
                        {t('social:hub.actions.markRead')}
                      </button>
                      <button className="social-btn" onClick={() => void sendMessage()} disabled={!canWrite || !messageDraft.trim() || !!busyAction}>
                        <Send size={14} />
                        {t('social:hub.actions.sendMessage')}
                      </button>
                    </div>
                  </footer>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'contacts' ? (
            <div className="social-tab">
              <header className="social-main-header">
                <div>
                  <p className="social-label">{t('social:hub.contacts.kicker')}</p>
                  <h2>{contactsMode === 'compose' ? t('social:hub.contacts.composeTitle') : t('social:hub.contacts.browseTitle')}</h2>
                </div>
              </header>

              {contactsMode === 'compose' ? (
                <>
                  <section className="social-search-panel">
                    <input
                      value={contactQuery}
                      onChange={(event) => setContactQuery(event.target.value)}
                      placeholder={t('social:hub.contacts.searchPlaceholder')}
                    />
                    <button className="social-btn" onClick={() => void refreshContacts()} disabled={!canRead || !!busyAction}>
                      <UserPlus size={14} />
                      {t('social:hub.actions.searchContacts')}
                    </button>
                  </section>

                  <section className="social-grid social-grid--contacts">
                    <article className="social-card">
                      <div className="social-card__head">
                        <strong>{t('social:hub.contacts.incomingTitle')}</strong>
                        <span>{relationships.incomingRequests.length}</span>
                      </div>
                      <div className="social-card__scroll">
                        {relationships.incomingRequests.map((request) => (
                          <div key={request.agent.agentId} className="social-contact-row">
                            <AgentBadge agent={request.agent} />
                            <p>{request.note || t('social:hub.contacts.incomingFallbackNote')}</p>
                            <div className="social-contact-row__actions">
                              <button className="social-btn" onClick={() => void respondRequest(request.agent.agentId, 'accept')} disabled={!canWrite || !!busyAction}>{t('social:hub.actions.acceptRequest')}</button>
                              <button className="social-btn social-btn--ghost" onClick={() => void respondRequest(request.agent.agentId, 'decline')} disabled={!canWrite || !!busyAction}>{t('social:hub.actions.declineRequest')}</button>
                            </div>
                          </div>
                        ))}
                        {relationships.incomingRequests.length === 0 ? <div className="social-empty">{t('social:hub.contacts.emptyIncoming')}</div> : null}
                      </div>
                    </article>

                    <article className="social-card">
                      <div className="social-card__head">
                        <strong>{t('social:hub.contacts.discoveryTitle')}</strong>
                        <span>{contactResults.length}</span>
                      </div>
                      <div className="social-card__scroll">
                        {contactResults.map((result) => (
                          <div key={result.agentId} className="social-contact-row">
                            <AgentBadge agent={result} showAgentId />
                            <div className="social-contact-row__actions">
                              {result.relationship === 'friend' ? (
                                <button
                                  className="social-btn"
                                  onClick={() => {
                                    setContactsMode('browse');
                                    setSelectedContactAgentId(result.agentId);
                                  }}
                                  disabled={!relationships.friends.some((friend) => friend.agentId === result.agentId)}
                                >
                                  {t('social:hub.contacts.viewProfile')}
                                </button>
                              ) : null}
                              {result.relationship === 'none' ? <button className="social-btn" onClick={() => void sendRequest(result)} disabled={!canWrite || !!busyAction}>{t('social:hub.actions.addFriend')}</button> : null}
                              {result.relationship === 'blocked' ? <span className="social-pill">{t('social:hub.relationships.blocked')}</span> : null}
                              {result.relationship === 'incoming_request' ? <span className="social-pill">{t('social:hub.contacts.incomingPill')}</span> : null}
                              {result.relationship === 'outgoing_request' ? <span className="social-pill">{t('social:hub.contacts.outgoingPill')}</span> : null}
                            </div>
                          </div>
                        ))}
                        {contactResults.length === 0 ? <div className="social-empty">{t('social:hub.contacts.discoveryEmpty')}</div> : null}
                      </div>
                    </article>
                  </section>
                </>
              ) : (
                <section className="social-grid social-grid--contacts-browse">
                  <article className="social-card">
                    <div className="social-card__head">
                      <strong>{t('social:hub.contacts.currentTitle')}</strong>
                      <span>{selectedContact ? t('social:hub.contacts.selected') : t('social:hub.contacts.waitingSelection')}</span>
                    </div>
                    {selectedContact ? (
                      <div className="social-card__scroll">
                        <article className="social-detail-sheet social-detail-sheet--inline">
                          <div className="social-detail-sheet__hero">
                            <div className="social-detail-sheet__avatar" aria-hidden="true">{initials(selectedContact.agentName)}</div>
                            <div className="social-detail-sheet__copy">
                              <strong>{selectedContact.agentName}</strong>
                            </div>
                            <span className={`social-status-pill${selectedContact.isOnline ? ' is-online' : ''}`}>{presenceLabel(selectedContact.isOnline)}</span>
                          </div>
                          <div className="social-detail-section">
                            {selectedContactThread ? (
                              <>
                                <div className="social-detail-row">
                                  <span>{t('social:hub.contacts.lastInteraction')}</span>
                                  <strong>{selectedContactThread.lastMessageAt ? formatPluginDateTime(selectedContactThread.lastMessageAt) : t('social:hub.contacts.justStarted')}</strong>
                                </div>
                                <div className="social-detail-row">
                                  <span>{t('social:hub.contacts.threadSummary')}</span>
                                  <strong>{selectedContactThread.lastMessagePreview || t('social:hub.contacts.threadSummaryFallback')}</strong>
                                </div>
                              </>
                            ) : (
                              <div className="social-empty">{t('social:hub.contacts.noDirectYet')}</div>
                            )}
                          </div>
                        </article>
                      </div>
                    ) : (
                      <div className="social-empty">{t('social:hub.contacts.noSelectedContact')}</div>
                    )}
                  </article>

                  <article className="social-card">
                    <div className="social-card__head">
                      <strong>{selectedContact ? t('social:hub.contacts.contactMomentsTitle') : t('social:hub.contacts.friendsMomentsTitle')}</strong>
                      <span>{selectedContactMoments.length}</span>
                    </div>
                    <div className="social-card__scroll">
                      {!selectedContact ? (
                        <div className="social-empty">{t('social:hub.contacts.noSelectedMoments')}</div>
                      ) : selectedContactMoments.length === 0 ? (
                        <div className="social-empty">{t('social:hub.contacts.noMomentsYet')}</div>
                      ) : (
                        <div className="social-contact-moment-list">
                          {selectedContactMoments.map((moment) => (
                            <article key={moment.momentId} className="social-contact-moment">
                              <div className="social-contact-moment__head">
                                <strong>{formatPluginDateTime(moment.createdAt)}</strong>
                                <span>{moment.images.length > 0 ? t('social:hub.contacts.momentImageCount', { count: moment.images.length }) : t('social:hub.contacts.textOnly')}</span>
                              </div>
                              <p>{moment.body || t('social:hub.contacts.imageOnlyMoment')}</p>
                              {moment.images.length > 0 ? (
                                <div className={`social-contact-moment__gallery social-contact-moment__gallery--${Math.min(moment.images.length, 3)}`}>
                                  {moment.images.slice(0, 3).map((image) => (
                                    <img key={image.assetId} src={image.url} alt="" loading="lazy" />
                                  ))}
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                </section>
              )}
            </div>
          ) : null}

          {activeTab === 'moments' ? (
            <div className="social-tab social-tab--moments">
              <header className="social-main-header social-main-header--moments">
                <div className="social-main-header__content">
                  <p className="social-label">{t('social:hub.moments.kicker')}</p>
                  <h2>{t('social:hub.moments.title')}</h2>
                </div>
                <div className="social-main-header__actions">
                  <button
                    type="button"
                    className="social-btn social-main-header__compose-trigger"
                    onClick={openMomentComposer}
                    disabled={!canWrite || !!busyAction}
                    aria-haspopup="dialog"
                    aria-expanded={isMomentComposerOpen}
                    aria-label={t('social:hub.moments.openComposer')}
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    className="social-btn social-btn--ghost social-main-header__action"
                    onClick={() => void toggleMomentNotifications()}
                    disabled={!canRead || !!busyAction}
                    aria-haspopup="dialog"
                    aria-expanded={isMomentNotificationsOpen}
                  >
                    <Bell size={14} />
                    {t('social:hub.moments.notificationsTitle')}
                    <span>{momentNotifications.unreadCount}</span>
                  </button>
                </div>
              </header>

              <input ref={uploadInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onUploadAssets} />

              <div className="social-tab__scroll">
                <div className="social-moment-feed">
                  {moments.moments.map((moment) => (
                    <article key={moment.momentId} className="social-moment-card">
                      <div className="social-moment-card__head">
                        <div className="social-moment-card__identity">
                          <strong>{moment.authorAgentName}</strong>
                          <span>{formatPluginDateTime(moment.createdAt)}</span>
                        </div>
                        {moment.authorAgentId === viewAgentId ? (
                          <button className="social-btn social-btn--ghost social-btn--compact social-moment-card__delete" onClick={() => void deleteMoment(moment.momentId)} disabled={!canWrite || !!busyAction}>
                            {t('social:hub.actions.deleteMoment')}
                          </button>
                        ) : null}
                      </div>
                      <p>{moment.body}</p>
                      {moment.images.length > 0 ? (
                        <div className={`social-moment-card__gallery social-moment-card__gallery--${Math.min(moment.images.length, 4)}`}>
                          {moment.images.map((image) => (
                            <img key={image.assetId} src={image.url} alt="" loading="lazy" />
                          ))}
                        </div>
                      ) : null}
                      <div className="social-moment-card__meta">
                        <span>{t('social:hub.moments.likeCount', { count: moment.likeCount })}</span>
                        <span>{t('social:hub.moments.commentCount', { count: moment.commentCount })}</span>
                        {moment.likePreviewAgents.length > 0 ? (
                          <span>{moment.likePreviewAgents.map((agent) => agent.agentName).join(', ')}</span>
                        ) : null}
                      </div>
                      <div className="social-moment-card__actions">
                        <button
                          className={`social-btn social-btn--ghost social-btn--compact social-moment-card__action${moment.viewerHasLiked ? ' is-active' : ''}`}
                          onClick={() => void toggleMomentLike(moment)}
                          disabled={!canWrite || !!busyAction}
                          aria-label={moment.viewerHasLiked ? t('social:hub.moments.unlike') : t('social:hub.moments.like')}
                          aria-pressed={moment.viewerHasLiked}
                        >
                          <Heart size={16} fill={moment.viewerHasLiked ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="social-btn social-btn--ghost social-btn--compact social-moment-card__action"
                          onClick={() => void toggleMomentComments(moment.momentId)}
                          disabled={!canRead || !!busyAction}
                          aria-label={t('social:hub.moments.comment')}
                        >
                          <MessageCircle size={16} />
                        </button>
                      </div>

                      {(moment.commentPreview.length > 0 || expandedMomentIds.includes(moment.momentId)) ? (
                        <div className="social-moment-comments">
                          {(expandedMomentIds.includes(moment.momentId)
                            ? (momentCommentsById[moment.momentId]?.comments ?? moment.commentPreview)
                            : moment.commentPreview).map((comment) => (
                            <div key={comment.commentId} className="social-moment-comment">
                              <div className="social-moment-comment__head">
                                <strong>{comment.authorAgentName}</strong>
                                <span>{formatPluginTime(comment.createdAt)}</span>
                              </div>
                              <p>{comment.replyTo ? `${t('social:hub.moments.replyingTo', { name: comment.replyTo.agentName })} ` : ''}{comment.body}</p>
                              <div className="social-moment-comment__actions">
                                <button
                                  className="social-btn social-btn--ghost social-btn--compact"
                                  onClick={() => setMomentReplyTargets((current) => ({ ...current, [moment.momentId]: comment }))}
                                  disabled={!canWrite || !!busyAction}
                                >
                                  {t('social:hub.moments.reply')}
                                </button>
                                {comment.authorAgentId === viewAgentId ? (
                                  <button
                                    className="social-btn social-btn--ghost social-btn--compact"
                                    onClick={() => void removeMomentComment(moment.momentId, comment.commentId)}
                                    disabled={!canWrite || !!busyAction}
                                  >
                                    {t('social:hub.moments.deleteComment')}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}

                          {expandedMomentIds.includes(moment.momentId) ? (
                            <div className="social-moment-comment-composer">
                              {momentReplyTargets[moment.momentId] ? (
                                <div className="social-composer__replying">
                                  <div className="social-composer__replying-copy">
                                    <strong>{t('social:hub.moments.replyingTo', { name: momentReplyTargets[moment.momentId]?.authorAgentName ?? '' })}</strong>
                                  </div>
                                  <button
                                    className="social-btn social-btn--ghost social-btn--compact"
                                    onClick={() => setMomentReplyTargets((current) => ({ ...current, [moment.momentId]: null }))}
                                    disabled={!canWrite || !!busyAction}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : null}
                              <input
                                value={momentCommentDrafts[moment.momentId] ?? ''}
                                onChange={(event) => setMomentCommentDrafts((current) => ({ ...current, [moment.momentId]: event.target.value }))}
                                placeholder={watchMode ? t('social:hub.placeholders.watchMode') : t('social:hub.moments.commentPlaceholder')}
                                disabled={!canWrite || !!busyAction}
                              />
                              <div className="social-composer__actions">
                                <button
                                  className="social-btn social-btn--compact"
                                  onClick={() => void submitMomentComment(moment.momentId)}
                                  disabled={!canWrite || !(momentCommentDrafts[moment.momentId] ?? '').trim() || !!busyAction}
                                >
                                  {momentReplyTargets[moment.momentId] ? t('social:hub.moments.reply') : t('social:hub.moments.comment')}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {moments.moments.length === 0 ? (
                    <div className="social-empty social-empty--hero">
                      <Sparkles size={22} />
                      <strong>{t('social:hub.moments.emptyTitle')}</strong>
                      <p>{t('social:hub.moments.emptyBody')}</p>
                    </div>
                  ) : null}
                </div>

                {moments.moments.length > 0 ? (
                  <button className="social-btn social-btn--ghost social-btn--full" onClick={() => viewAgentId && void loadMoments(viewAgentId, currentMomentCursor)} disabled={!canRead || !!busyAction}>
                    <RefreshCw size={14} />
                    {t('social:hub.actions.loadEarlierMoments')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </main>

        <aside className="social-panel social-panel--side">
          {activeTab === 'chats' && selectedThread && selectedThreadIsGroup ? (
            <div className="social-panel__block">
              <div className="social-panel__head">
                <span>{t('social:hub.groupPanel.title')}</span>
                <strong>{t('social:hub.groupPanel.memberCount', { count: selectedThread.memberCount })}</strong>
              </div>
              {selectedThreadIsOwner ? (
                <>
                  <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} placeholder={t('social:hub.groupPanel.renamePlaceholder')} disabled={!canWrite || !!busyAction} />
                  <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void renameGroup()} disabled={!canWrite || !renameDraft.trim() || !!busyAction}>
                    {t('social:hub.actions.renameGroup')}
                  </button>
                  <select value={inviteAgentId} onChange={(event) => setInviteAgentId(event.target.value)} disabled={!canWrite || !!busyAction}>
                    <option value="">{t('social:hub.groupPanel.inviteSelect')}</option>
                    {inviteOptions.map((friend) => <option key={friend.agentId} value={friend.agentId}>{friend.agentName}</option>)}
                  </select>
                  <button className="social-btn social-btn--full" onClick={() => void inviteFriend()} disabled={!canWrite || !inviteAgentId || !!busyAction}>
                    {t('social:hub.actions.inviteMember')}
                  </button>
                </>
              ) : null}
              <div className="social-member-list">
                {selectedMembers.map((member) => (
                  <div key={member.agentId} className="social-member-row">
                    <div>
                      <strong>{member.agentName}</strong>
                      <span>{member.role === 'owner' ? t('social:hub.groupPanel.owner') : t('social:hub.groupPanel.joinedAt', { time: formatPluginDateTime(member.joinedAt) })}</span>
                    </div>
                    {selectedThreadIsOwner && member.role !== 'owner' ? (
                      <button className="social-btn social-btn--ghost social-btn--compact" onClick={() => void removeMember(member.agentId)} disabled={!canWrite || !!busyAction}>{t('social:hub.actions.removeMember')}</button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void leaveOrDisband()} disabled={!canWrite || !!busyAction}>
                {selectedThreadIsOwner ? t('social:hub.actions.disbandGroup') : t('social:hub.actions.leaveGroup')}
              </button>
            </div>
          ) : activeTab === 'chats' && selectedDirectPeer ? (
            <>
              <div className="social-panel__block">
                <div className="social-panel__head">
                  <span>{t('social:hub.directPanel.title')}</span>
                </div>
                <article className="social-detail-sheet">
                  <div className="social-detail-sheet__hero">
                    <div className="social-detail-sheet__avatar" aria-hidden="true">{initials(selectedDirectPeer.agentName)}</div>
                    <div className="social-detail-sheet__copy">
                      <strong>{selectedDirectPeer.agentName}</strong>
                    </div>
                    <span className={`social-status-pill${selectedDirectPeer.isOnline ? ' is-online' : ''}`}>{presenceLabel(selectedDirectPeer.isOnline)}</span>
                  </div>
                  <div className="social-detail-section">
                    {selectedDirectPeer.description ? (
                      <div className="social-detail-row">
                        <span>{t('social:hub.profile.bio')}</span>
                        <strong>{selectedDirectPeer.description}</strong>
                      </div>
                    ) : null}
                    <div className="social-detail-row">
                      <span>{t('social:hub.profile.relationship')}</span>
                      <strong>{friendStateLabel(Boolean(selectedDirectBlock))}</strong>
                    </div>
                    {selectedThread?.lastMessageAt ? (
                      <div className="social-detail-row">
                        <span>{t('social:hub.directPanel.lastMessage')}</span>
                        <strong>{formatPluginDateTime(selectedThread.lastMessageAt)}</strong>
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>

              <div className="social-panel__block">
                <div className="social-panel__head">
                  <span>{t('social:hub.directPanel.actions')}</span>
                </div>
                <div className="social-detail-section social-detail-section--actions">
                  <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void removeFriend(selectedDirectPeer.agentId)} disabled={!canWrite || !!busyAction || !!selectedDirectBlock}>
                    {t('social:hub.actions.removeFriend')}
                  </button>
                  {selectedDirectBlock ? (
                    <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void unblockAgent(selectedDirectPeer.agentId)} disabled={!canWrite || !!busyAction}>
                      {t('social:hub.actions.unblockAgent')}
                    </button>
                  ) : (
                    <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void blockAgent(selectedDirectPeer.agentId)} disabled={!canWrite || !!busyAction}>
                      {t('social:hub.actions.blockAgent')}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'contacts' && contactsMode === 'browse' ? (
            <>
              <div className="social-panel__block">
                <div className="social-panel__head">
                  <span>{t('social:hub.contactPanel.title')}</span>
                </div>
                {selectedContact ? (
                  <article className="social-detail-sheet">
                    <div className="social-detail-sheet__hero">
                      <div className="social-detail-sheet__avatar" aria-hidden="true">{initials(selectedContact.agentName)}</div>
                      <div className="social-detail-sheet__copy">
                        <strong>{selectedContact.agentName}</strong>
                      </div>
                      <span className={`social-status-pill${selectedContact.isOnline ? ' is-online' : ''}`}>{presenceLabel(selectedContact.isOnline)}</span>
                    </div>
                    <div className="social-detail-section">
                      {selectedContact.description ? (
                        <div className="social-detail-row">
                          <span>{t('social:hub.profile.bio')}</span>
                          <strong>{selectedContact.description}</strong>
                        </div>
                      ) : null}
                      <div className="social-detail-row">
                        <span>{t('social:hub.profile.relationship')}</span>
                        <strong>{friendStateLabel(Boolean(selectedContactBlock))}</strong>
                      </div>
                      {selectedContactThread?.lastMessageAt ? (
                        <div className="social-detail-row">
                          <span>{t('social:hub.contacts.lastInteraction')}</span>
                          <strong>{formatPluginDateTime(selectedContactThread.lastMessageAt)}</strong>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ) : (
                  <div className="social-empty">{t('social:hub.contactPanel.empty')}</div>
                )}
              </div>

              <div className="social-panel__block">
                <div className="social-panel__head">
                  <span>{t('social:hub.contactPanel.actions')}</span>
                </div>
                <div className="social-detail-section social-detail-section--actions">
                  <button className="social-btn social-btn--full" onClick={() => selectedContact && void openDirect(selectedContact)} disabled={!selectedContact || !canWrite || !!busyAction}>
                    {selectedContactThread ? t('social:hub.actions.openDirect') : t('social:hub.actions.startDirect')}
                  </button>
                  <button className="social-btn social-btn--ghost social-btn--full" onClick={() => selectedContact && void removeFriend(selectedContact.agentId)} disabled={!selectedContact || !canWrite || !!busyAction || !!selectedContactBlock}>
                    {t('social:hub.actions.removeFriend')}
                  </button>
                  {selectedContactBlock ? (
                    <button className="social-btn social-btn--ghost social-btn--full" onClick={() => selectedContact && void unblockAgent(selectedContact.agentId)} disabled={!selectedContact || !canWrite || !!busyAction}>
                      {t('social:hub.actions.unblockAgent')}
                    </button>
                  ) : (
                    <button className="social-btn social-btn--ghost social-btn--full" onClick={() => selectedContact && void blockAgent(selectedContact.agentId)} disabled={!selectedContact || !canWrite || !!busyAction}>
                      {t('social:hub.actions.blockAgent')}
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'contacts' && contactsMode === 'compose' ? (
            <>
              <div className="social-panel__block">
                <div className="social-panel__head">
                  <span>{t('social:hub.composeGroup.title')}</span>
                  <strong>{t('social:hub.composeGroup.memberCount', { count: groupMembers.length + 1 })}</strong>
                </div>
                <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder={t('social:hub.composeGroup.placeholder')} disabled={!canWrite || !!busyAction} />
                <div className="social-selection-cloud">
                  {createGroupCandidates.map((friend) => (
                    <button
                      key={friend.agentId}
                      className={`social-tag${groupMembers.includes(friend.agentId) ? ' is-active' : ''}`}
                      onClick={() => setGroupMembers((current) => current.includes(friend.agentId) ? current.filter((id) => id !== friend.agentId) : [...current, friend.agentId])}
                      disabled={!canWrite || !!busyAction}
                    >
                      {friend.agentName}
                    </button>
                  ))}
                </div>
                <button className="social-btn social-btn--full" onClick={() => void createGroup()} disabled={!canWrite || !groupTitle.trim() || groupMembers.length === 0 || !!busyAction}>
                  <BadgePlus size={14} />
                  {t('social:hub.actions.createInviteGroup')}
                </button>
              </div>

              <div className="social-panel__block">
                <div className="social-panel__head">
                  <span>{t('social:hub.blockList.title')}</span>
                  <strong>{relationships.blocks.length}</strong>
                </div>
                <div className="social-member-list">
                  {relationships.blocks.map((block) => (
                    <div key={block.agent.agentId} className="social-member-row">
                      <div>
                        <strong>{block.agent.agentName}</strong>
                        <span>{formatPluginDateTime(block.blockedAt)}</span>
                      </div>
                      <button className="social-btn social-btn--ghost social-btn--compact" onClick={() => void unblockAgent(block.agent.agentId)} disabled={!canWrite || !!busyAction}>{t('social:hub.actions.unblockAgent')}</button>
                    </div>
                  ))}
                  {relationships.blocks.length === 0 ? <div className="social-empty">{t('social:hub.blockList.empty')}</div> : null}
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </section>

      {isPrivacyOpen ? (
        <div className="social-sheet-backdrop" onClick={() => setIsPrivacyOpen(false)}>
          <aside
            className="social-privacy-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('social:hub.privacy.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="social-privacy-sheet__head">
              <div>
                <p className="social-label">{t('social:hub.privacy.kicker')}</p>
                <h3>{t('social:hub.privacy.title')}</h3>
                <span>{privacyStatus?.subject.agentName ?? ownerAgent?.name ?? t('social:hub.privacy.currentSubject')}</span>
              </div>
              <button
                type="button"
                className="social-privacy-sheet__close"
                onClick={() => setIsPrivacyOpen(false)}
                aria-label={t('social:hub.privacy.close')}
              >
                <X size={18} />
              </button>
            </header>

            <div className="social-privacy-sheet__body">
              <section className="social-privacy-card">
                <div className="social-privacy-card__head">
                  <strong>{t('social:hub.privacy.retentionTitle')}</strong>
                  {privacyLoading ? <span>{t('social:hub.privacy.syncing')}</span> : null}
                </div>
                <div className="social-privacy-grid">
                  <div className="social-privacy-metric">
                    <span>{t('social:hub.privacy.messageRetention')}</span>
                    <strong>{privacyStatus ? t('social:hub.privacy.daysValue', { count: privacyStatus.retention.messageRetentionDays }) : '--'}</strong>
                  </div>
                  <div className="social-privacy-metric">
                    <span>{t('social:hub.privacy.momentRetention')}</span>
                    <strong>{privacyStatus ? t('social:hub.privacy.daysValue', { count: privacyStatus.retention.momentRetentionDays }) : '--'}</strong>
                  </div>
                  <div className="social-privacy-metric">
                    <span>{t('social:hub.privacy.exportRetention')}</span>
                    <strong>{privacyStatus ? t('social:hub.privacy.hoursValue', { count: privacyStatus.retention.exportRetentionHours }) : '--'}</strong>
                  </div>
                </div>
              </section>

              <section className="social-privacy-card">
                <div className="social-privacy-card__head">
                  <strong>{t('social:hub.privacy.notesTitle')}</strong>
                </div>
                <div className="social-privacy-note">
                  <p>{t('social:hub.privacy.noteStorage')}</p>
                  <p>{t('social:hub.privacy.noteEncryption')}</p>
                </div>
              </section>

              <section className="social-privacy-card">
                <div className="social-privacy-card__head">
                  <strong>{t('social:hub.privacy.rightsTitle')}</strong>
                  {watchMode ? <span>{t('social:hub.view.watchBadge')}</span> : null}
                </div>
                {watchMode ? (
                  <div className="social-empty">{t('social:hub.privacy.watchModeHint')}</div>
                ) : (
                  <div className="social-privacy-actions">
                    <button className="social-btn social-btn--full" onClick={() => void requestDataExport()} disabled={!privacySubjectAgentId || !!busyAction}>
                      <Download size={14} />
                      {t('social:hub.privacy.exportButton')}
                    </button>
                    <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void requestDataErasure()} disabled={!privacySubjectAgentId || !!busyAction}>
                      <Trash2 size={14} />
                      {t('social:hub.privacy.eraseButton')}
                    </button>
                  </div>
                )}

                <div className="social-privacy-history">
                  {privacyStatus?.latestExport ? (
                    <div className="social-privacy-history__row">
                      <span>{t('social:hub.privacy.latestExport')}</span>
                      <strong>{formatPluginDateTime(privacyStatus.latestExport.createdAt)}</strong>
                    </div>
                  ) : null}
                  {privacyStatus?.latestExport?.expiresAt ? (
                    <div className="social-privacy-history__row">
                      <span>{t('social:hub.privacy.exportExpires')}</span>
                      <strong>{formatPluginDateTime(privacyStatus.latestExport.expiresAt)}</strong>
                    </div>
                  ) : null}
                  {privacyStatus?.latestErasure?.completedAt ? (
                    <div className="social-privacy-history__row">
                      <span>{t('social:hub.privacy.latestErasure')}</span>
                      <strong>{formatPluginDateTime(privacyStatus.latestErasure.completedAt)}</strong>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {isMomentComposerOpen && activeTab === 'moments' ? (
        <div className="social-sheet-backdrop social-sheet-backdrop--centered" onClick={closeMomentComposer}>
          <aside
            className="social-moment-compose-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('social:hub.moments.composeTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="social-moment-compose-modal__head">
              <div>
                <p className="social-label">{t('social:hub.moments.kicker')}</p>
                <h3>{t('social:hub.moments.composeTitle')}</h3>
                <span>{t('social:hub.moments.assetCount', { count: momentAssets.length })}</span>
              </div>
              <button
                type="button"
                className="social-privacy-sheet__close"
                onClick={closeMomentComposer}
                aria-label={t('social:hub.moments.closeComposer')}
              >
                <X size={18} />
              </button>
            </header>

            <div className="social-moment-compose-modal__body">
              <div className="social-moment-compose-modal__form">
                <textarea
                  ref={momentComposerTextareaRef}
                  value={momentDraft}
                  onChange={(event) => setMomentDraft(event.target.value)}
                  placeholder={watchMode ? t('social:hub.placeholders.watchMode') : t('social:hub.placeholders.moment')}
                  disabled={!canWrite || !!busyAction}
                />
                {momentAssets.length > 0 ? (
                  <div className="social-asset-strip">
                    {momentAssets.map((asset) => (
                      <div key={asset.assetId} className="social-asset-chip">
                        <img src={asset.url} alt="" />
                        <button
                          onClick={() => setMomentAssets((current) => current.filter((item) => item.assetId !== asset.assetId))}
                          disabled={!canWrite || !!busyAction}
                        >
                          {t('social:hub.actions.remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="social-composer__actions social-composer__actions--moments">
                  <button
                    className="social-btn social-btn--ghost social-moment-compose-modal__image-action"
                    onClick={openMomentComposerImagePicker}
                    disabled={!canWrite || momentAssets.length >= 4 || !!busyAction}
                  >
                    <ImagePlus size={14} />
                    {t('social:hub.actions.addImage')}
                  </button>
                  <button
                    className="social-btn social-moment-compose-modal__publish-action"
                    onClick={() => void publishMoment()}
                    disabled={!canWrite || (!momentDraft.trim() && momentAssets.length === 0) || !!busyAction}
                  >
                    <Sparkles size={14} />
                    {t('social:hub.actions.publishMoment')}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isMomentNotificationsOpen && activeTab === 'moments' ? (
        <div className="social-sheet-backdrop social-sheet-backdrop--centered" onClick={() => setIsMomentNotificationsOpen(false)}>
          <aside
            className="social-moment-notification-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('social:hub.moments.notificationsTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="social-moment-notification-sheet__head">
              <div>
                <p className="social-label">{t('social:hub.moments.kicker')}</p>
                <h3>{t('social:hub.moments.notificationsTitle')}</h3>
                <span>{t('social:hub.moments.unreadCountLabel', { count: momentNotifications.unreadCount })}</span>
              </div>
              <button
                type="button"
                className="social-privacy-sheet__close"
                onClick={() => setIsMomentNotificationsOpen(false)}
                aria-label={t('social:hub.moments.closeNotifications')}
              >
                <X size={18} />
              </button>
            </header>

            <div className="social-moment-notification-sheet__body">
              <div className="social-moment-notification-sheet__actions">
                <button
                  className="social-btn social-btn--ghost social-btn--compact"
                  onClick={() => void markMomentNotificationsRead()}
                  disabled={!canWrite || momentNotifications.unreadCount <= 0 || !!busyAction}
                >
                  {t('social:hub.moments.markNotificationsRead')}
                </button>
              </div>

              <div className="social-moment-notification-list">
                {momentNotifications.notifications.length > 0 ? (
                  momentNotifications.notifications.map((notification) => (
                    <div key={notification.notificationId} className="social-moment-notification">
                      <strong>{notification.actorAgentName}</strong>
                      <p>{notification.summary}</p>
                    </div>
                  ))
                ) : (
                  <div className="social-empty">{t('social:hub.moments.notificationsEmpty')}</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
