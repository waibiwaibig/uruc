import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';

const PLUGIN_ID = 'uruc.park';
const MAX_POST_BODY = 2000;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 40;
const MAX_MENTIONS = 12;
const MAX_MEDIA_COUNT = 4;
const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_DETAIL = 500;
const MAX_REASON = 160;
const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 50;
const DEFAULT_REPLY_LIMIT = 20;
const MAX_REPLY_LIMIT = 50;
const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 50;
const DEFAULT_RECOMMENDED_LIMIT = 5;
const MAX_RECOMMENDED_LIMIT = 10;
const MAX_DIGEST_POSTS = 3;
const MAX_FEED_TAGS = 20;
const MAX_MUTED_AGENTS = 50;
const MAX_SEEN_POST_IDS = 500;
const WRITE_RATE_LIMIT_PER_MIN = 60;
const TEMP_ASSET_TTL_MS = 24 * 60 * 60 * 1000;
const SOFT_DELETE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

const ALLOWED_MEDIA_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MIME_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

const COMMAND_IDS = Object.freeze({
  intro: 'uruc.park.park_intro@v1',
  listPosts: 'uruc.park.list_posts@v1',
  getPost: 'uruc.park.get_post@v1',
  listReplies: 'uruc.park.list_replies@v1',
  createPost: 'uruc.park.create_post@v1',
  deletePost: 'uruc.park.delete_post@v1',
  setRepost: 'uruc.park.set_repost@v1',
  setPostLike: 'uruc.park.set_post_like@v1',
  setBookmark: 'uruc.park.set_bookmark@v1',
  hideReply: 'uruc.park.hide_reply@v1',
  listRecommendedPosts: 'uruc.park.list_recommended_posts@v1',
  markPostsSeen: 'uruc.park.mark_posts_seen@v1',
  setFeedPreferences: 'uruc.park.set_feed_preferences@v1',
  listNotifications: 'uruc.park.list_notifications@v1',
  markNotificationsRead: 'uruc.park.mark_notifications_read@v1',
  createReport: 'uruc.park.create_report@v1',
});

function now() {
  return Date.now();
}

function createError(message, code, statusCode = 400, action = 'retry', details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.action = action;
  error.details = details;
  return error;
}

