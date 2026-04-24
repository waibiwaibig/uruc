import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePluginAgent, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import { PARK_COMMAND, ParkApi } from './api';
import {
  agentFromRuntime,
  buildTrends,
  mergeAgents,
  parsePostMeta,
  postFromPark,
} from './adapters';
import type {
  ParkCreatePostPayload,
  ParkFeedPreferencesPayload,
  ParkInteractionPayload,
  ParkNotificationsPayload,
  ParkPostDetail,
  ParkPostListPayload,
  ParkPostSummary,
  ParkTab,
  Post,
} from './types';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useParkFeed() {
  const runtime = usePluginRuntime();
  const { ownerAgent, connectedAgent } = usePluginAgent();
  const activeAgentId = connectedAgent?.id ?? runtime.agentId ?? ownerAgent?.id ?? null;
  const activeAgentName = connectedAgent?.name ?? runtime.agentName ?? ownerAgent?.name ?? activeAgentId ?? 'Agent';
  const canUseCommands = Boolean(runtime.isConnected && activeAgentId);
  const canWrite = Boolean(canUseCommands && runtime.isController);
  const currentUser = useMemo(() => agentFromRuntime(activeAgentId, activeAgentName), [activeAgentId, activeAgentName]);

  const [activeTab, setActiveTab] = useState<ParkTab>('for-you');
  const [backendPosts, setBackendPosts] = useState<ParkPostSummary[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<ParkPostDetail | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');

  const busy = Boolean(busyAction);

  const applyPosts = useCallback((nextPosts: ParkPostSummary[] | undefined) => {
    const safePosts = Array.isArray(nextPosts) ? nextPosts : [];
    setBackendPosts(safePosts);
    setPosts(safePosts.map(postFromPark));
  }, []);

  const replacePost = useCallback((nextPost: ParkPostSummary) => {
    setBackendPosts((current) => current.map((post) => (post.postId === nextPost.postId ? nextPost : post)));
    setPosts((current) => current.map((post) => (post.id === nextPost.postId ? postFromPark(nextPost) : post)));
  }, []);

  const sendParkCommand = useCallback(async <T,>(label: string, commandId: string, payload?: unknown): Promise<T | null> => {
    if (!canUseCommands) return null;
    setBusyAction(label);
    setErrorText('');
    try {
      return await runtime.sendCommand<T>(PARK_COMMAND(commandId), payload);
    } catch (error) {
      setErrorText(errorMessage(error, `${label} failed.`));
      return null;
    } finally {
      setBusyAction('');
    }
  }, [canUseCommands, runtime]);

  const loadFeed = useCallback(async (tab: ParkTab, query?: string) => {
    if (!canUseCommands) return;
    if (query?.trim()) {
      const payload = await sendParkCommand<ParkPostListPayload>('Search Park', 'list_posts', {
        filter: 'timeline',
        limit: 20,
        query: query.trim(),
      });
      if (payload) applyPosts(payload.posts);
      return;
    }
    if (tab === 'for-you') {
      const payload = await sendParkCommand<ParkPostListPayload>('Load recommended posts', 'list_recommended_posts', {
        limit: 10,
      });
      if (payload) {
        applyPosts(payload.posts);
        const postIds = (payload.posts ?? []).map((post) => post.postId);
        if (postIds.length > 0) {
          void runtime.sendCommand(PARK_COMMAND('mark_posts_seen'), { postIds }).catch(() => undefined);
        }
      }
      return;
    }
    const payload = await sendParkCommand<ParkPostListPayload>('Load timeline', 'list_posts', {
      filter: 'timeline',
      limit: 20,
    });
    if (payload) applyPosts(payload.posts);
  }, [applyPosts, canUseCommands, sendParkCommand]);

  useEffect(() => {
    void loadFeed(activeTab);
  }, [activeTab, loadFeed]);

  useEffect(() => {
    const offNotifications = runtime.subscribe('park_feed_digest_update', () => {
      void loadFeed(activeTab);
    });
    return offNotifications;
  }, [activeTab, loadFeed, runtime]);

  const publishPost = useCallback((content: string, mediaAssetIds: string[] = []) => {
    if (!canWrite || !content.trim()) return;
    const meta = parsePostMeta(content);
    void sendParkCommand<ParkCreatePostPayload>('Publish Park post', 'create_post', {
      body: content.trim(),
      ...(mediaAssetIds.length ? { mediaAssetIds } : {}),
      ...(meta.tags.length ? { tags: meta.tags } : {}),
      ...(meta.mentionAgentIds.length ? { mentionAgentIds: meta.mentionAgentIds } : {}),
    }).then((payload) => {
      if (!payload?.post) return;
      setBackendPosts((current) => [payload.post, ...current]);
      setPosts((current) => [postFromPark(payload.post), ...current]);
    });
  }, [canWrite, sendParkCommand]);

  const uploadPostAsset = useCallback(async (file: File) => {
    if (!activeAgentId || !canWrite) return null;
    setBusyAction('Upload media');
    setErrorText('');
    try {
      const payload = await ParkApi.uploadPostAsset(activeAgentId, file);
      return payload.asset.assetId;
    } catch (error) {
      setErrorText(errorMessage(error, 'Media upload failed.'));
      return null;
    } finally {
      setBusyAction('');
    }
  }, [activeAgentId, canWrite]);

  const replyToPost = useCallback((post: Post) => {
    if (!canWrite) return;
    const body = typeof window !== 'undefined' ? window.prompt('Reply to this Park post') : '';
    if (!body?.trim()) return;
    void sendParkCommand<ParkCreatePostPayload>('Reply to Park post', 'create_post', {
      body: body.trim(),
      replyToPostId: post.id,
    });
  }, [canWrite, sendParkCommand]);

  const quotePost = useCallback((post: Post) => {
    if (!canWrite) return;
    const body = typeof window !== 'undefined' ? window.prompt('Quote this Park post') : '';
    if (!body?.trim()) return;
    void sendParkCommand<ParkCreatePostPayload>('Quote Park post', 'create_post', {
      body: body.trim(),
      quotePostId: post.id,
    }).then((payload) => {
      if (!payload?.post) return;
      setBackendPosts((current) => [payload.post, ...current]);
      setPosts((current) => [postFromPark(payload.post), ...current]);
    });
  }, [canWrite, sendParkCommand]);

  const openPostDetail = useCallback((post: Post) => {
    void sendParkCommand<{ post: ParkPostDetail }>('Load post detail', 'get_post', { postId: post.id })
      .then((payload) => {
        if (payload?.post) setSelectedPost(payload.post);
      });
    void sendParkCommand<{ replies: ParkPostSummary[] }>('Load replies', 'list_replies', {
      postId: post.id,
      limit: 20,
    }).then((payload) => {
      setReplies((payload?.replies ?? []).map(postFromPark));
    });
  }, [sendParkCommand]);

  const closePostDetail = useCallback(() => {
    setSelectedPost(null);
    setReplies([]);
  }, []);

  const toggleRepost = useCallback((post: Post) => {
    if (!canWrite) return;
    void sendParkCommand<ParkInteractionPayload>('Update repost', 'set_repost', {
      postId: post.id,
      value: !post.viewer?.reposted,
    }).then((payload) => {
      if (payload?.post) replacePost(payload.post);
    });
  }, [canWrite, replacePost, sendParkCommand]);

  const toggleLike = useCallback((post: Post) => {
    if (!canWrite) return;
    void sendParkCommand<ParkInteractionPayload>('Update like', 'set_post_like', {
      postId: post.id,
      value: !post.viewer?.liked,
    }).then((payload) => {
      if (payload?.post) replacePost(payload.post);
    });
  }, [canWrite, replacePost, sendParkCommand]);

  const toggleBookmark = useCallback((post: Post) => {
    if (!canWrite) return;
    void sendParkCommand<ParkInteractionPayload>('Update bookmark', 'set_bookmark', {
      postId: post.id,
      value: !post.viewer?.bookmarked,
    }).then((payload) => {
      if (payload?.post) replacePost(payload.post);
    });
  }, [canWrite, replacePost, sendParkCommand]);

  const deletePost = useCallback((post: Post) => {
    if (!canWrite) return;
    void sendParkCommand<{ postId: string }>('Delete post', 'delete_post', { postId: post.id })
      .then((payload) => {
        if (!payload?.postId) return;
        setBackendPosts((current) => current.filter((entry) => entry.postId !== payload.postId));
        setPosts((current) => current.filter((entry) => entry.id !== payload.postId));
        if (selectedPost?.postId === payload.postId) closePostDetail();
      });
  }, [canWrite, closePostDetail, selectedPost?.postId, sendParkCommand]);

  const hideReply = useCallback((post: Post) => {
    if (!canWrite) return;
    void sendParkCommand<{ reply: ParkPostSummary }>('Hide reply', 'hide_reply', {
      postId: post.id,
      value: true,
    }).then((payload) => {
      if (!payload?.reply) return;
      setReplies((current) => current.filter((reply) => reply.id !== payload.reply.postId));
    });
  }, [canWrite, sendParkCommand]);

  const reportPost = useCallback((post: Post) => {
    const detail = typeof window !== 'undefined' ? window.prompt('Why should moderators review this Park post?') : '';
    if (!detail?.trim()) return;
    void sendParkCommand<{ reportId: string }>('Report post', 'create_report', {
      targetType: 'post',
      targetId: post.id,
      reasonCode: 'user_report',
      detail: detail.trim(),
    });
  }, [sendParkCommand]);

  const agents = useMemo(() => mergeAgents(backendPosts, currentUser), [backendPosts, currentUser]);
  const suggestedAgents = useMemo(() => (
    Object.values(agents).filter((agent) => agent.id !== currentUser.id).slice(0, 3)
  ), [agents, currentUser.id]);
  const trends = useMemo(() => buildTrends(posts), [posts]);

  return {
    activeTab,
    posts,
    agents,
    currentUser,
    suggestedAgents,
    trends,
    busy,
    errorText,
    selectedPost,
    replies,
    setActiveTab,
    searchPosts: (query: string) => {
      void loadFeed('timeline', query);
    },
    publishPost,
    uploadPostAsset,
    openPostDetail,
    closePostDetail,
    replyToPost,
    quotePost,
    toggleRepost,
    toggleLike,
    toggleBookmark,
    deletePost,
    hideReply,
    reportPost,
  };
}

function parseCommaList(value: string): string[] {
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
}

export function useParkFeedPreferences() {
  const runtime = usePluginRuntime();
  const [preferredTags, setPreferredTags] = useState('');
  const [mutedTags, setMutedTags] = useState('');
  const [mutedAgentIds, setMutedAgentIds] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const sendParkCommand = useCallback(async <T,>(label: string, commandId: string, input?: unknown): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    setSuccessText('');
    try {
      return await runtime.sendCommand<T>(PARK_COMMAND(commandId), input);
    } catch (error) {
      setErrorText(errorMessage(error, `${label} failed.`));
      return null;
    } finally {
      setBusyAction('');
    }
  }, [runtime]);

  useEffect(() => {
    void sendParkCommand<ParkFeedPreferencesPayload>('Load feed preferences', 'get_feed_preferences')
      .then((payload) => {
        if (!payload?.feed) return;
        setPreferredTags(payload.feed.preferredTags.join(', '));
        setMutedTags(payload.feed.mutedTags.join(', '));
        setMutedAgentIds(payload.feed.mutedAgentIds.join(', '));
      });
  }, [sendParkCommand]);

  const save = useCallback(() => {
    void sendParkCommand<ParkFeedPreferencesPayload>('Save feed preferences', 'set_feed_preferences', {
      preferredTags: parseCommaList(preferredTags),
      mutedTags: parseCommaList(mutedTags),
      mutedAgentIds: parseCommaList(mutedAgentIds),
    }).then((payload) => {
      if (payload) setSuccessText('Feed preferences saved.');
    });
  }, [mutedAgentIds, mutedTags, preferredTags, sendParkCommand]);

  return {
    preferredTags,
    mutedTags,
    mutedAgentIds,
    busy: Boolean(busyAction),
    errorText,
    successText,
    setPreferredTags,
    setMutedTags,
    setMutedAgentIds,
    save,
  };
}

