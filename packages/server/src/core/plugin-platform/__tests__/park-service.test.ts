import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ParkService, parsePostUpload } from '../../../../../plugins/park/service.mjs';

interface MockAgentRecord {
  agentId: string;
  userId: string;
  agentName: string;
  description?: string | null;
  searchable?: boolean;
  frozen?: boolean;
  isShadow?: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createMockContext(agentRecords: MockAgentRecord[]) {
  const collections = new Map<string, Map<string, unknown>>();
  const agents = new Map(agentRecords.map((agent) => [agent.agentId, clone(agent)]));
  const agentMessages: Array<{ agentId: string; type: string; payload: unknown }> = [];
  const ownerMessages: Array<{ userId: string; type: string; payload: unknown }> = [];

  return {
    ctx: {
      storage: {
        async get(collection: string, recordId: string) {
          return clone(collections.get(collection)?.get(recordId) ?? null);
        },
        async put(collection: string, recordId: string, value: unknown) {
          if (!collections.has(collection)) collections.set(collection, new Map());
          collections.get(collection)?.set(recordId, clone(value));
        },
        async delete(collection: string, recordId: string) {
          collections.get(collection)?.delete(recordId);
        },
        async list(collection: string) {
          const records = [...(collections.get(collection)?.entries() ?? [])];
          return records.map(([id, value]) => ({ id, value: clone(value), updatedAt: Date.now() }));
        },
      },
      agents: {
        async invoke(input: { action: string; agentId?: string; query?: string; limit?: number; userId?: string }) {
          if (input.action === 'get') return clone(input.agentId ? agents.get(input.agentId) ?? null : null);
          if (input.action === 'listOwned') {
            return [...agents.values()]
              .filter((agent) => agent.userId === input.userId)
              .map((agent) => clone(agent));
          }
          if (input.action === 'search') {
            const query = (input.query ?? '').trim().toLowerCase();
            return [...agents.values()]
              .filter((agent) => agent.searchable !== false)
              .filter((agent) => !query
                || agent.agentId.toLowerCase().includes(query)
                || agent.agentName.toLowerCase().includes(query)
                || (agent.description ?? '').toLowerCase().includes(query))
              .slice(0, input.limit ?? 20)
              .map((agent) => clone(agent));
          }
          return null;
        },
      },
      messaging: {
        getOnlineAgentIds() {
          return [...agents.keys()];
        },
        sendToAgent(agentId: string, type: string, payload: unknown) {
          agentMessages.push({ agentId, type, payload: clone(payload) });
        },
        pushToOwner(userId: string, type: string, payload: unknown) {
          ownerMessages.push({ userId, type, payload: clone(payload) });
        },
      },
      logging: {
        async info() {},
        async warn() {},
      },
    },
    agentStore: agents,
    agentMessages,
    ownerMessages,
    actors: Object.fromEntries(agentRecords.map((agent) => [agent.agentId, {
      agentId: agent.agentId,
      userId: agent.userId,
      agentName: agent.agentName,
    }])),
    collections,
  };
}

describe('ParkService', () => {
  let tempDir = '';
  let service: ParkService;
  let actors: Record<string, { agentId: string; userId: string; agentName: string }>;
  let agentMessages: Array<{ agentId: string; type: string; payload: unknown }>;
  let ownerMessages: Array<{ userId: string; type: string; payload: unknown }>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-park-service-'));
    const mock = createMockContext([
      { agentId: 'agent-a', userId: 'user-a', agentName: 'Agent A', description: 'systems' },
      { agentId: 'agent-b', userId: 'user-b', agentName: 'Agent B', description: 'physics' },
      { agentId: 'agent-c', userId: 'user-c', agentName: 'Agent C', description: 'markets' },
      { agentId: 'agent-a-alt', userId: 'user-a', agentName: 'Agent A Alt', frozen: true, isShadow: true },
    ]);
    actors = mock.actors;
    agentMessages = mock.agentMessages;
    ownerMessages = mock.ownerMessages;
    service = new ParkService({
      ctx: mock.ctx,
      pluginId: 'uruc.park',
      assetDir: path.join(tempDir, 'assets'),
    });
    await service.start();
  });

