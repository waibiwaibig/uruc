import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SocialService } from '../../../../../plugins/social/service.mjs';

interface MockAgentRecord {
  agentId: string;
  userId: string;
  agentName: string;
  description?: string | null;
  avatarPath?: string | null;
  searchable?: boolean;
  frozen?: boolean;
  isOnline?: boolean;
  isShadow?: boolean;
}

interface SocialThreadMemberSummary {
  agentId: string;
  leftAt: number | null;
}

interface SocialMomentSummary {
  momentId: string;
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
          return records.map(([key, value]) => ({ key, value: clone(value) }));
        },
      },
      agents: {
        async invoke(input: { action: string; agentId?: string; query?: string; limit?: number; userId?: string }) {
          if (input.action === 'get') {
            return clone(input.agentId ? agents.get(input.agentId) ?? null : null);
          }
          if (input.action === 'search') {
            const query = (input.query ?? '').trim().toLowerCase();
            const limit = Math.max(1, input.limit ?? 20);
            return [...agents.values()]
              .filter((agent) => agent.searchable !== false)
              .filter((agent) => !query
                || agent.agentId.toLowerCase().includes(query)
                || agent.agentName.toLowerCase().includes(query)
                || (agent.description ?? '').toLowerCase().includes(query))
              .slice(0, limit)
              .map((agent) => clone(agent));
          }
          if (input.action === 'listOwned') {
            return [...agents.values()]
              .filter((agent) => agent.userId === input.userId)
              .map((agent) => clone(agent));
          }
          return null;
        },
      },
      messaging: {
        sendToAgent(agentId: string, type: string, payload: unknown) {
          agentMessages.push({ agentId, type, payload: clone(payload) });
        },
        pushToOwner(userId: string, type: string, payload: unknown) {
          ownerMessages.push({ userId, type, payload: clone(payload) });
        },
      },
      logging: {
        async info() {},
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
  };
}

async function makeFriends(service: SocialService, actor: { agentId: string; userId: string; agentName: string }, target: { agentId: string; userId: string; agentName: string }) {
  await service.sendRequest(actor, { agentId: target.agentId, note: 'hello' });
  await service.respondRequest(target, { agentId: actor.agentId, decision: 'accept' });
}

function expectLightweightRelationshipMutation(
  result: Record<string, unknown>,
  expected: {
    counts: {
      friends: number;
      incomingRequests: number;
      outgoingRequests: number;
      blocks: number;
    };
    changed: {
      reason: string;
      actorAgentId: string;
      targetAgentId: string;
    };
  },
) {
  expect(result).toMatchObject({
    serverTimestamp: expect.any(Number),
    counts: expected.counts,
    changed: {
      ...expected.changed,
      relationshipIds: [expect.any(String)],
    },
    detailCommand: 'uruc.social.list_relationships_page@v1',
    guide: expect.objectContaining({
      summary: expect.any(String),
    }),
  });
  expect(result).not.toHaveProperty('relationships');
  expect(result).not.toHaveProperty('friends');
  expect(result).not.toHaveProperty('incomingRequests');
  expect(result).not.toHaveProperty('outgoingRequests');
  expect(result).not.toHaveProperty('blocks');
}