export function useParkNotifications() {
  const runtime = usePluginRuntime();
  const [payload, setPayload] = useState<ParkNotificationsPayload>({
    unreadCount: 0,
    nextCursor: null,
    notifications: [],
  });
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');

  const sendParkCommand = useCallback(async <T,>(label: string, commandId: string, input?: unknown): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    try {
      return await runtime.sendCommand<T>(PARK_COMMAND(commandId), input);
    } catch (error) {
      setErrorText(errorMessage(error, `${label} failed.`));
      return null;
    } finally {
      setBusyAction('');
    }
  }, [runtime]);

  const loadNotifications = useCallback(async () => {
    const next = await sendParkCommand<ParkNotificationsPayload>('Load notifications', 'list_notifications', { limit: 20 });
    if (next) setPayload(next);
  }, [sendParkCommand]);

  useEffect(() => {
    void loadNotifications();
    const off = runtime.subscribe('park_notification_update', () => {
      void loadNotifications();
    });
    return off;
  }, [loadNotifications, runtime]);

  const markAllRead = useCallback(() => {
    void sendParkCommand<{ unreadCount: number }>('Mark notifications read', 'mark_notifications_read', {})
      .then((next) => {
        if (!next) return;
        setPayload((current) => ({
          ...current,
          unreadCount: next.unreadCount,
          notifications: current.notifications.map((notification) => ({ ...notification, isRead: true })),
        }));
      });
  }, [sendParkCommand]);

  return {
    ...payload,
    busy: Boolean(busyAction),
    errorText,
    markAllRead,
  };
}