  afterEach(async () => {
    await service.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('provides a concise intro command contract for unfamiliar agents', () => {
    const intro = service.getIntro();

    expect(intro).toMatchObject({
      pluginId: 'uruc.park',
      summary: expect.stringContaining('public'),
      firstCommands: expect.arrayContaining([
        'uruc.park.list_posts@v1',
        'uruc.park.create_post@v1',
      ]),
      fields: expect.arrayContaining([
        expect.objectContaining({ field: 'postId' }),
        expect.objectContaining({ field: 'mediaAssetIds' }),
        expect.objectContaining({ field: 'preferredTags' }),
      ]),
    });
    expect(JSON.stringify(intro).length).toBeLessThan(3600);
  });

  it('creates public posts with attached media, tags, mentions, and paginated summaries', async () => {
    const upload = await service.createPostAsset(actors['agent-a'], {
      fileName: 'diagram.png',
      contentType: 'image/png',
      data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });

    const created = await service.createPost(actors['agent-a'], {
      body: 'Open planning for the physics cluster.',
      mediaAssetIds: [upload.asset.assetId],
      tags: ['Physics', '#Planning'],
      mentionAgentIds: ['agent-b'],
      madeWithAi: true,
    });

    const timeline = await service.listPosts('agent-b', { limit: 10, tag: 'physics' });
    expect(timeline.posts).toEqual([
      expect.objectContaining({
        postId: created.post.postId,
        bodyPreview: 'Open planning for the physics cluster.',
        authorAgentId: 'agent-a',
        tags: ['physics', 'planning'],
        mediaCount: 1,
        madeWithAi: true,
        viewer: expect.objectContaining({ liked: false, reposted: false, bookmarked: false }),
      }),
    ]);
    expect(timeline.nextCursor).toBeNull();

    const detail = await service.getPost('agent-b', { postId: created.post.postId });
    expect(detail.post.media[0]).toMatchObject({
      assetId: upload.asset.assetId,
      url: `/api/plugins/uruc.park/v1/assets/${upload.asset.assetId}`,
      mimeType: 'image/png',
    });
    await expect(service.readAsset(upload.asset.assetId)).resolves.toMatchObject({ mimeType: 'image/png' });

    expect(agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'park_notification_update')).toMatchObject({
      payload: expect.objectContaining({
        targetAgentId: 'agent-b',
        summary: expect.stringContaining('mentioned'),
      }),
    });
  });

  it('supports replies, quote posts, reposts, likes, bookmarks, and notification read state', async () => {
    const root = await service.createPost(actors['agent-a'], { body: 'Root post for the city park.' });
    const reply = await service.createPost(actors['agent-b'], {
      body: 'Replying with a field report.',
      replyToPostId: root.post.postId,
    });
    const quote = await service.createPost(actors['agent-c'], {
      body: 'Quote this for visibility.',
      quotePostId: root.post.postId,
    });

    await service.setRepost(actors['agent-b'], { postId: root.post.postId, value: true });
    await service.setPostLike(actors['agent-c'], { postId: root.post.postId, value: true });
    await service.setBookmark(actors['agent-c'], { postId: root.post.postId, value: true });

    const detail = await service.getPost('agent-c', { postId: root.post.postId });
    expect(detail.post.counts).toMatchObject({ replies: 1, quotes: 1, reposts: 1, likes: 1 });
    expect(detail.post.viewer).toMatchObject({ liked: true, reposted: false, bookmarked: true });
    expect(detail.replyPreview[0]).toMatchObject({ postId: reply.post.postId });

    const quoteDetail = await service.getPost('agent-a', { postId: quote.post.postId });
    expect(quoteDetail.post.quotePost).toMatchObject({ postId: root.post.postId });

    const notifications = await service.listNotifications('agent-a', { limit: 10 });
    expect(notifications.unreadCount).toBeGreaterThanOrEqual(3);
    expect(notifications.notifications.map((entry: { kind: string }) => entry.kind)).toEqual(
      expect.arrayContaining(['reply', 'quote', 'repost', 'like']),
    );

    const read = await service.markNotificationsRead('agent-a', {
      beforeTimestamp: notifications.notifications[0].createdAt,
    });
    expect(read.unreadCount).toBe(0);
  });

  it('keeps bookmarks private and supports author-hidden replies', async () => {
    const root = await service.createPost(actors['agent-a'], { body: 'Root post.' });
    const reply = await service.createPost(actors['agent-b'], {
      body: 'A reply the author wants hidden.',
      replyToPostId: root.post.postId,
    });
    await service.setBookmark(actors['agent-c'], { postId: root.post.postId, value: true });

    expect((await service.listPosts('agent-c', { filter: 'bookmarks' })).posts).toHaveLength(1);
    expect((await service.listPosts('agent-b', { filter: 'bookmarks' })).posts).toHaveLength(0);

    await service.hideReply(actors['agent-a'], { postId: reply.post.postId, value: true });
    expect((await service.listReplies('agent-b', { postId: root.post.postId })).replies).toHaveLength(0);
    expect((await service.listReplies('agent-a', { postId: root.post.postId, includeHidden: true })).replies[0]).toMatchObject({
      postId: reply.post.postId,
      hiddenByRootAuthor: true,
    });
  });

  it('recommends a small unseen feed using preferences and seen state', async () => {
    await service.setFeedPreferences(actors['agent-b'], {
      preferredTags: ['physics', 'systems'],
      mutedTags: ['markets'],
      mutedAgentIds: ['agent-c'],
    });

    const physicsOne = await service.createPost(actors['agent-a'], {
      body: 'Physics routing update for the cluster.',
      tags: ['physics'],
    });
    const physicsTwo = await service.createPost(actors['agent-a'], {
      body: 'Systems and physics follow-up.',
      tags: ['systems', 'physics'],
    });
    await service.createPost(actors['agent-c'], {
      body: 'Market event should be muted.',
      tags: ['markets'],
    });

    const first = await service.listRecommendedPosts('agent-b', { limit: 50 });
    expect(first.posts).toHaveLength(2);
    expect(first.posts.map((post: { postId: string }) => post.postId)).toEqual([
      physicsTwo.post.postId,
      physicsOne.post.postId,
    ]);
    expect(first.posts[0]).toMatchObject({
      recommendation: expect.objectContaining({
        reasons: expect.arrayContaining(['preferred_tag']),
      }),
    });
    expect(first.limit).toBe(10);

    await service.markPostsSeen('agent-b', { postIds: [physicsTwo.post.postId] });
    const second = await service.listRecommendedPosts('agent-b', { limit: 5 });
    expect(second.posts.map((post: { postId: string }) => post.postId)).toEqual([
      physicsOne.post.postId,
    ]);
  });

  it('returns saved feed preferences through a read-only service method', async () => {
    await service.setFeedPreferences(actors['agent-b'], {
      preferredTags: ['Physics', '#Systems'],
      mutedTags: ['Markets'],
      mutedAgentIds: ['agent-c'],
    });

    const preferences = await service.getFeedPreferences('agent-b');

    expect(preferences).toMatchObject({
      feed: {
        agentId: 'agent-b',
        preferredTags: ['physics', 'systems'],
        mutedTags: ['markets'],
        mutedAgentIds: ['agent-c'],
        seenCount: 0,
      },
      guide: {
        summary: expect.stringContaining('loaded'),
      },
    });
  });

  it('pushes capped feed digests for login and sampled hot events without sending every post', async () => {
    await service.setFeedPreferences(actors['agent-b'], { preferredTags: ['physics'] });
    for (let index = 0; index < 5; index += 1) {
      await service.createPost(actors['agent-a'], {
        body: `Physics digest candidate ${index}`,
        tags: ['physics'],
      });
    }

    await service.pushFeedDigestForAgent('agent-b', 'agent_authenticated');
    const digest = agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'park_feed_digest_update');
    expect(digest?.payload).toMatchObject({
      targetAgentId: 'agent-b',
      reason: 'agent_authenticated',
      newRecommendedCount: 5,
      detailCommand: 'uruc.park.list_recommended_posts@v1',
    });
    expect((digest?.payload as { posts?: unknown[] }).posts).toHaveLength(3);

    agentMessages.length = 0;
    const hot = await service.createPost(actors['agent-a'], {
      body: 'Hot physics event for proactive sampling.',
      tags: ['physics'],
    });
    await service.setRepost(actors['agent-c'], { postId: hot.post.postId, value: true });
    await service.setPostLike(actors['agent-b'], { postId: hot.post.postId, value: true });

    const hotDigest = agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'park_feed_digest_update');
    expect(hotDigest?.payload).toMatchObject({
      targetAgentId: 'agent-b',
      reason: 'hot_event',
      triggerPostId: hot.post.postId,
    });
    expect((hotDigest?.payload as { posts?: unknown[] }).posts?.length).toBeLessThanOrEqual(3);

    await service.createPost(actors['agent-a'], {
      body: 'Ordinary non-preferred post should not fan out.',
      tags: ['gardens'],
    });
    const digestCount = agentMessages.filter((entry) => entry.agentId === 'agent-b' && entry.type === 'park_feed_digest_update').length;
    expect(digestCount).toBe(1);
  });

  it('enforces writable account restrictions and validates report targets', async () => {
    const root = await service.createPost(actors['agent-a'], { body: 'Reportable post.' });

    await service.restrictAccount('agent-b', { restricted: true, reason: 'policy' });
    await expect(service.createPost(actors['agent-b'], { body: 'blocked' })).rejects.toMatchObject({
      code: 'ACCOUNT_RESTRICTED',
    });

    const report = await service.createReport(actors['agent-c'], {
      targetType: 'post',
      targetId: root.post.postId,
      reasonCode: 'safety',
      detail: 'This needs moderator review.',
    });
    expect(report.reportId).toEqual(expect.any(String));

    const queue = await service.getModerationQueue();
    expect(queue.reports).toEqual([
      expect.objectContaining({ targetType: 'post', targetId: root.post.postId, status: 'open' }),
    ]);

    await service.removePost(root.post.postId, 'moderation_removed');
    await expect(service.getPost('agent-c', { postId: root.post.postId })).rejects.toMatchObject({
      code: 'POST_NOT_FOUND',
    });
  });

  it('keeps temporary media private, rejects unsupported uploads, and cleans expired assets', async () => {
    const upload = await service.createPostAsset(actors['agent-a'], {
      fileName: 'draft.gif',
      contentType: 'image/gif',
      data: Buffer.from('GIF89a', 'ascii'),
    });

    await expect(service.readAsset(upload.asset.assetId)).rejects.toMatchObject({ code: 'ASSET_NOT_PUBLIC' });
    await expect(service.createPostAsset(actors['agent-a'], {
      fileName: 'clip.mp4',
      contentType: 'video/mp4',
      data: Buffer.from([1, 2, 3]),
    })).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });

    await service.expireAssetForTest(upload.asset.assetId);
    await service.runMaintenance();
    await expect(service.createPost(actors['agent-a'], {
      body: 'Cannot attach expired media.',
      mediaAssetIds: [upload.asset.assetId],
    })).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
  });

  it('parses single-file multipart uploads for HTTP routes', () => {
    const boundary = 'park-boundary';
    const body = Buffer.from([
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="post.jpg"',
      'Content-Type: image/jpeg',
      '',
      'jpeg-bytes',
      `--${boundary}--`,
      '',
    ].join('\r\n'));

    expect(parsePostUpload(`multipart/form-data; boundary=${boundary}`, body)).toMatchObject({
      fileName: 'post.jpg',
      contentType: 'image/jpeg',
      data: Buffer.from('jpeg-bytes'),
    });
  });
});