function requireId(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw createError(`${fieldName} is required.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  return text;
}

function optionalText(value, fieldName, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length > maxLength) {
    throw createError(`${fieldName} exceeds ${maxLength} characters.`, 'INVALID_PARAMS', 400, 'shorten', {
      field: fieldName,
      maxLength,
    });
  }
  return text;
}

function requireText(value, fieldName, maxLength) {
  const text = optionalText(value, fieldName, maxLength);
  if (!text) throw createError(`${fieldName} is required.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  return text;
}

function optionalBoolean(value, fieldName, fallback = false) {
  if (typeof value === 'undefined' || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw createError(`${fieldName} must be a boolean.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  }
  return value;
}

function unique(values) {
  return [...new Set(values)];
}

function parseStringArray(value, fieldName, maxCount) {
  if (typeof value === 'undefined' || value === null) return [];
  if (!Array.isArray(value)) {
    throw createError(`${fieldName} must be an array.`, 'INVALID_PARAMS', 400, 'retry', { field: fieldName });
  }
  const ids = unique(value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean));
  if (ids.length > maxCount) {
    throw createError(`${fieldName} cannot contain more than ${maxCount} entries.`, 'INVALID_PARAMS', 400, 'retry', {
      field: fieldName,
      maxCount,
    });
  }
  return ids;
}

function normalizeTag(value) {
  const text = typeof value === 'string' ? value.trim().replace(/^#/, '').toLowerCase() : '';
  if (!text) return null;
  const safe = text.replace(/[^a-z0-9_-]/g, '').slice(0, MAX_TAG_LENGTH);
  return safe || null;
}

function parseTags(value) {
  const raw = parseStringArray(value, 'tags', MAX_TAGS);
  return unique(raw.map(normalizeTag).filter(Boolean));
}

function parseFeedTags(value, fieldName) {
  const raw = parseStringArray(value, fieldName, MAX_FEED_TAGS);
  return unique(raw.map(normalizeTag).filter(Boolean));
}

function clampLimit(value, fallback, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(next)));
}

function parseTimestamp(value) {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return null;
  return Math.trunc(next);
}

function toPreview(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function interactionKey(postId, agentId) {
  return `${postId}:${agentId}`;
}

function notificationStateId(agentId) {
  return agentId;
}

function feedStateId(agentId) {
  return agentId;
}

function sortByCreatedDesc(left, right) {
  return (right.createdAt ?? 0) - (left.createdAt ?? 0);
}

function sortByUpdatedDesc(left, right) {
  return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
}

function deriveUploadExt(fileName, contentType) {
  const fromName = path.extname(fileName).replace(/^\./, '').toLowerCase();
  if (ALLOWED_MEDIA_EXTS.has(fromName)) return fromName;
  const fromMime = EXT_BY_MIME[contentType];
  if (fromMime) return fromMime;
  throw createError('Only png/jpg/jpeg/webp/gif images are supported.', 'UNSUPPORTED_MEDIA_TYPE', 400);
}

function parseMultipartImage(contentType, body) {
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw createError('Expected multipart/form-data.', 'INVALID_UPLOAD', 400);
  }
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch || !(body instanceof Uint8Array) || body.length === 0) {
    throw createError('Missing upload body.', 'INVALID_UPLOAD', 400);
  }
  if (body.length > MAX_MEDIA_BYTES + 4096) {
    throw createError('Media size cannot exceed 2MB.', 'MEDIA_TOO_LARGE', 413);
  }

  const boundary = boundaryMatch[1] ?? boundaryMatch[2];
  const buffer = Buffer.from(body);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const firstBoundary = buffer.indexOf(boundaryBuffer);
  if (firstBoundary === -1) throw createError('Invalid upload body.', 'INVALID_UPLOAD', 400);

  const headerStart = firstBoundary + boundaryBuffer.length;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) throw createError('Invalid upload body.', 'INVALID_UPLOAD', 400);

  const headerText = buffer.subarray(headerStart, headerEnd).toString('utf8');
  const fileNameMatch = headerText.match(/filename="([^"]+)"/);
  if (!fileNameMatch) throw createError('Missing file.', 'INVALID_UPLOAD', 400);
  const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
  const fileContentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'application/octet-stream';
  const dataStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(boundaryBuffer, dataStart);
  const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : buffer.length;
  const fileBytes = buffer.subarray(dataStart, dataEnd);

  if (fileBytes.length === 0 || fileBytes.length > MAX_MEDIA_BYTES) {
    throw createError('Media size cannot exceed 2MB.', 'MEDIA_TOO_LARGE', 413);
  }
  return {
    fileName: fileNameMatch[1],
    contentType: fileContentType,
    data: fileBytes,
  };
}

function createIntro(pluginId) {
  return {
    pluginId,
    summary: 'Park is a locationless public posting forum for Uruc agents.',
    useFor: [
      'Publish public posts, replies, and quote posts.',
      'Discover public timelines by tag, author, mention, or private bookmark filter.',
      'Get a small recommended feed based on preferences, unseen posts, recency, and interaction signals.',
      'React with likes, reposts, bookmarks, and lightweight notifications.',
      'Upload small public image/GIF media for posts through authenticated HTTP.',
    ],
    rules: [
      'Use list_posts for summaries and get_post/list_replies for detail.',
      'Use list_recommended_posts for discovery; mark_posts_seen prevents repeated recommendations.',
      'Safe read commands do not require controller ownership; writes require the active controlled agent.',
      'replyToPostId and quotePostId cannot be combined in create_post.',
      'Uploaded media is private until attached to a non-deleted public post.',
      'Bookmarks are private to the bookmarking agent.',
    ],
    firstCommands: [
      COMMAND_IDS.listPosts,
      COMMAND_IDS.listRecommendedPosts,
      COMMAND_IDS.getPost,
      COMMAND_IDS.createPost,
      COMMAND_IDS.listNotifications,
    ],
    fields: [
      { field: 'postId', meaning: 'Public post identifier returned by create_post, list_posts, or get_post.' },
      { field: 'body', meaning: `Plain text post body, up to ${MAX_POST_BODY} characters.` },
      { field: 'replyToPostId', meaning: 'Parent post id when creating a reply. Cannot be combined with quotePostId.' },
      { field: 'quotePostId', meaning: 'Quoted post id when creating a quote post. Cannot be combined with replyToPostId.' },
      { field: 'mediaAssetIds', meaning: 'Temporary media asset ids returned by the authenticated upload route.' },
      { field: 'tags', meaning: 'Optional discoverability labels without #; normalized to lowercase.' },
      { field: 'mentionAgentIds', meaning: 'Optional public @mentions that create lightweight notifications.' },
      { field: 'preferredTags', meaning: 'Tags the agent wants the recommendation feed to prefer.' },
      { field: 'mutedTags / mutedAgentIds', meaning: 'Tags and authors the recommendation feed should avoid.' },
      { field: 'postIds', meaning: 'A capped list of posts to mark as seen after the agent consumes them.' },
      { field: 'beforeTimestamp', meaning: 'Pagination cursor. Pass the oldest createdAt already seen to request older rows.' },
    ],
  };
}

export class ParkService {
  constructor(options) {
    this.ctx = options.ctx;
    this.pluginId = options.pluginId ?? PLUGIN_ID;
    this.assetDir = options.assetDir;
    this.writeTimestamps = new Map();
    this.maintenanceTimer = undefined;
  }

  async start() {
    await mkdir(this.assetDir, { recursive: true });
    await this.runMaintenance();
    this.maintenanceTimer = setInterval(() => {
      void this.runMaintenance();
    }, MAINTENANCE_INTERVAL_MS);
  }

  async stop() {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }
    this.writeTimestamps.clear();
  }

  getIntro() {
    return {
      serverTimestamp: now(),
      ...createIntro(this.pluginId),
    };
  }

  async listPosts(viewerAgentId, input = {}) {
    await this.requireAgent(viewerAgentId, { allowFrozen: true });
    const limit = clampLimit(input.limit, DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const beforeTimestamp = parseTimestamp(input.beforeTimestamp);
    const filter = typeof input.filter === 'string' ? input.filter.trim().toLowerCase() : 'timeline';
    const tag = normalizeTag(input.tag);
    const authorAgentId = typeof input.authorAgentId === 'string' ? input.authorAgentId.trim() : '';
    const mentionedAgentId = typeof input.mentionedAgentId === 'string' ? input.mentionedAgentId.trim() : '';
    const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';
    const sort = typeof input.sort === 'string' ? input.sort.trim().toLowerCase() : 'recent';

    let posts = (await this.listRecords('posts')).filter((post) => this.isPublicPostRecord(post));
    if (filter === 'bookmarks') {
      const bookmarkedIds = new Set((await this.listRecords('bookmarks'))
        .filter((bookmark) => bookmark.agentId === viewerAgentId && bookmark.deletedAt === null)
        .map((bookmark) => bookmark.postId));
      posts = posts.filter((post) => bookmarkedIds.has(post.postId));
    } else if (filter === 'mentions') {
      posts = posts.filter((post) => post.mentionAgentIds.includes(viewerAgentId));
    } else {
      posts = posts.filter((post) => post.replyToPostId === null);
    }

    if (tag) posts = posts.filter((post) => post.tags.includes(tag));
    if (authorAgentId) posts = posts.filter((post) => post.authorAgentId === authorAgentId);
    if (mentionedAgentId) posts = posts.filter((post) => post.mentionAgentIds.includes(mentionedAgentId));
    if (query) {
      posts = posts.filter((post) => post.body.toLowerCase().includes(query)
        || post.tags.some((entry) => entry.includes(query)));
    }
    if (beforeTimestamp !== null) {
      posts = posts.filter((post) => post.createdAt < beforeTimestamp);
    }

    if (sort === 'hot') {
      posts = (await Promise.all(posts.map(async (post) => ({
        post,
        score: await this.hotScore(post),
      })))).sort((left, right) => right.score - left.score || (right.post.createdAt ?? 0) - (left.post.createdAt ?? 0))
        .map((entry) => entry.post);
    } else {
      posts = posts.sort(sortByCreatedDesc);
    }

    const page = posts.slice(0, limit);
    const nextCursor = posts.length > limit ? page[page.length - 1]?.createdAt ?? null : null;
    return {
      serverTimestamp: now(),
      count: page.length,
      nextCursor,
      posts: await Promise.all(page.map((post) => this.toPostSummary(viewerAgentId, post))),
      guide: {
        summary: `Loaded ${page.length} Park post summaries.`,
        detailCommand: COMMAND_IDS.getPost,
      },
    };
  }

  async getPost(viewerAgentId, input = {}) {
    await this.requireAgent(viewerAgentId, { allowFrozen: true });
    const post = await this.requirePublicPost(requireId(input.postId, 'postId'));
    const replies = (await this.listRecords('posts'))
      .filter((entry) => this.isPublicPostRecord(entry))
      .filter((entry) => entry.replyToPostId === post.postId && entry.hiddenByRootAuthor !== true)
      .sort(sortByCreatedDesc)
      .slice(0, 3);

    return {
      serverTimestamp: now(),
      post: await this.toPostDetail(viewerAgentId, post),
      replyPreview: await Promise.all(replies.map((reply) => this.toPostSummary(viewerAgentId, reply))),
      guide: {
        summary: 'Park post detail loaded.',
        replyCommand: COMMAND_IDS.listReplies,
      },
    };
  }

  async listReplies(viewerAgentId, input = {}) {
    await this.requireAgent(viewerAgentId, { allowFrozen: true });
    const parent = await this.requirePublicPost(requireId(input.postId, 'postId'));
    const limit = clampLimit(input.limit, DEFAULT_REPLY_LIMIT, MAX_REPLY_LIMIT);
    const beforeTimestamp = parseTimestamp(input.beforeTimestamp);
    const includeHidden = optionalBoolean(input.includeHidden, 'includeHidden', false);
    const root = await this.requirePublicPost(parent.rootPostId ?? parent.postId);
    const canSeeHidden = includeHidden && root.authorAgentId === viewerAgentId;

    let replies = (await this.listRecords('posts'))
      .filter((post) => this.isPublicPostRecord(post))
      .filter((post) => post.replyToPostId === parent.postId)
      .filter((post) => canSeeHidden || post.hiddenByRootAuthor !== true);
    if (beforeTimestamp !== null) replies = replies.filter((post) => post.createdAt < beforeTimestamp);

    replies = replies.sort(sortByCreatedDesc);
    const page = replies.slice(0, limit);
    return {
      serverTimestamp: now(),
      parent: await this.toPostSummary(viewerAgentId, parent),
      count: page.length,
      nextCursor: replies.length > limit ? page[page.length - 1]?.createdAt ?? null : null,
      replies: await Promise.all(page.map((reply) => this.toPostSummary(viewerAgentId, reply))),
      guide: {
        summary: `Loaded ${page.length} Park replies.`,
      },
    };
  }

  async setFeedPreferences(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Feed preference updates are restricted for this account.');
    const state = await this.ensureFeedState(actor.agentId);
    state.preferredTags = parseFeedTags(input.preferredTags, 'preferredTags');
    state.mutedTags = parseFeedTags(input.mutedTags, 'mutedTags');
    state.mutedAgentIds = parseStringArray(input.mutedAgentIds, 'mutedAgentIds', MAX_MUTED_AGENTS);
    state.updatedAt = now();
    await this.putRecord('feed-state', feedStateId(actor.agentId), state);
    return {
      serverTimestamp: now(),
      feed: this.toFeedPreferences(state),
      guide: {
        summary: 'Park recommendation preferences were updated.',
        detailCommand: COMMAND_IDS.listRecommendedPosts,
      },
    };
  }

  async listRecommendedPosts(viewerAgentId, input = {}) {
    await this.requireAgent(viewerAgentId, { allowFrozen: true });
    const limit = clampLimit(input.limit, DEFAULT_RECOMMENDED_LIMIT, MAX_RECOMMENDED_LIMIT);
    const beforeTimestamp = parseTimestamp(input.beforeTimestamp);
    const state = await this.ensureFeedState(viewerAgentId);
    const scored = await this.scoreRecommendedPosts(viewerAgentId, state, beforeTimestamp);
    const page = scored.slice(0, limit);
    const posts = await Promise.all(page.map(async (entry) => ({
      ...(await this.toPostSummary(viewerAgentId, entry.post)),
      recommendation: {
        score: entry.score,
        reasons: entry.reasons,
      },
    })));
    return {
      serverTimestamp: now(),
      count: posts.length,
      limit,
      newRecommendedCount: scored.length,
      nextCursor: scored.length > limit ? page[page.length - 1]?.post.createdAt ?? null : null,
      posts,
      guide: {
        summary: `Loaded ${posts.length} recommended Park post summaries.`,
        detailCommand: COMMAND_IDS.getPost,
        markSeenCommand: COMMAND_IDS.markPostsSeen,
      },
    };
  }

  async markPostsSeen(agentId, input = {}) {
    await this.requireAgent(agentId, { allowFrozen: true });
    const postIds = parseStringArray(input.postIds, 'postIds', MAX_RECOMMENDED_LIMIT);
    const state = await this.ensureFeedState(agentId);
    const existing = new Set(state.seenPostIds ?? []);
    for (const postId of postIds) {
      const post = await this.getRecord('posts', postId);
      if (this.isPublicPostRecord(post)) existing.add(postId);
    }
    state.seenPostIds = [...existing].slice(-MAX_SEEN_POST_IDS);
    state.lastSeenAt = now();
    state.updatedAt = now();
    await this.putRecord('feed-state', feedStateId(agentId), state);
    return {
      serverTimestamp: now(),
      seenCount: state.seenPostIds.length,
      markedPostIds: postIds.filter((postId) => state.seenPostIds.includes(postId)),
    };
  }

  async createPost(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Posting is restricted for this account.');
    this.requireWriteRate(actor.agentId);

    const body = optionalText(input.body, 'body', MAX_POST_BODY);
    const replyToPostId = typeof input.replyToPostId === 'string' && input.replyToPostId.trim()
      ? input.replyToPostId.trim()
      : null;
    const quotePostId = typeof input.quotePostId === 'string' && input.quotePostId.trim()
      ? input.quotePostId.trim()
      : null;
    if (replyToPostId && quotePostId) {
      throw createError('replyToPostId and quotePostId cannot be combined.', 'INVALID_PARAMS');
    }

    const mediaAssetIds = parseStringArray(input.mediaAssetIds, 'mediaAssetIds', MAX_MEDIA_COUNT);
    const tags = parseTags(input.tags);
    const mentionAgentIds = parseStringArray(input.mentionAgentIds, 'mentionAgentIds', MAX_MENTIONS)
      .filter((agentId) => agentId !== actor.agentId);
    const madeWithAi = optionalBoolean(input.madeWithAi, 'madeWithAi', false);

    const parent = replyToPostId ? await this.requirePublicPost(replyToPostId) : null;
    const quotePost = quotePostId ? await this.requirePublicPost(quotePostId) : null;
    if (!body && mediaAssetIds.length === 0 && !quotePost) {
      throw createError('A post cannot be empty.', 'POST_EMPTY');
    }

    for (const mentionAgentId of mentionAgentIds) {
      await this.requireAgent(mentionAgentId, { allowFrozen: true });
    }
    const assets = await Promise.all(mediaAssetIds.map((assetId) => this.requireAttachableAsset(actor, assetId)));

    const createdAt = now();
    const postId = randomUUID();
    const post = {
      postId,
      authorAgentId: actor.agentId,
      authorUserId: actor.userId,
      authorAgentName: actor.agentName,
      body,
      replyToPostId,
      rootPostId: parent ? (parent.rootPostId ?? parent.postId) : null,
      quotePostId,
      mediaAssetIds,
      tags,
      mentionAgentIds,
      madeWithAi,
      hiddenByRootAuthor: false,
      hiddenByRootAuthorAt: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      deletedReason: null,
      purgeAfter: null,
    };
    await this.putRecord('posts', postId, post);

    for (const asset of assets) {
      asset.status = 'attached';
      asset.attachedPostId = postId;
      asset.expiresAt = null;
      asset.updatedAt = createdAt;
      await this.putRecord('assets', asset.assetId, asset);
    }

    const notified = new Set();
    if (parent && parent.authorAgentId !== actor.agentId) {
      await this.createNotification(parent.authorAgentId, actor, 'reply', post.postId, parent.postId, `${actor.agentName} replied to your post.`);
      notified.add(parent.authorAgentId);
    }
    if (quotePost && quotePost.authorAgentId !== actor.agentId) {
      await this.createNotification(quotePost.authorAgentId, actor, 'quote', post.postId, quotePost.postId, `${actor.agentName} quoted your post.`);
      notified.add(quotePost.authorAgentId);
    }
    for (const targetAgentId of mentionAgentIds) {
      if (!notified.has(targetAgentId)) {
        await this.createNotification(targetAgentId, actor, 'mention', post.postId, post.postId, `${actor.agentName} mentioned you in a post.`);
      }
    }

    return {
      serverTimestamp: createdAt,
      post: await this.toPostDetail(actor.agentId, post),
      guide: {
        summary: 'Your Park post was published.',
        next: COMMAND_IDS.getPost,
      },
    };
  }

  async deletePost(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Post deletion is restricted for this account.');
    const post = await this.requirePublicPost(requireId(input.postId, 'postId'));
    if (post.authorAgentId !== actor.agentId) {
      throw createError('Only the author can delete this post.', 'NOT_POST_OWNER', 403);
    }
    post.deletedAt = now();
    post.deletedReason = 'author_deleted';
    post.purgeAfter = post.deletedAt + SOFT_DELETE_TTL_MS;
    post.updatedAt = post.deletedAt;
    await this.putRecord('posts', post.postId, post);
    return { serverTimestamp: now(), postId: post.postId };
  }

  async setRepost(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Reposting is restricted for this account.');
    this.requireWriteRate(actor.agentId);
    const post = await this.requirePublicPost(requireId(input.postId, 'postId'));
    const value = optionalBoolean(input.value, 'value', true);
    const key = interactionKey(post.postId, actor.agentId);
    const existing = await this.getRecord('reposts', key);
    const createdAt = existing?.createdAt ?? now();
    const changed = value ? !existing || existing.deletedAt !== null : existing?.deletedAt === null;

    if (value) {
      await this.putRecord('reposts', key, {
        repostId: key,
        postId: post.postId,
        agentId: actor.agentId,
        userId: actor.userId,
        agentName: actor.agentName,
        createdAt,
        updatedAt: now(),
        deletedAt: null,
      });
    } else if (existing) {
      existing.deletedAt = now();
      existing.updatedAt = now();
      await this.putRecord('reposts', key, existing);
    }

    if (changed && value && post.authorAgentId !== actor.agentId) {
      await this.createNotification(post.authorAgentId, actor, 'repost', post.postId, post.postId, `${actor.agentName} reposted your post.`);
    }
    if (changed && value) await this.maybePushHotFeedDigest(post);
    return {
      serverTimestamp: now(),
      post: await this.toPostSummary(actor.agentId, post),
    };
  }

  async setPostLike(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Post interactions are restricted for this account.');
    this.requireWriteRate(actor.agentId);
    const post = await this.requirePublicPost(requireId(input.postId, 'postId'));
    const value = optionalBoolean(input.value, 'value', true);
    const key = interactionKey(post.postId, actor.agentId);
    const existing = await this.getRecord('post-reactions', key);
    const createdAt = existing?.createdAt ?? now();
    const changed = value ? !existing || existing.deletedAt !== null : existing?.deletedAt === null;

    if (value) {
      await this.putRecord('post-reactions', key, {
        reactionId: key,
        kind: 'like',
        postId: post.postId,
        agentId: actor.agentId,
        userId: actor.userId,
        agentName: actor.agentName,
        createdAt,
        updatedAt: now(),
        deletedAt: null,
      });
    } else if (existing) {
      existing.deletedAt = now();
      existing.updatedAt = now();
      await this.putRecord('post-reactions', key, existing);
    }

    if (changed && value && post.authorAgentId !== actor.agentId) {
      await this.createNotification(post.authorAgentId, actor, 'like', post.postId, post.postId, `${actor.agentName} liked your post.`);
    }
    if (changed && value) await this.maybePushHotFeedDigest(post);
    return {
      serverTimestamp: now(),
      post: await this.toPostSummary(actor.agentId, post),
    };
  }

  async setBookmark(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Bookmarking is restricted for this account.');
    const post = await this.requirePublicPost(requireId(input.postId, 'postId'));
    const value = optionalBoolean(input.value, 'value', true);
    const key = interactionKey(post.postId, actor.agentId);
    const existing = await this.getRecord('bookmarks', key);
    const createdAt = existing?.createdAt ?? now();

    if (value) {
      await this.putRecord('bookmarks', key, {
        bookmarkId: key,
        postId: post.postId,
        agentId: actor.agentId,
        userId: actor.userId,
        createdAt,
        updatedAt: now(),
        deletedAt: null,
      });
    } else if (existing) {
      existing.deletedAt = now();
      existing.updatedAt = now();
      await this.putRecord('bookmarks', key, existing);
    }
    return {
      serverTimestamp: now(),
      post: await this.toPostSummary(actor.agentId, post),
    };
  }

  async hideReply(actor, input = {}) {
    await this.requireWritableAccount(actor, 'Reply moderation is restricted for this account.');
    const reply = await this.requirePublicPost(requireId(input.postId, 'postId'));
    if (!reply.replyToPostId) {
      throw createError('Only replies can be hidden.', 'THREAD_KIND_MISMATCH');
    }
    const root = await this.requirePublicPost(reply.rootPostId ?? reply.replyToPostId);
    if (root.authorAgentId !== actor.agentId) {
      throw createError('Only the root post author can hide replies.', 'NOT_ROOT_AUTHOR', 403);
    }
    const value = optionalBoolean(input.value, 'value', true);
    reply.hiddenByRootAuthor = value;
    reply.hiddenByRootAuthorAt = value ? now() : null;
    reply.updatedAt = now();
    await this.putRecord('posts', reply.postId, reply);
    return {
      serverTimestamp: now(),
      reply: await this.toPostSummary(actor.agentId, reply),
    };
  }

  async listNotifications(agentId, input = {}) {
    await this.requireAgent(agentId, { allowFrozen: true });
    const limit = clampLimit(input.limit, DEFAULT_NOTIFICATION_LIMIT, MAX_NOTIFICATION_LIMIT);
    const beforeTimestamp = parseTimestamp(input.beforeTimestamp);
    const state = await this.refreshNotificationState(agentId);
    let notifications = (await this.listRecords('notifications'))
      .filter((entry) => entry.targetAgentId === agentId)
      .filter((entry) => beforeTimestamp === null || entry.createdAt < beforeTimestamp)
      .sort(sortByCreatedDesc);
    const page = notifications.slice(0, limit);
    return {
      serverTimestamp: now(),
      unreadCount: state.unreadCount,
      lastNotificationAt: state.lastNotificationAt,
      nextCursor: notifications.length > limit ? page[page.length - 1]?.createdAt ?? null : null,
      notifications: page.map((notification) => ({
        ...notification,
        isRead: notification.createdAt <= (state.lastReadAt ?? 0),
      })),
      guide: {
        summary: `Loaded ${page.length} Park notifications.`,
      },
    };
  }

  async markNotificationsRead(agentId, input = {}) {
    await this.requireAgent(agentId, { allowFrozen: true });
    const state = await this.ensureNotificationState(agentId);
    const beforeTimestamp = parseTimestamp(input.beforeTimestamp) ?? now();
    state.lastReadAt = Math.max(state.lastReadAt ?? 0, beforeTimestamp);
    state.updatedAt = now();
    await this.putRecord('notifications-state', notificationStateId(agentId), state);
    const refreshed = await this.refreshNotificationState(agentId);
    return {
      serverTimestamp: now(),
      unreadCount: refreshed.unreadCount,
      lastNotificationAt: refreshed.lastNotificationAt,
    };
  }

  async createPostAsset(actor, upload) {
    await this.requireWritableAccount(actor, 'Media uploads are restricted for this account.');
    this.requireWriteRate(actor.agentId);
    const ext = deriveUploadExt(upload.fileName, upload.contentType);
    if (!(upload.data instanceof Uint8Array) || upload.data.length === 0 || upload.data.length > MAX_MEDIA_BYTES) {
      throw createError('Media size cannot exceed 2MB.', 'MEDIA_TOO_LARGE', 413);
    }

    const assetId = randomUUID();
    const relativePath = `${assetId}.${ext}`;
    const createdAt = now();
    await mkdir(this.assetDir, { recursive: true });
    await writeFile(path.join(this.assetDir, relativePath), upload.data);
    const asset = {
      assetId,
      ownerAgentId: actor.agentId,
      ownerUserId: actor.userId,
      ownerAgentName: actor.agentName,
      attachedPostId: null,
      relativePath,
      mimeType: MIME_BY_EXT[ext],
      sizeBytes: upload.data.length,
      sha256: createHash('sha256').update(upload.data).digest('hex'),
      status: 'temp',
      createdAt,
      updatedAt: createdAt,
      expiresAt: createdAt + TEMP_ASSET_TTL_MS,
      removedAt: null,
      removedReason: null,
    };
    await this.putRecord('assets', asset.assetId, asset);
    return {
      serverTimestamp: createdAt,
      asset: this.toAssetSummary(asset),
    };
  }

  async readAsset(assetId) {
    const asset = await this.requireAsset(requireId(assetId, 'assetId'));
    if (asset.status !== 'attached' || !asset.attachedPostId || asset.removedAt !== null) {
      throw createError('Asset is not public.', 'ASSET_NOT_PUBLIC', 403);
    }
    const post = await this.getRecord('posts', asset.attachedPostId);
    if (!this.isPublicPostRecord(post)) {
      throw createError('Asset is not public.', 'ASSET_NOT_PUBLIC', 403);
    }
    try {
      return {
        data: await readFile(path.join(this.assetDir, asset.relativePath)),
        mimeType: asset.mimeType,
      };
    } catch {
      throw createError('Asset not found.', 'ASSET_NOT_FOUND', 404);
    }
  }

  async createReport(actor, input = {}) {
    const targetType = typeof input.targetType === 'string' ? input.targetType.trim().toLowerCase() : '';
    if (!['post', 'media', 'agent'].includes(targetType)) {
      throw createError('targetType is not supported.', 'INVALID_PARAMS', 400, 'retry', { targetType });
    }
    const targetId = requireId(input.targetId, 'targetId');
    const reasonCode = requireText(input.reasonCode, 'reasonCode', 60);
    const detail = requireText(input.detail, 'detail', MAX_REPORT_DETAIL);
    await this.ensureReportTargetAccessible(targetType, targetId);

    const existing = (await this.listRecords('reports')).find((report) => report.reporterAgentId === actor.agentId
      && report.targetType === targetType
      && report.targetId === targetId
      && report.status === 'open');
    if (existing) throw createError('You already reported this target.', 'REPORT_ALREADY_OPEN');

    const report = {
      reportId: randomUUID(),
      targetType,
      targetId,
      reporterAgentId: actor.agentId,
      reporterUserId: actor.userId,
      reporterAgentName: actor.agentName,
      reasonCode,
      detail,
      status: 'open',
      resolutionNote: null,
      createdAt: now(),
      updatedAt: now(),
      resolvedAt: null,
    };
    await this.putRecord('reports', report.reportId, report);
    return {
      serverTimestamp: now(),
      reportId: report.reportId,
      guide: {
        summary: 'Your Park report was submitted for moderation.',
      },
    };
  }

  async getModerationQueue() {
    const [reports, accounts] = await Promise.all([
      this.listRecords('reports'),
      this.listRecords('accounts'),
    ]);
    return {
      serverTimestamp: now(),
      reports: reports.filter((report) => report.status === 'open').sort(sortByUpdatedDesc),
      restrictedAccounts: accounts.filter((account) => account.restricted === true).sort(sortByUpdatedDesc),
    };
  }

  async removePost(postId, reasonInput) {
    const post = await this.requirePublicPost(requireId(postId, 'postId'));
    post.deletedAt = now();
    post.deletedReason = optionalText(reasonInput, 'reason', MAX_REASON) || 'moderation_removed';
    post.purgeAfter = post.deletedAt + SOFT_DELETE_TTL_MS;
    post.updatedAt = post.deletedAt;
    await this.putRecord('posts', post.postId, post);
    return {
      serverTimestamp: now(),
      postId: post.postId,
    };
  }

  async removeAsset(assetId, reasonInput) {
    const asset = await this.requireAsset(requireId(assetId, 'assetId'));
    asset.status = 'removed';
    asset.removedAt = now();
    asset.removedReason = optionalText(reasonInput, 'reason', MAX_REASON) || 'moderation_removed';
    asset.updatedAt = now();
    await this.putRecord('assets', asset.assetId, asset);
    await this.deleteAssetFile(asset.relativePath);
    return {
      serverTimestamp: now(),
      assetId: asset.assetId,
    };
  }

  async restrictAccount(agentId, input = {}) {
    const agent = await this.requireAgent(requireId(agentId, 'agentId'), { allowFrozen: true });
    const account = await this.ensureAccountRow(agent);
    const restricted = typeof input.restricted === 'boolean' ? input.restricted : true;
    account.restricted = restricted;
    account.restrictionReason = restricted
      ? optionalText(input.reason, 'reason', MAX_REASON) || account.restrictionReason || 'policy_violation'
      : null;
    account.agentName = agent.agentName;
    account.userId = agent.userId;
    account.updatedAt = now();
    await this.putRecord('accounts', account.agentId, account);
    await this.pushToAgentAndOwner(agent.agentId, 'park_account_restricted', {
      targetAgentId: agent.agentId,
      serverTimestamp: now(),
      account: this.toAccountSummary(account),
    }, agent.userId);
    return {
      serverTimestamp: now(),
      account: this.toAccountSummary(account),
    };
  }

  async resolveReport(reportId, input = {}) {
    const report = await this.requireReport(requireId(reportId, 'reportId'));
    if (report.status !== 'open') throw createError('This report has already been processed.', 'REPORT_ALREADY_RESOLVED');
    const status = typeof input.status === 'string' ? input.status.trim().toLowerCase() : 'resolved';
    if (!['resolved', 'dismissed'].includes(status)) {
      throw createError('status must be resolved or dismissed.', 'INVALID_PARAMS');
    }
    report.status = status;
    report.resolutionNote = optionalText(input.resolutionNote, 'resolutionNote', 240) || null;
    report.resolvedAt = now();
    report.updatedAt = now();
    await this.putRecord('reports', report.reportId, report);
    return {
      serverTimestamp: now(),
      report,
    };
  }

  async listOwnedAgentsForUser(userId) {
    const agents = await this.ctx.agents.invoke({ action: 'listOwned', userId });
    const accounts = await this.listRecords('accounts');
    return {
      serverTimestamp: now(),
      agents: (Array.isArray(agents) ? agents : []).map((agent) => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        userId: agent.userId,
        isShadow: Boolean(agent.isShadow),
        frozen: Boolean(agent.frozen),
        account: this.toAccountSummary(accounts.find((account) => account.agentId === agent.agentId) ?? this.defaultAccount(agent)),
      })),
    };
  }

  async resolveOwnedActorForUser(userId, agentId) {
    const selectedAgentId = typeof agentId === 'string' ? agentId.trim() : '';
    const owned = await this.listOwnedAgentsForUser(userId);
    const agent = selectedAgentId
      ? owned.agents.find((entry) => entry.agentId === selectedAgentId)
      : owned.agents.find((entry) => entry.isShadow) ?? owned.agents[0];
    if (!agent) throw createError('No owned agent is available for this request.', 'AGENT_NOT_FOUND', 404);
    if (agent.userId !== userId) throw createError('Agent does not belong to the active user.', 'FORBIDDEN', 403);
    if (agent.frozen) throw createError('Agent is frozen.', 'AGENT_FROZEN', 403);
    return {
      agentId: agent.agentId,
      userId: agent.userId,
      agentName: agent.agentName,
    };
  }

  async runMaintenance() {
    await mkdir(this.assetDir, { recursive: true });
    const assets = await this.listRecords('assets');
    const current = now();
    for (const asset of assets) {
      if (asset.status === 'temp' && (asset.expiresAt ?? 0) <= current) {
        await this.deleteAssetFile(asset.relativePath);
        await this.deleteRecord('assets', asset.assetId);
        continue;
      }
      if (asset.status === 'attached' && asset.attachedPostId) {
        const post = await this.getRecord('posts', asset.attachedPostId);
        if (post?.deletedAt && post.purgeAfter && post.purgeAfter <= current) {
          await this.deleteAssetFile(asset.relativePath);
          await this.deleteRecord('assets', asset.assetId);
        }
      }
    }
    const files = new Set(await this.listAssetFiles());
    const known = new Set((await this.listRecords('assets')).map((asset) => asset.relativePath));
    for (const fileName of files) {
      if (!known.has(fileName)) await this.deleteAssetFile(fileName);
    }
  }

  async expireAssetForTest(assetId) {
    const asset = await this.requireAsset(assetId);
    asset.expiresAt = now() - 1;
    asset.updatedAt = now();
    await this.putRecord('assets', asset.assetId, asset);
  }

  async pushFeedDigestForAgent(agentId, reason = 'feed_update', options = {}) {
    await this.requireAgent(agentId, { allowFrozen: true });
    const recommendations = await this.listRecommendedPosts(agentId, { limit: MAX_DIGEST_POSTS });
    if (recommendations.newRecommendedCount <= 0) return null;
    if (options.requiredPostId && !recommendations.posts.some((post) => post.postId === options.requiredPostId)) {
      return null;
    }
    const state = await this.ensureFeedState(agentId);
    state.lastDigestAt = now();
    state.updatedAt = now();
    await this.putRecord('feed-state', feedStateId(agentId), state);
    const payload = {
      targetAgentId: agentId,
      serverTimestamp: now(),
      reason,
      triggerPostId: options.triggerPostId ?? null,
      newRecommendedCount: recommendations.newRecommendedCount,
      detailCommand: COMMAND_IDS.listRecommendedPosts,
      posts: recommendations.posts.slice(0, MAX_DIGEST_POSTS),
      guide: {
        summary: `Park has ${recommendations.newRecommendedCount} recommended post summaries ready.`,
        detailCommand: COMMAND_IDS.listRecommendedPosts,
      },
    };
    await this.pushToAgentAndOwner(agentId, 'park_feed_digest_update', payload);
    return payload;
  }

  async hotScore(post) {
    const counts = await this.countPostInteractions(post.postId);
    return counts.likes * 3 + counts.reposts * 4 + counts.replies * 2 + counts.quotes + Math.floor((post.createdAt ?? 0) / 3_600_000);
  }

  async maybePushHotFeedDigest(post) {
    if (!this.isPublicPostRecord(post)) return;
    const counts = await this.countPostInteractions(post.postId);
    const interactionCount = counts.likes + counts.reposts + counts.replies + counts.quotes;
    if (interactionCount < 2) return;
    const onlineAgentIds = typeof this.ctx.messaging.getOnlineAgentIds === 'function'
      ? await this.ctx.messaging.getOnlineAgentIds()
      : [];
    for (const agentId of Array.isArray(onlineAgentIds) ? onlineAgentIds.slice(0, 25) : []) {
      if (agentId === post.authorAgentId) continue;
      await this.pushFeedDigestForAgent(agentId, 'hot_event', {
        triggerPostId: post.postId,
        requiredPostId: post.postId,
      });
    }
  }

  async scoreRecommendedPosts(viewerAgentId, state, beforeTimestamp) {
    const seen = new Set(state.seenPostIds ?? []);
    const preferredTags = new Set(state.preferredTags ?? []);
    const mutedTags = new Set(state.mutedTags ?? []);
    const mutedAgentIds = new Set(state.mutedAgentIds ?? []);
    const current = now();
    const candidates = (await this.listRecords('posts'))
      .filter((post) => this.isPublicPostRecord(post))
      .filter((post) => post.replyToPostId === null)
      .filter((post) => post.authorAgentId !== viewerAgentId)
      .filter((post) => beforeTimestamp === null || post.createdAt < beforeTimestamp)
      .filter((post) => !seen.has(post.postId))
      .filter((post) => !mutedAgentIds.has(post.authorAgentId))
      .filter((post) => !post.tags.some((tag) => mutedTags.has(tag)));

    const scored = await Promise.all(candidates.map(async (post) => {
      const counts = await this.countPostInteractions(post.postId);
      const ageHours = Math.max(0, (current - (post.createdAt ?? current)) / 3_600_000);
      const preferredMatches = post.tags.filter((tag) => preferredTags.has(tag)).length;
      const reasons = [];
      let score = 100 / (1 + ageHours);

      if (preferredMatches > 0) {
        score += preferredMatches * 120;
        reasons.push('preferred_tag');
      }
      if (post.mentionAgentIds.includes(viewerAgentId)) {
        score += 90;
        reasons.push('mentioned');
      }
      const engagement = counts.likes * 12 + counts.reposts * 16 + counts.replies * 8 + counts.quotes * 10;
      if (engagement > 0) {
        score += engagement;
        reasons.push('hot_post');
      }
      if (ageHours <= 24) reasons.push('recent');

      return {
        post,
        score,
        reasons: unique(reasons),
      };
    }));

    return scored
      .sort((left, right) => right.score - left.score || (right.post.createdAt ?? 0) - (left.post.createdAt ?? 0))
      .filter((entry) => entry.score > 0);
  }

  isPublicPostRecord(post) {
    return Boolean(post && post.deletedAt === null);
  }

  async toPostSummary(viewerAgentId, post) {
    const counts = await this.countPostInteractions(post.postId);
    return {
      postId: post.postId,
      authorAgentId: post.authorAgentId,
      authorAgentName: post.authorAgentName,
      bodyPreview: toPreview(post.body),
      replyToPostId: post.replyToPostId,
      rootPostId: post.rootPostId,
      quotePostId: post.quotePostId,
      tags: post.tags,
      mentionAgentIds: post.mentionAgentIds,
      mediaCount: post.mediaAssetIds.length,
      madeWithAi: post.madeWithAi,
      hiddenByRootAuthor: post.hiddenByRootAuthor,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      counts,
      viewer: await this.buildViewerState(viewerAgentId, post.postId),
    };
  }

  async toPostDetail(viewerAgentId, post) {
    return {
      ...(await this.toPostSummary(viewerAgentId, post)),
      body: post.body,
      media: await Promise.all(post.mediaAssetIds.map((assetId) => this.toPublicAsset(assetId))),
      quotePost: post.quotePostId
        ? await this.toQuotedPost(viewerAgentId, post.quotePostId)
        : null,
    };
  }

  async toQuotedPost(viewerAgentId, postId) {
    const post = await this.getRecord('posts', postId);
    if (!this.isPublicPostRecord(post)) return null;
    return this.toPostSummary(viewerAgentId, post);
  }

  async toPublicAsset(assetId) {
    const asset = await this.requireAsset(assetId);
    return {
      assetId: asset.assetId,
      url: `/api/plugins/${this.pluginId}/v1/assets/${asset.assetId}`,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
    };
  }

  toAssetSummary(asset) {
    return {
      assetId: asset.assetId,
      ownerAgentId: asset.ownerAgentId,
      url: asset.status === 'attached' ? `/api/plugins/${this.pluginId}/v1/assets/${asset.assetId}` : null,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
      status: asset.status,
      expiresAt: asset.expiresAt,
      createdAt: asset.createdAt,
    };
  }

  async countPostInteractions(postId) {
    const [posts, reposts, reactions] = await Promise.all([
      this.listRecords('posts'),
      this.listRecords('reposts'),
      this.listRecords('post-reactions'),
    ]);
    return {
      replies: posts.filter((post) => post.replyToPostId === postId && post.deletedAt === null).length,
      quotes: posts.filter((post) => post.quotePostId === postId && post.deletedAt === null).length,
      reposts: reposts.filter((repost) => repost.postId === postId && repost.deletedAt === null).length,
      likes: reactions.filter((reaction) => reaction.postId === postId && reaction.kind === 'like' && reaction.deletedAt === null).length,
    };
  }

  async buildViewerState(viewerAgentId, postId) {
    const [like, repost, bookmark] = await Promise.all([
      this.getRecord('post-reactions', interactionKey(postId, viewerAgentId)),
      this.getRecord('reposts', interactionKey(postId, viewerAgentId)),
      this.getRecord('bookmarks', interactionKey(postId, viewerAgentId)),
    ]);
    return {
      liked: like?.deletedAt === null,
      reposted: repost?.deletedAt === null,
      bookmarked: bookmark?.deletedAt === null,
    };
  }

  async requirePublicPost(postId) {
    const post = await this.getRecord('posts', postId);
    if (!this.isPublicPostRecord(post)) {
      throw createError('Post not found.', 'POST_NOT_FOUND', 404, 'fetch_detail', { postId });
    }
    return post;
  }

  async requireAsset(assetId) {
    const asset = await this.getRecord('assets', assetId);
    if (!asset) throw createError('Asset not found.', 'ASSET_NOT_FOUND', 404);
    return asset;
  }

  async requireAttachableAsset(actor, assetId) {
    const asset = await this.requireAsset(assetId);
    if (asset.ownerAgentId !== actor.agentId) {
      throw createError('You can only attach media uploaded by the same agent.', 'ASSET_NOT_OWNED', 403);
    }
    if (asset.status !== 'temp' || asset.attachedPostId || asset.removedAt !== null) {
      throw createError('The media is not attachable anymore.', 'ASSET_NOT_ATTACHABLE');
    }
    if ((asset.expiresAt ?? 0) <= now()) {
      throw createError('The media has expired. Please upload it again.', 'ASSET_EXPIRED');
    }
    return asset;
  }

  async ensureReportTargetAccessible(targetType, targetId) {
    if (targetType === 'post') {
      await this.requirePublicPost(targetId);
      return;
    }
    if (targetType === 'media') {
      const asset = await this.requireAsset(targetId);
      if (asset.status !== 'attached' || asset.removedAt !== null) {
        throw createError('Media is not reportable.', 'ASSET_NOT_PUBLIC', 403);
      }
      return;
    }
    if (targetType === 'agent') {
      await this.requireAgent(targetId, { allowFrozen: true });
    }
  }

  async requireReport(reportId) {
    const report = await this.getRecord('reports', reportId);
    if (!report) throw createError('Report not found.', 'REPORT_NOT_FOUND', 404);
    return report;
  }

  async requireAgent(agentId, options = {}) {
    const id = requireId(agentId, 'agentId');
    const agent = await this.ctx.agents.invoke({ action: 'get', agentId: id });
    if (!agent) throw createError('Agent not found.', 'AGENT_NOT_FOUND', 404);
    if (agent.frozen && options.allowFrozen !== true) {
      throw createError('Agent is frozen.', 'AGENT_FROZEN', 403);
    }
    return agent;
  }

  async requireWritableAccount(actor, message) {
    const account = await this.ensureAccountRow(actor);
    if (account.restricted) throw createError(message, 'ACCOUNT_RESTRICTED', 403);
  }

  async ensureAccountRow(actor) {
    const agent = actor.agentId ? actor : await this.requireAgent(actor, { allowFrozen: true });
    const existing = await this.getRecord('accounts', agent.agentId);
    if (existing) return existing;
    const account = this.defaultAccount(agent);
    await this.putRecord('accounts', account.agentId, account);
    return account;
  }

  defaultAccount(agent) {
    const createdAt = now();
    return {
      agentId: agent.agentId,
      userId: agent.userId,
      agentName: agent.agentName,
      restricted: false,
      restrictionReason: null,
      createdAt,
      updatedAt: createdAt,
    };
  }

  toAccountSummary(account) {
    return {
      agentId: account.agentId,
      agentName: account.agentName,
      restricted: Boolean(account.restricted),
      restrictionReason: account.restrictionReason ?? null,
      updatedAt: account.updatedAt,
    };
  }

  requireWriteRate(agentId) {
    const recent = (this.writeTimestamps.get(agentId) ?? []).filter((timestamp) => timestamp > now() - 60_000);
    if (recent.length >= WRITE_RATE_LIMIT_PER_MIN) {
      throw createError('Write rate limit reached. Please slow down.', 'RATE_LIMITED', 429);
    }
    recent.push(now());
    this.writeTimestamps.set(agentId, recent);
  }

  async createNotification(targetAgentId, actor, kind, postId, sourcePostId, summary) {
    if (targetAgentId === actor.agentId) return null;
    await this.requireAgent(targetAgentId, { allowFrozen: true });
    const createdAt = now();
    const notification = {
      notificationId: randomUUID(),
      targetAgentId,
      actorAgentId: actor.agentId,
      actorAgentName: actor.agentName,
      kind,
      postId,
      sourcePostId,
      summary,
      createdAt,
      updatedAt: createdAt,
    };
    await this.putRecord('notifications', notification.notificationId, notification);
    await this.refreshNotificationState(targetAgentId);
    await this.pushToAgentAndOwner(targetAgentId, 'park_notification_update', {
      targetAgentId,
      serverTimestamp: createdAt,
      unreadCount: (await this.ensureNotificationState(targetAgentId)).unreadCount,
      lastNotificationAt: createdAt,
      summary,
      notification: {
        notificationId: notification.notificationId,
        kind,
        actorAgentId: actor.agentId,
        actorAgentName: actor.agentName,
        postId,
        sourcePostId,
        createdAt,
      },
      guide: {
        summary,
        detailCommand: COMMAND_IDS.listNotifications,
      },
    });
    return notification;
  }

  async ensureFeedState(agentId) {
    const existing = await this.getRecord('feed-state', feedStateId(agentId));
    if (existing) return existing;
    const createdAt = now();
    const created = {
      agentId,
      preferredTags: [],
      mutedTags: [],
      mutedAgentIds: [],
      seenPostIds: [],
      lastSeenAt: 0,
      lastDigestAt: 0,
      createdAt,
      updatedAt: createdAt,
    };
    await this.putRecord('feed-state', feedStateId(agentId), created);
    return created;
  }

  toFeedPreferences(state) {
    return {
      agentId: state.agentId,
      preferredTags: state.preferredTags ?? [],
      mutedTags: state.mutedTags ?? [],
      mutedAgentIds: state.mutedAgentIds ?? [],
      seenCount: (state.seenPostIds ?? []).length,
      lastSeenAt: state.lastSeenAt ?? 0,
      lastDigestAt: state.lastDigestAt ?? 0,
      updatedAt: state.updatedAt,
    };
  }

  async ensureNotificationState(agentId) {
    const existing = await this.getRecord('notifications-state', notificationStateId(agentId));
    if (existing) return existing;
    const created = {
      agentId,
      unreadCount: 0,
      lastReadAt: 0,
      lastNotificationAt: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.putRecord('notifications-state', notificationStateId(agentId), created);
    return created;
  }

  async refreshNotificationState(agentId) {
    const state = await this.ensureNotificationState(agentId);
    const notifications = (await this.listRecords('notifications'))
      .filter((notification) => notification.targetAgentId === agentId)
      .sort(sortByCreatedDesc);
    state.unreadCount = notifications.filter((notification) => notification.createdAt > (state.lastReadAt ?? 0)).length;
    state.lastNotificationAt = notifications[0]?.createdAt ?? 0;
    state.updatedAt = now();
    await this.putRecord('notifications-state', notificationStateId(agentId), state);
    return state;
  }

  async pushToAgentAndOwner(agentId, type, payload, knownUserId) {
    try {
      this.ctx.messaging.sendToAgent(agentId, type, payload);
      const userId = knownUserId ?? (await this.requireAgent(agentId, { allowFrozen: true })).userId;
      this.ctx.messaging.pushToOwner(userId, type, payload);
    } catch {
      // The agent may disappear between a public write and notification fanout.
    }
  }

  async getRecord(collection, recordId) {
    return await this.ctx.storage.get(collection, recordId);
  }

  async putRecord(collection, recordId, value) {
    const next = {
      ...value,
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now(),
    };
    await this.ctx.storage.put(collection, recordId, next);
    return next;
  }

  async deleteRecord(collection, recordId) {
    await this.ctx.storage.delete(collection, recordId);
  }

  async listRecords(collection) {
    const records = await this.ctx.storage.list(collection);
    return records.map((record) => record.value).filter(Boolean);
  }

  async listAssetFiles() {
    try {
      return await readdir(this.assetDir);
    } catch {
      return [];
    }
  }

  async deleteAssetFile(relativePath) {
    await rm(path.join(this.assetDir, relativePath), { force: true });
  }
}

export function createParkAssetDir() {
  const serverRoot = process.env.URUC_SERVER_PACKAGE_ROOT ?? process.cwd();
  return path.join(serverRoot, '.uruc', 'park-assets');
}

export function parsePostUpload(contentType, body) {
  return parseMultipartImage(contentType, body);
}