describe('SocialService', () => {
  let tempDir = '';
  let service: SocialService;
  let actors: Record<string, { agentId: string; userId: string; agentName: string }>;
  let agentStore: Map<string, MockAgentRecord>;
  let agentMessages: Array<{ agentId: string; type: string; payload: unknown }>;
  let ownerMessages: Array<{ userId: string; type: string; payload: unknown }>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-social-service-'));
    const mock = createMockContext([
      { agentId: 'agent-a', userId: 'user-a', agentName: 'Agent A', description: 'rose', isOnline: true, isShadow: true },
      { agentId: 'agent-a-alt', userId: 'user-a', agentName: 'Agent A Alt', description: 'amber', isOnline: false },
      { agentId: 'agent-b', userId: 'user-b', agentName: 'Agent B', description: 'coral', isOnline: false },
      { agentId: 'agent-c', userId: 'user-c', agentName: 'Agent C', description: 'sand', isOnline: true },
      { agentId: 'agent-d', userId: 'user-d', agentName: 'Agent D', description: 'lilac', isOnline: false },
    ]);
    actors = mock.actors;
    agentStore = mock.agentStore;
    agentMessages = mock.agentMessages;
    ownerMessages = mock.ownerMessages;
    service = new SocialService({
      ctx: mock.ctx,
      pluginId: 'uruc.social',
      assetDir: path.join(tempDir, 'assets'),
      exportDir: path.join(tempDir, 'exports'),
    });
    await service.start();
  });

  afterEach(async () => {
    await service.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('provides a directly callable usage guide for agents', async () => {
    const usage = service.getUsageGuide();
    expect(usage).toMatchObject({
      pluginId: 'uruc.social',
      guide: expect.objectContaining({
        summary: expect.stringContaining('Uruc Social'),
        recommendedCommands: expect.arrayContaining([
          'uruc.social.list_relationships@v1',
          'uruc.social.list_inbox@v1',
          'uruc.social.send_thread_message@v1',
        ]),
      }),
    });
  });

  it('provides a compact social intro for first-time agents', async () => {
    const intro = service.getSocialIntro();
    expect(intro).toMatchObject({
      pluginId: 'uruc.social',
      summary: expect.stringContaining('Uruc Social'),
      useFor: expect.arrayContaining([
        expect.stringContaining('friend'),
        expect.stringContaining('message'),
      ]),
      firstCommands: expect.arrayContaining([
        'uruc.social.list_relationships_page@v1',
        'uruc.social.list_inbox@v1',
      ]),
      detailCommands: expect.arrayContaining([
        'uruc.social.get_usage_guide@v1',
      ]),
      rulesBrief: expect.any(Array),
      fieldGlossary: expect.arrayContaining([
        expect.objectContaining({ field: 'threadId' }),
      ]),
    });
  });

  it('keeps ordinary command guides compact instead of repeating the full usage guide', async () => {
    const result = await service.searchContacts(actors['agent-a'], { query: 'agent-b', limit: 10 });

    expect(result.guide).toMatchObject({
      summary: expect.stringContaining('Found'),
      nextCommands: expect.arrayContaining([
        'uruc.social.send_request@v1',
        'uruc.social.list_relationships_page@v1',
      ]),
    });
    expect(result.guide).not.toHaveProperty('whyYouReceivedThis');
    expect(result.guide).not.toHaveProperty('whatThisPluginIs');
    expect(result.guide).not.toHaveProperty('ruleHighlights');
    expect(result.guide).not.toHaveProperty('fieldGlossary');
  });

  it('searches discoverable contacts by agentId to disambiguate duplicate names', async () => {
    const result = await service.searchContacts(actors['agent-a'], { query: 'agent-b', limit: 10 });

    expect(result.results).toEqual([
      expect.objectContaining({
        agentId: 'agent-b',
        agentName: 'Agent B',
      }),
    ]);
  });

  it('returns stable retry metadata for invalid params and stable actions for permission errors', async () => {
    await expect(service.sendRequest(actors['agent-a'], {})).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      action: 'retry',
      details: { field: 'agentId' },
    });

    await expect(service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' })).rejects.toMatchObject({
      code: 'DIRECT_THREAD_REQUIRES_FRIENDSHIP',
      action: 'fix_relationship',
    });

    await service.restrictAccount('agent-a', { restricted: true, reason: 'policy' });
    await expect(service.createMoment(actors['agent-a'], { body: 'blocked write' })).rejects.toMatchObject({
      code: 'ACCOUNT_RESTRICTED',
      action: 'wait_or_contact_moderation',
    });
  });

  it('supports the friend request to direct message lifecycle', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);

    const thread = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });
    expect(thread).toMatchObject({
      serverTimestamp: expect.any(Number),
      threadId: expect.any(String),
      detailCommand: 'uruc.social.get_thread_history@v1',
    });
    expect(thread.thread.kind).toBe('direct');
    expect(thread.thread.title).toBe('Agent B');
    expect((thread as { guide?: { summary?: string } }).guide?.summary).toContain('Direct thread');
    expect(thread).not.toHaveProperty('messages');
    expect(thread).not.toHaveProperty('members');
    expect(thread).not.toHaveProperty('nextCursor');

    const sendResult = await service.sendThreadMessage(actors['agent-a'], {
      threadId: thread.thread.threadId,
      body: 'Hello from Fortune Red',
    });
    expect(sendResult.message.body).toBe('Hello from Fortune Red');
    expect((sendResult as { guide?: { summary?: string } }).guide?.summary).toContain('Message sent');

    const inboxBeforeRead = await service.listInbox('agent-b');
    expect(inboxBeforeRead.unreadTotal).toBe(1);
    expect(inboxBeforeRead.threads[0]?.lastMessagePreview).toContain('Hello from Fortune Red');
    expect((inboxBeforeRead as { guide?: { summary?: string } }).guide?.summary).toContain('Inbox summary');

    const history = await service.getThreadHistory('agent-b', { threadId: thread.thread.threadId });
    expect(history.messages).toHaveLength(1);
    expect(history.messages[0]?.senderAgentId).toBe('agent-a');
    expect((history as { guide?: { summary?: string } }).guide?.summary).toContain('Thread history');

    const readResult = await service.markThreadRead('agent-b', { threadId: thread.thread.threadId });
    expect(readResult.inbox.unreadTotal).toBe(0);
    expect((readResult as { guide?: { summary?: string } }).guide?.summary).toContain('Read marker');
  });

  it('does not push social_message_new back to the sending agent for fresh messages', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const thread = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });

    agentMessages.length = 0;
    ownerMessages.length = 0;

    await service.sendThreadMessage(actors['agent-a'], {
      threadId: thread.thread.threadId,
      body: 'Sender should not get a duplicate push',
    });

    expect(agentMessages.find((entry) => entry.agentId === 'agent-a' && entry.type === 'social_message_new')).toBeUndefined();
    expect(agentMessages.find((entry) => entry.agentId === 'agent-a' && entry.type === 'social_inbox_update')).toBeUndefined();
    expect(agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'social_message_new')).toMatchObject({
      payload: expect.objectContaining({
        thread: expect.objectContaining({
          lastMessagePreview: null,
        }),
        guide: expect.objectContaining({
          summary: expect.stringContaining('new social message'),
        }),
      }),
    });
    expect(agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'social_inbox_update')).toMatchObject({
      payload: expect.objectContaining({
        targetAgentId: 'agent-b',
        unreadTotal: 1,
        threadCount: 1,
        affectedThreadId: thread.thread.threadId,
        reason: 'message_created',
        detailCommand: 'uruc.social.list_inbox@v1',
        guide: expect.objectContaining({
          summary: expect.stringContaining('inbox summary changed'),
        }),
      }),
    });
    expect(agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'social_inbox_update')?.payload)
      .not.toHaveProperty('threads');
    expect(ownerMessages.find((entry) => entry.userId === 'user-a' && entry.type === 'social_message_new')).toMatchObject({
      payload: expect.objectContaining({
        targetAgentId: 'agent-a',
      }),
    });
    expect(ownerMessages.find((entry) => entry.userId === 'user-a' && entry.type === 'social_inbox_update')).toMatchObject({
      payload: expect.objectContaining({
        targetAgentId: 'agent-a',
        unreadTotal: 0,
      }),
    });
  });

  it('pushes lightweight relationship updates with detail pull metadata', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    agentMessages.length = 0;

    await service.sendRequest(actors['agent-a'], { agentId: 'agent-c' });

    const update = agentMessages.find((entry) => entry.agentId === 'agent-a' && entry.type === 'social_relationship_update');
    expect(update?.payload).toMatchObject({
      targetAgentId: 'agent-a',
      counts: {
        friends: 1,
        incomingRequests: 0,
        outgoingRequests: 1,
        blocks: 0,
      },
      changed: {
        reason: 'send_request',
        actorAgentId: 'agent-a',
        targetAgentId: 'agent-c',
        relationshipIds: [expect.any(String)],
      },
      detailCommand: 'uruc.social.list_relationships@v1',
    });
    expect(update?.payload).not.toHaveProperty('friends');
    expect(update?.payload).not.toHaveProperty('incomingRequests');
    expect(update?.payload).not.toHaveProperty('outgoingRequests');
    expect(update?.payload).not.toHaveProperty('blocks');
  });

  it('returns lightweight relationship write results with detail pull metadata', async () => {
    const request = await service.sendRequest(actors['agent-a'], { agentId: 'agent-b' });
    expectLightweightRelationshipMutation(request, {
      counts: {
        friends: 0,
        incomingRequests: 0,
        outgoingRequests: 1,
        blocks: 0,
      },
      changed: {
        reason: 'send_request',
        actorAgentId: 'agent-a',
        targetAgentId: 'agent-b',
      },
    });

    const response = await service.respondRequest(actors['agent-b'], { agentId: 'agent-a', decision: 'accept' });
    expectLightweightRelationshipMutation(response, {
      counts: {
        friends: 1,
        incomingRequests: 0,
        outgoingRequests: 0,
        blocks: 0,
      },
      changed: {
        reason: 'accept_request',
        actorAgentId: 'agent-b',
        targetAgentId: 'agent-a',
      },
    });

    const removed = await service.removeFriend(actors['agent-a'], { agentId: 'agent-b' });
    expectLightweightRelationshipMutation(removed, {
      counts: {
        friends: 0,
        incomingRequests: 0,
        outgoingRequests: 0,
        blocks: 0,
      },
      changed: {
        reason: 'remove_friend',
        actorAgentId: 'agent-a',
        targetAgentId: 'agent-b',
      },
    });

    const blocked = await service.blockAgent(actors['agent-a'], { agentId: 'agent-c' });
    expectLightweightRelationshipMutation(blocked, {
      counts: {
        friends: 0,
        incomingRequests: 0,
        outgoingRequests: 0,
        blocks: 1,
      },
      changed: {
        reason: 'block_agent',
        actorAgentId: 'agent-a',
        targetAgentId: 'agent-c',
      },
    });

    const unblocked = await service.unblockAgent(actors['agent-a'], { agentId: 'agent-c' });
    expectLightweightRelationshipMutation(unblocked, {
      counts: {
        friends: 0,
        incomingRequests: 0,
        outgoingRequests: 0,
        blocks: 0,
      },
      changed: {
        reason: 'unblock_agent',
        actorAgentId: 'agent-a',
        targetAgentId: 'agent-c',
      },
    });
  });

  it('paginates relationship summaries without changing the legacy relationship snapshot', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    await makeFriends(service, actors['agent-a'], actors['agent-c']);
    await makeFriends(service, actors['agent-a'], actors['agent-d']);

    const snapshot = await service.listRelationships('agent-a');
    expect(snapshot.friends).toHaveLength(3);
    expect(snapshot.incomingRequests).toEqual([]);
    expect(snapshot.outgoingRequests).toEqual([]);
    expect(snapshot.blocks).toEqual([]);

    const firstPage = await service.listRelationshipsPage('agent-a', { section: 'friends', limit: 2 });
    expect(firstPage).toMatchObject({
      counts: {
        friends: 3,
        incomingRequests: 0,
        outgoingRequests: 0,
        blocks: 0,
      },
      section: 'friends',
      detailCommand: 'uruc.social.list_relationships@v1',
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await service.listRelationshipsPage('agent-a', {
      section: 'friends',
      limit: 2,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('cuts off direct threads when one side blocks the other', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const thread = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });

    await service.blockAgent(actors['agent-a'], { agentId: 'agent-b' });

    const inbox = await service.listInbox('agent-a');
    expect(inbox.threads).toHaveLength(0);

    await expect(
      service.sendThreadMessage(actors['agent-b'], {
        threadId: thread.thread.threadId,
        body: 'Should not go through',
      }),
    ).rejects.toMatchObject({
      code: 'DIRECT_THREAD_HIDDEN',
    });
  });

  it('enforces invite-only groups and owner moderation', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    await makeFriends(service, actors['agent-a'], actors['agent-c']);
    await makeFriends(service, actors['agent-a'], actors['agent-d']);

    const created = await service.createGroup(actors['agent-a'], {
      title: 'Silk Cabinet',
      memberAgentIds: ['agent-b', 'agent-c'],
    });
    expect(created.thread.kind).toBe('group');
    expect(created.members.filter((member: SocialThreadMemberSummary) => member.leftAt === null)).toHaveLength(3);

    const invited = await service.inviteGroupMember(actors['agent-a'], {
      threadId: created.thread.threadId,
      agentId: 'agent-d',
    });
    expect(invited.members.filter((member: SocialThreadMemberSummary) => member.leftAt === null)).toHaveLength(4);

    const removed = await service.removeGroupMember(actors['agent-a'], {
      threadId: created.thread.threadId,
      agentId: 'agent-c',
    });
    expect(removed.members.find((member: SocialThreadMemberSummary) => member.agentId === 'agent-c')?.leftAt).not.toBeNull();

    await expect(
      service.renameGroup(actors['agent-b'], {
        threadId: created.thread.threadId,
        title: 'Takeover',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_GROUP_OWNER',
    });
  });

  it('stores a unified everyone mention for group chats', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    await makeFriends(service, actors['agent-a'], actors['agent-c']);

    const group = await service.createGroup(actors['agent-a'], {
      title: 'Announcement Hall',
      memberAgentIds: ['agent-b', 'agent-c'],
    });

    const sent = await service.sendThreadMessage(actors['agent-a'], {
      threadId: group.thread.threadId,
      body: 'Everyone, gather near the lantern wall.',
      mentionEveryone: true,
    });

    expect(sent.message).toMatchObject({
      mentionEveryone: true,
      mentions: [],
    });

    const rawRecord = await (service as any).getRecord('messages', sent.message.messageId);
    expect(rawRecord).toMatchObject({
      mentionEveryone: true,
      mentionAgentIds: [],
    });

    const history = await service.getThreadHistory('agent-b', { threadId: group.thread.threadId });
    expect(history.messages[0]).toMatchObject({
      body: 'Everyone, gather near the lantern wall.',
      mentionEveryone: true,
      mentions: [],
    });
  });

  it('rejects everyone mentions in direct threads', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const thread = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });

    await expect(
      service.sendThreadMessage(actors['agent-a'], {
        threadId: thread.thread.threadId,
        body: 'This should stay invalid.',
        mentionEveryone: true,
      }),
    ).rejects.toMatchObject({
      code: 'THREAD_KIND_MISMATCH',
    });
  });

  it('keeps moments private to the author and current friends, including image assets', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);

    const upload = await service.createMomentAsset(actors['agent-a'], {
      fileName: 'rose.png',
      contentType: 'image/png',
      data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    const created = await service.createMoment(actors['agent-a'], {
      body: 'Private circle only',
      assetIds: [upload.asset.assetId],
    });

    const friendFeed = await service.listMoments('agent-b');
    const strangerFeed = await service.listMoments('agent-c');
    expect(friendFeed.moments.map((moment: SocialMomentSummary) => moment.momentId)).toContain(created.moment.momentId);
    expect(strangerFeed.moments.map((moment: SocialMomentSummary) => moment.momentId)).not.toContain(created.moment.momentId);

    await expect(service.readAsset('agent-b', upload.asset.assetId)).resolves.toMatchObject({
      mimeType: 'image/png',
    });
    await expect(service.readAsset('agent-c', upload.asset.assetId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await service.restrictAccount('agent-a', { restricted: true, reason: 'policy' });
    await expect(
      service.createMoment(actors['agent-a'], { body: 'blocked write' }),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_RESTRICTED',
    });
  });

  it('supports idempotent moment likes for visible friends only', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const created = await service.createMoment(actors['agent-a'], {
      body: 'Private circle only',
    });

    const api = service as unknown as {
      setMomentLike?: (actor: unknown, input: unknown) => Promise<{
        moment: { viewerHasLiked: boolean; likeCount: number };
      }>;
    };

    expect(typeof api.setMomentLike).toBe('function');

    const liked = await api.setMomentLike!(actors['agent-b'], {
      momentId: created.moment.momentId,
      value: true,
    });
    expect(liked.moment.viewerHasLiked).toBe(true);
    expect(liked.moment.likeCount).toBe(1);

    const repeated = await api.setMomentLike!(actors['agent-b'], {
      momentId: created.moment.momentId,
      value: true,
    });
    expect(repeated.moment.likeCount).toBe(1);

    await service.removeFriend(actors['agent-a'], { agentId: 'agent-b' });

    await expect(
      api.setMomentLike!(actors['agent-b'], {
        momentId: created.moment.momentId,
        value: true,
      }),
    ).rejects.toMatchObject({
      code: 'MOMENT_INTERACTION_FORBIDDEN',
    });
  });

  it('pushes lightweight moment interaction updates and keeps created moments previewable', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    agentMessages.length = 0;

    const created = await service.createMoment(actors['agent-a'], {
      body: 'Preview this new moment',
    });
    const createdPush = agentMessages.find((entry) => entry.agentId === 'agent-b' && entry.type === 'social_moment_update');
    expect(createdPush?.payload).toMatchObject({
      event: 'moment_created',
      moment: expect.objectContaining({
        momentId: created.moment.momentId,
        body: 'Preview this new moment',
      }),
      detailCommand: 'uruc.social.list_moments@v1',
    });

    agentMessages.length = 0;
    await service.setMomentLike(actors['agent-b'], { momentId: created.moment.momentId, value: true });

    const likePush = agentMessages.find((entry) => entry.agentId === 'agent-a' && entry.type === 'social_moment_update');
    expect(likePush?.payload).toMatchObject({
      targetAgentId: 'agent-a',
      event: 'moment_liked',
      momentId: created.moment.momentId,
      authorAgentId: 'agent-a',
      summary: expect.stringContaining('liked'),
      detailCommand: 'uruc.social.list_moments@v1',
    });
    expect(likePush?.payload).not.toHaveProperty('moment');
  });

  it('allows comments and replies only while the moment remains visible', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const created = await service.createMoment(actors['agent-a'], {
      body: 'Lanterns tonight',
    });

    const api = service as unknown as {
      createMomentComment?: (actor: unknown, input: unknown) => Promise<{
        comment: { commentId: string };
      }>;
      listMomentComments?: (agentId: string, input: unknown) => Promise<{
        comments: Array<{ commentId: string }>;
      }>;
    };

    expect(typeof api.createMomentComment).toBe('function');
    expect(typeof api.listMomentComments).toBe('function');

    const comment = await api.createMomentComment!(actors['agent-b'], {
      momentId: created.moment.momentId,
      body: 'I will come by at dusk.',
    });
    const reply = await api.createMomentComment!(actors['agent-a'], {
      momentId: created.moment.momentId,
      body: 'Bring the red silk banner.',
      replyToCommentId: comment.comment.commentId,
    });

    await service.removeFriend(actors['agent-a'], { agentId: 'agent-b' });

    await expect(
      api.listMomentComments!('agent-b', { momentId: created.moment.momentId }),
    ).rejects.toMatchObject({
      code: 'MOMENT_NOT_VISIBLE',
    });
    await expect(
      api.createMomentComment!(actors['agent-b'], {
        momentId: created.moment.momentId,
        body: 'Too late now',
      }),
    ).rejects.toMatchObject({
      code: 'MOMENT_INTERACTION_FORBIDDEN',
    });

    const authorView = await api.listMomentComments!('agent-a', {
      momentId: created.moment.momentId,
    });
    expect(authorView.comments.find((entry) => entry.commentId === reply.comment.commentId)).toBeTruthy();
  });

  it('pushes only lightweight natural-language moment interaction guides', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const created = await service.createMoment(actors['agent-a'], {
      body: 'Watch the river.',
    });

    const api = service as unknown as {
      createMomentComment?: (actor: unknown, input: unknown) => Promise<unknown>;
    };

    expect(typeof api.createMomentComment).toBe('function');

    agentMessages.length = 0;
    ownerMessages.length = 0;

    await api.createMomentComment!(actors['agent-b'], {
      momentId: created.moment.momentId,
      body: 'I am already on my way.',
    });

    const notificationPush = ownerMessages.find((entry) => (
      entry.userId === 'user-a' && entry.type === 'social_moment_notification_update'
    ));
    expect(notificationPush?.payload).toMatchObject({
      targetAgentId: 'agent-a',
      guide: {
        summary: expect.any(String),
      },
    });
    expect(
      (notificationPush?.payload as { guide?: { recommendedCommands?: string[]; whyYouReceivedThis?: string } } | undefined)
        ?.guide?.recommendedCommands,
    ).toBeUndefined();
    expect(
      (notificationPush?.payload as { guide?: { recommendedCommands?: string[]; whyYouReceivedThis?: string } } | undefined)
        ?.guide?.whyYouReceivedThis,
    ).toBeUndefined();
  });

  it('lets the owner monitor another owned agent in read-only mode, including frozen agents', async () => {
    await makeFriends(service, actors['agent-a-alt'], actors['agent-b']);
    const thread = await service.openDirectThread(actors['agent-a-alt'], { agentId: 'agent-b' });
    await service.sendThreadMessage(actors['agent-b'], {
      threadId: thread.thread.threadId,
      body: 'Message for the alt agent',
    });
    await service.createMoment(actors['agent-a-alt'], {
      body: 'Alt agent private moment',
    });

    const altAgent = agentStore.get('agent-a-alt');
    expect(altAgent).toBeTruthy();
    if (altAgent) altAgent.frozen = true;

    const readable = await service.resolveReadableOwnedActorForUser('user-a', 'agent-a-alt');
    expect(readable.agentId).toBe('agent-a-alt');

    const inbox = await service.listInbox(readable.agentId);
    expect(inbox.threads[0]?.threadId).toBe(thread.thread.threadId);

    const moments = await service.listMoments(readable.agentId);
    expect(moments.moments[0]?.authorAgentId).toBe('agent-a-alt');

    await expect(service.resolveOwnedActorForUser('user-a', 'agent-a-alt')).rejects.toMatchObject({
      code: 'AGENT_FROZEN',
    });
    await expect(service.resolveReadableOwnedActorForUser('user-b', 'agent-a-alt')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('adds targetAgentId to owner social fanout payloads', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const thread = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });

    ownerMessages.length = 0;
    await service.sendThreadMessage(actors['agent-b'], {
      threadId: thread.thread.threadId,
      body: 'Owner fanout check',
    });

    const ownerInbox = ownerMessages.find((entry) => entry.userId === 'user-a' && entry.type === 'social_inbox_update');
    const ownerMessage = ownerMessages.find((entry) => entry.userId === 'user-a' && entry.type === 'social_message_new');

    expect(ownerInbox).toBeTruthy();
    expect(ownerMessage).toBeTruthy();
    expect(ownerInbox?.payload).toMatchObject({ targetAgentId: 'agent-a' });
    expect(ownerMessage?.payload).toMatchObject({ targetAgentId: 'agent-a' });
  });

  it('applies fresh and upgraded privacy retention defaults without breaking maintenance', async () => {
    const freshStatus = await service.getPrivacyStatus(actors['agent-a']);
    expect(freshStatus.retention).toMatchObject({
      messageRetentionDays: 90,
      momentRetentionDays: 90,
      exportRetentionHours: 24,
    });

    const upgradedMock = createMockContext([
      { agentId: 'agent-legacy', userId: 'legacy-user', agentName: 'Legacy Agent', isOnline: true, isShadow: true },
    ]);
    await upgradedMock.ctx.storage.put('meta', 'last-maintenance', {
      id: 'last-maintenance',
      ranAt: Date.now() - 5_000,
      updatedAt: Date.now() - 5_000,
    });

    const upgradedDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-social-legacy-'));
    const upgradedService = new SocialService({
      ctx: upgradedMock.ctx,
      pluginId: 'uruc.social',
      assetDir: path.join(upgradedDir, 'assets'),
      exportDir: path.join(upgradedDir, 'exports'),
    });
    await upgradedService.start();

    try {
      const upgradedStatus = await upgradedService.getPrivacyStatus({
        agentId: 'agent-legacy',
        userId: 'legacy-user',
        agentName: 'Legacy Agent',
      });
      expect(upgradedStatus.retention.messageRetentionDays).toBe(180);
    } finally {
      await upgradedService.stop();
      await rm(upgradedDir, { recursive: true, force: true });
    }
  });

  it('exports visible social data as JSON and restricts downloads to the owner user', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const thread = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });
    await service.sendThreadMessage(actors['agent-a'], {
      threadId: thread.thread.threadId,
      body: 'Export this private line',
    });
    const upload = await service.createMomentAsset(actors['agent-a'], {
      fileName: 'rose.png',
      contentType: 'image/png',
      data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await service.createMoment(actors['agent-a'], {
      body: 'Export this moment',
      assetIds: [upload.asset.assetId],
    });
    await service.createReport(actors['agent-a'], {
      targetType: 'agent',
      targetId: 'agent-b',
      reasonCode: 'test',
      detail: 'Export should include this report',
    });

    const exportResult = await service.requestDataExport(actors['agent-a']);
    expect(exportResult.request.downloadPath).toContain('/me/exports/');

    const download = await service.readExportDownload('user-a', exportResult.request.requestId);
    const payload = JSON.parse(download.data.toString('utf8')) as {
      subject: { agentId: string };
      threads: Array<{ messages: Array<{ body: string }> }>;
      moments: Array<{ body: string }>;
      reports: Array<{ reportId: string }>;
    };
    expect(payload.subject.agentId).toBe('agent-a');
    expect(payload.threads[0]?.messages.some((message) => message.body === 'Export this private line')).toBe(true);
    expect(payload.moments[0]?.body).toBe('Export this moment');
    expect(payload.reports).toHaveLength(1);

    await expect(service.readExportDownload('user-b', exportResult.request.requestId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('erases a subject data while keeping peer-visible tombstones and transferring group ownership', async () => {
    await makeFriends(service, actors['agent-a'], actors['agent-b']);
    const direct = await service.openDirectThread(actors['agent-a'], { agentId: 'agent-b' });
    await service.sendThreadMessage(actors['agent-a'], {
      threadId: direct.thread.threadId,
      body: 'Erase this from the server body',
    });
    await service.createMoment(actors['agent-a'], {
      body: 'Erase this moment too',
    });
    const group = await service.createGroup(actors['agent-a'], {
      title: 'Erasure Council',
      memberAgentIds: ['agent-b'],
    });
    const messageId = (await service.getThreadHistory('agent-a', { threadId: direct.thread.threadId })).messages[0]?.messageId;

    await service.requestDataErasure(actors['agent-a']);

    const erasedMessage = await (service as any).getRecord('messages', messageId);
    expect(erasedMessage).toMatchObject({
      senderAgentId: 'agent-a',
      body: '',
      deletedReason: 'user_erasure',
    });
    await expect((service as any).toMessage(erasedMessage)).resolves.toMatchObject({
      isDeleted: true,
      deletedReason: 'user_erasure',
      body: '[Content removed]',
    });

    const friendViewMoments = await service.listMoments('agent-b');
    expect(friendViewMoments.moments.some((moment: { authorAgentId: string }) => moment.authorAgentId === 'agent-a')).toBe(false);

    const relationshipsAfter = await service.listRelationships('agent-a');
    expect(relationshipsAfter.friends).toHaveLength(0);

    const groupAfter = await service.getThreadHistory('agent-b', { threadId: group.thread.threadId });
    expect(groupAfter.thread.ownerAgentId).toBe('agent-b');
    expect(groupAfter.members.find((member: SocialThreadMemberSummary) => member.agentId === 'agent-a')?.leftAt).not.toBeNull();
  });
});
