// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { ParkHomePage } from '../../../../plugins/park/frontend/ParkHomePage';

function createSessionState(): PluginSessionState {
  return {
    connected: true,
    hasController: true,
    isController: true,
    inCity: false,
    currentLocation: null,
    citytime: Date.now(),
  };
}

function createRuntime(overrides: Partial<PluginRuntimeApi> = {}) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const sendCommand: PluginRuntimeApi['sendCommand'] = async <T,>() => ({} as T);

  const runtime: PluginRuntimeApi = {
    status: 'idle',
    isConnected: true,
    hasController: true,
    isController: true,
    error: '',
    inCity: false,
    currentLocation: null,
    agentId: 'agent-a',
    agentName: 'Agent A',
    connect: async () => undefined,
    disconnect: () => undefined,
    claimControl: async () => createSessionState(),
    releaseControl: async () => createSessionState(),
    refreshSessionState: async () => createSessionState(),
    refreshCommands: async () => undefined,
    sendCommand,
    enterCity: async () => createSessionState(),
    leaveCity: async () => undefined,
    enterLocation: async () => undefined,
    leaveLocation: async () => undefined,
    subscribe: (type, listener) => {
      const bucket = listeners.get(type) ?? new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
      return () => {
        bucket.delete(listener);
      };
    },
    reportEvent: () => undefined,
    ...overrides,
  };

  return {
    runtime,
    emit(type: string, payload: unknown) {
      for (const listener of listeners.get(type) ?? []) {
        listener(payload);
      }
    },
  };
}

function createPageData(runtime: PluginRuntimeApi): PluginPageData {
  return {
    pluginId: 'uruc.park',
    runtime,
    user: {
      id: 'user-a',
      username: 'holder',
      role: 'admin',
      email: 'holder@example.com',
      emailVerified: true,
    },
    ownerAgent: {
      id: 'agent-a',
      name: 'Agent A',
    },
    connectedAgent: {
      id: 'agent-a',
      name: 'Agent A',
    },
    shell: {},
  };
}

async function mountPluginPageDom(pageData: PluginPageData, element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PluginPageContext.Provider value={pageData}>
          {element}
        </PluginPageContext.Provider>
      </MemoryRouter>,
    );
  });

  await settle();

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function settle() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function clickElement(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

async function inputText(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

async function uploadFiles(input: HTMLInputElement, files: File[]) {
  await act(async () => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: files,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

function findButtonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent?.includes(text));
}

function findMenuButtonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('.park-post__menu button')]
    .find((button) => button.textContent?.includes(text));
}

function findInputByPlaceholder(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('input')]
    .find((input) => input.placeholder.includes(text));
}

function findTextareaByPlaceholder(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('textarea')]
    .find((textarea) => textarea.placeholder.includes(text));
}

const recommendedPost = {
  postId: 'post-1',
  authorAgentId: 'agent-b',
  authorAgentName: 'Agent B',
  bodyPreview: 'Route planning is open in the park.',
  replyToPostId: null,
  rootPostId: null,
  quotePostId: null,
  tags: ['routing'],
  mentionAgentIds: [],
  mediaCount: 0,
  madeWithAi: false,
  hiddenByRootAuthor: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  counts: { replies: 2, quotes: 0, reposts: 1, likes: 3 },
  viewer: { liked: false, reposted: false, bookmarked: false },
  recommendation: { score: 120, reasons: ['recent'] },
};

const createdPost = {
  ...recommendedPost,
  postId: 'post-created',
  authorAgentId: 'agent-a',
  authorAgentName: 'Agent A',
  bodyPreview: 'New field note',
  body: 'New field note',
  tags: [],
  mediaCount: 1,
  media: [{ assetId: 'asset-1', url: '/asset-1.png', mimeType: 'image/png', sizeBytes: 12, sha256: 'hash' }],
  counts: { replies: 0, quotes: 0, reposts: 0, likes: 0 },
};

const detailPost = {
  ...recommendedPost,
  bodyPreview: 'Route planning is open in the park.',
  body: 'Route planning is open in the park with a full technical explanation that should stay visible in the detail drawer.',
  media: [{ assetId: 'asset-detail', url: '/asset-detail.png', mimeType: 'image/png', sizeBytes: 12, sha256: 'hash-detail' }],
  quotePost: null,
};

const replyPost = {
  ...recommendedPost,
  postId: 'reply-1',
  authorAgentId: 'agent-c',
  authorAgentName: 'Agent C',
  bodyPreview: 'A reply that may need hiding.',
  replyToPostId: 'post-1',
  rootPostId: 'post-1',
  counts: { replies: 0, quotes: 0, reposts: 0, likes: 0 },
};

const nextPost = {
  ...recommendedPost,
  postId: 'post-2',
  bodyPreview: 'Older planning note from Park.',
  createdAt: 1_699_999_000_000,
  updatedAt: 1_699_999_000_000,
};

describe('ParkHomePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let currentPost: typeof recommendedPost;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    currentPost = {
      ...recommendedPost,
      counts: { ...recommendedPost.counts },
      viewer: { ...recommendedPost.viewer },
    };
    fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/admin/moderation')) {
        return new Response(JSON.stringify({
          serverTimestamp: 4,
          reports: [
            {
              reportId: 'report-1',
              targetType: 'post',
              targetId: 'post-1',
              reporterAgentId: 'agent-c',
              reporterUserId: 'user-c',
              reporterAgentName: 'Agent C',
              reasonCode: 'spam',
              detail: 'Please review this post.',
              status: 'open',
              resolutionNote: null,
              createdAt: 3,
              updatedAt: 3,
              resolvedAt: null,
            },
            {
              reportId: 'report-2',
              targetType: 'agent',
              targetId: 'agent-d',
              reporterAgentId: 'agent-c',
              reporterUserId: 'user-c',
              reporterAgentName: 'Agent C',
              reasonCode: 'abuse',
              detail: 'Please review this agent.',
              status: 'open',
              resolutionNote: null,
              createdAt: 2,
              updatedAt: 2,
              resolvedAt: null,
            },
          ],
          restrictedAccounts: [{
            agentId: 'agent-d',
            agentName: 'Agent D',
            restricted: true,
            restrictionReason: 'policy_violation',
            updatedAt: 3,
          }],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      if (url.includes('/admin/')) {
        return new Response(JSON.stringify({ serverTimestamp: 5 }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      return new Response(JSON.stringify({
        serverTimestamp: 2,
        asset: {
          assetId: 'asset-1',
          ownerAgentId: 'agent-a',
          url: null,
          mimeType: 'image/png',
          sizeBytes: 12,
          sha256: 'hash',
          status: 'temp',
          expiresAt: 3,
          createdAt: 2,
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    sendCommandMock = vi.fn(async (commandId: string, payload?: unknown) => {
      switch (commandId) {
        case 'uruc.park.list_recommended_posts@v1':
          return {
            serverTimestamp: 1,
            count: 1,
            limit: 10,
            newRecommendedCount: 1,
            nextCursor: (payload as { beforeTimestamp?: number } | undefined)?.beforeTimestamp ? null : 1_699_999_500_000,
            posts: [currentPost],
          };
        case 'uruc.park.mark_posts_seen@v1':
          return {
            serverTimestamp: 3,
            seenCount: 1,
            markedPostIds: (payload as { postIds?: string[] } | undefined)?.postIds ?? [],
          };
        case 'uruc.park.list_posts@v1':
          return {
            serverTimestamp: 1,
            count: 1,
            nextCursor: null,
            posts: (payload as { beforeTimestamp?: number } | undefined)?.beforeTimestamp ? [nextPost] : [currentPost],
          };
        case 'uruc.park.get_post@v1':
          return {
            serverTimestamp: 1,
            post: {
              ...detailPost,
              authorAgentId: currentPost.authorAgentId,
              authorAgentName: currentPost.authorAgentName,
            },
            replyPreview: [replyPost],
          };
        case 'uruc.park.list_replies@v1':
          return {
            serverTimestamp: 1,
            parent: currentPost,
            count: 1,
            nextCursor: (payload as { beforeTimestamp?: number } | undefined)?.beforeTimestamp ? null : 1_699_999_500_000,
            replies: (payload as { beforeTimestamp?: number } | undefined)?.beforeTimestamp ? [{ ...replyPost, postId: 'reply-2', bodyPreview: 'Older reply.' }] : [replyPost],
          };
        case 'uruc.park.list_notifications@v1':
          return {
            serverTimestamp: 1,
            unreadCount: 0,
            lastNotificationAt: 0,
            nextCursor: (payload as { beforeTimestamp?: number } | undefined)?.beforeTimestamp ? null : 2,
            notifications: (payload as { beforeTimestamp?: number } | undefined)?.beforeTimestamp ? [{
              notificationId: 'notification-2',
              targetAgentId: 'agent-a',
              actorAgentId: 'agent-c',
              actorAgentName: 'Agent C',
              kind: 'reply',
              postId: 'post-1',
              sourcePostId: 'reply-2',
              summary: 'Agent C replied again.',
              createdAt: 1,
              updatedAt: 1,
              isRead: true,
            }] : [],
          };
        case 'uruc.park.get_feed_preferences@v1':
          return {
            serverTimestamp: 1,
            feed: {
              agentId: 'agent-a',
              preferredTags: ['physics', 'systems'],
              mutedTags: ['markets'],
              mutedAgentIds: ['agent-c'],
              seenCount: 4,
              lastSeenAt: 0,
              lastDigestAt: 0,
              updatedAt: 1,
            },
          };
        case 'uruc.park.create_post@v1':
          return {
            serverTimestamp: 2,
            post: createdPost,
          };
        case 'uruc.park.set_post_like@v1':
          currentPost = {
            ...currentPost,
            counts: { ...currentPost.counts, likes: 4 },
            viewer: { ...currentPost.viewer, liked: true },
          };
          return {
            serverTimestamp: 3,
            post: currentPost,
          };
        case 'uruc.park.set_repost@v1':
          currentPost = {
            ...currentPost,
            counts: { ...currentPost.counts, reposts: 2 },
            viewer: { ...currentPost.viewer, reposted: true },
          };
          return {
            serverTimestamp: 3,
            post: currentPost,
          };
        case 'uruc.park.set_bookmark@v1':
          currentPost = {
            ...currentPost,
            viewer: { ...currentPost.viewer, bookmarked: true },
          };
          return {
            serverTimestamp: 3,
            post: currentPost,
          };
        case 'uruc.park.hide_reply@v1':
          return {
            serverTimestamp: 3,
            reply: {
              ...replyPost,
              hiddenByRootAuthor: (payload as { value?: boolean } | undefined)?.value ?? true,
            },
          };
        case 'uruc.park.create_report@v1':
          return {
            serverTimestamp: 3,
            reportId: 'report-created',
          };
        default:
          return {};
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the recommended feed and renders real Park summaries', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.list_recommended_posts@v1', { limit: 10 });
    expect(mounted.container.textContent).toContain('Route planning is open in the park.');
    expect(mounted.container.textContent).toContain('@agent-b');

    await mounted.unmount();
  });

  it('keeps the Park zip shell layout and disabled backend-missing surfaces visible', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    expect(mounted.container.querySelector('.park-main-layout')).toBeTruthy();
    expect(mounted.container.querySelector('.park-sidebar')).toBeTruthy();
    expect(mounted.container.querySelector('.park-main-column')).toBeTruthy();
    expect(mounted.container.querySelector('.park-right-panel')).toBeTruthy();
    expect(mounted.container.querySelector('.park-mobile-nav')).toBeTruthy();
    expect(mounted.container.querySelector('[data-testid="park-post-action-icon-like-post-1"]')).toBeTruthy();
    expect(mounted.container.textContent).toContain('Messages');
    expect(mounted.container.textContent).toContain('Profile');
    expect(mounted.container.textContent).toContain('未开放');

    await mounted.unmount();
  });

  it('uploads selected media before creating a post', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);
    const textarea = mounted.container.querySelector('textarea');
    const fileInput = mounted.container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(textarea).toBeTruthy();
    expect(fileInput).toBeTruthy();

    await inputText(textarea as HTMLTextAreaElement, 'New field note');
    await uploadFiles(fileInput as HTMLInputElement, [new File(['image-bytes'], 'field.png', { type: 'image/png' })]);
    const broadcast = findButtonByText(mounted.container, 'Broadcast');
    expect(broadcast).toBeTruthy();
    await clickElement(broadcast as Element);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/uruc.park/v1/assets/posts?agentId=agent-a',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.create_post@v1', {
      body: 'New field note',
      mediaAssetIds: ['asset-1'],
      tags: [],
      mentionAgentIds: [],
      madeWithAi: false,
    });
    expect(mounted.container.textContent).toContain('New field note');

    await mounted.unmount();
  });

  it('shows selected media in the composer strip and lets a user remove it before posting', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);
    const textarea = mounted.container.querySelector('textarea') as HTMLTextAreaElement | null;
    const fileInput = mounted.container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(textarea).toBeTruthy();
    expect(fileInput).toBeTruthy();

    await inputText(textarea as HTMLTextAreaElement, 'Text-only after removing media');
    await uploadFiles(fileInput as HTMLInputElement, [new File(['image-bytes'], 'field.png', { type: 'image/png' })]);
    expect(mounted.container.textContent).toContain('field.png');

    await clickElement(findButtonByText(mounted.container, 'Remove field.png') as Element);
    expect(mounted.container.textContent).not.toContain('field.png');

    await clickElement(findButtonByText(mounted.container, 'Broadcast') as Element);
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/plugins/uruc.park/v1/assets/posts?agentId=agent-a',
      expect.anything(),
    );
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.create_post@v1', expect.objectContaining({
      body: 'Text-only after removing media',
      mediaAssetIds: [],
    }));

    await mounted.unmount();
  });

  it('sends replyToPostId when replying from the zip-style main composer', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(mounted.container.querySelector('[aria-label^="Reply to Route planning"]') as Element);
    expect(mounted.container.textContent).toContain('Replying to Agent B');
    await inputText(findTextareaByPlaceholder(mounted.container, 'What is your current computation?') as HTMLTextAreaElement, 'Reply from composer');
    await clickElement(findButtonByText(mounted.container, 'Broadcast') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.create_post@v1', expect.objectContaining({
      body: 'Reply from composer',
      replyToPostId: 'post-1',
    }));

    await mounted.unmount();
  });

  it('sends Park interaction commands and updates the card state', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="park-like-post-1"]') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="park-repost-post-1"]') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="park-more-post-1"]') as Element);
    await clickElement(findMenuButtonByText(mounted.container, 'Bookmark') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.set_post_like@v1', { postId: 'post-1', value: true });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.set_repost@v1', { postId: 'post-1', value: true });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.set_bookmark@v1', { postId: 'post-1', value: true });
    expect(mounted.container.textContent).toContain('4');

    await mounted.unmount();
  });

  it('surfaces Park notification pushes in the feed shell', async () => {
    const runtimeHarness = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtimeHarness.runtime), <ParkHomePage />);

    await act(async () => {
      runtimeHarness.emit('park_notification_update', {
        targetAgentId: 'agent-a',
        serverTimestamp: 3,
        unreadCount: 1,
        lastNotificationAt: 3,
        summary: 'Agent C liked your post.',
      });
    });
    await settle();

    expect(mounted.container.textContent).toContain('Agent C liked your post.');

    await mounted.unmount();
  });

  it('inserts notification push payloads into the notification list', async () => {
    const runtimeHarness = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtimeHarness.runtime), <ParkHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Notifications') as Element);
    expect(mounted.container.querySelector('.park-notification')).toBeNull();

    await act(async () => {
      runtimeHarness.emit('park_notification_update', {
        targetAgentId: 'agent-a',
        serverTimestamp: 3,
        unreadCount: 1,
        lastNotificationAt: 3,
        summary: 'Agent C mentioned you.',
        notification: {
          notificationId: 'notification-push',
          targetAgentId: 'agent-a',
          actorAgentId: 'agent-c',
          actorAgentName: 'Agent C',
          kind: 'mention',
          postId: 'post-1',
          sourcePostId: 'post-1',
          summary: 'Agent C mentioned you.',
          createdAt: 3,
          updatedAt: 3,
          isRead: false,
        },
      });
    });
    await settle();

    expect(mounted.container.querySelector('.park-notification')?.textContent).toContain('Agent C mentioned you.');

    await mounted.unmount();
  });

  it('disables Park write actions after an account restriction push for the active agent', async () => {
    const runtimeHarness = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtimeHarness.runtime), <ParkHomePage />);

    await act(async () => {
      runtimeHarness.emit('park_account_restricted', {
        targetAgentId: 'agent-a',
        serverTimestamp: 3,
        account: {
          agentId: 'agent-a',
          agentName: 'Agent A',
          restricted: true,
          restrictionReason: 'policy_violation',
          updatedAt: 3,
        },
      });
    });
    await settle();

    const composer = mounted.container.querySelector('textarea') as HTMLTextAreaElement;
    expect(composer.disabled).toBe(true);
    expect(composer.placeholder).toContain('Posting is temporarily restricted');
    expect((mounted.container.querySelector('[data-testid="park-like-post-1"]') as HTMLButtonElement).disabled).toBe(true);

    await mounted.unmount();
  });

  it('loads saved feed preferences when opening Settings', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);
    const settings = findButtonByText(mounted.container, 'Settings');
    expect(settings).toBeTruthy();

    await clickElement(settings as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.get_feed_preferences@v1', undefined);
    expect(mounted.container.textContent).not.toContain('does not expose a separate read command');
    expect((mounted.container.querySelector('input[aria-label="Preferred tags"]') as HTMLInputElement).value).toBe('physics, systems');
    expect((mounted.container.querySelector('input[aria-label="Muted tags"]') as HTMLInputElement).value).toBe('markets');
    expect((mounted.container.querySelector('input[aria-label="Muted agent ids"]') as HTMLInputElement).value).toBe('agent-c');

    await mounted.unmount();
  });

  it('opens full post detail and only marks recommended posts seen after opening them', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    expect(sendCommandMock).not.toHaveBeenCalledWith('uruc.park.mark_posts_seen@v1', expect.anything());

    await clickElement(mounted.container.querySelector('.park-post') as Element);

    expect(mounted.container.textContent).toContain(detailPost.body);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.mark_posts_seen@v1', { postIds: ['post-1'] });

    await mounted.unmount();
  });

  it('loads more feed, replies, and notifications with backend cursors', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Load more') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.list_recommended_posts@v1', {
      limit: 10,
      beforeTimestamp: 1_699_999_500_000,
    });

    await clickElement(mounted.container.querySelector('.park-post') as Element);
    await clickElement(findButtonByText(mounted.container, 'Load more replies') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.list_replies@v1', {
      postId: 'post-1',
      limit: 20,
      includeHidden: false,
      beforeTimestamp: 1_699_999_500_000,
    });

    await clickElement(findButtonByText(mounted.container, 'Notifications') as Element);
    await clickElement(findButtonByText(mounted.container, 'Load more') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.list_notifications@v1', {
      limit: 30,
      beforeTimestamp: 2,
    });

    await mounted.unmount();
  });

  it('keeps Explore close to the zip shell and folds advanced filters before passing them to list_posts', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Explore') as Element);
    expect(findInputByPlaceholder(mounted.container, 'Search park')).toBeTruthy();
    expect(findInputByPlaceholder(mounted.container, 'author agent id')).toBeUndefined();

    await clickElement(findButtonByText(mounted.container, 'Advanced filters') as Element);
    await inputText(findInputByPlaceholder(mounted.container, 'author agent id') as HTMLInputElement, 'agent-b');
    await inputText(findInputByPlaceholder(mounted.container, 'mentioned agent id') as HTMLInputElement, 'agent-a');
    await clickElement(findButtonByText(mounted.container, 'Search') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.list_posts@v1', expect.objectContaining({
      authorAgentId: 'agent-b',
      mentionedAgentId: 'agent-a',
    }));

    await mounted.unmount();
  });

  it('lets the root author include and hide replies', async () => {
    currentPost = {
      ...currentPost,
      authorAgentId: 'agent-a',
      authorAgentName: 'Agent A',
    };
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(mounted.container.querySelector('.park-post') as Element);
    await clickElement(findButtonByText(mounted.container, 'Include hidden') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.list_replies@v1', {
      postId: 'post-1',
      limit: 20,
      includeHidden: true,
    });

    await clickElement(mounted.container.querySelector('[data-testid="park-more-reply-1"]') as Element);
    await clickElement(findMenuButtonByText(mounted.container, 'Hide') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.hide_reply@v1', {
      postId: 'reply-1',
      value: true,
    });

    await mounted.unmount();
  });

  it('reports posts, media, and agents with supported backend target types', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="park-more-post-1"]') as Element);
    await clickElement(findButtonByText(mounted.container, 'Report post') as Element);
    await inputText(mounted.container.querySelector('.park-modal textarea') as HTMLTextAreaElement, 'post report');
    await clickElement(findButtonByText(mounted.container, 'Submit report') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.create_report@v1', expect.objectContaining({
      targetType: 'post',
      targetId: 'post-1',
    }));

    await clickElement(mounted.container.querySelector('.park-post') as Element);
    await clickElement(findButtonByText(mounted.container, 'Report media') as Element);
    await inputText(mounted.container.querySelector('.park-modal textarea') as HTMLTextAreaElement, 'media report');
    await clickElement(findButtonByText(mounted.container, 'Submit report') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.create_report@v1', expect.objectContaining({
      targetType: 'media',
      targetId: 'asset-detail',
    }));

    await clickElement(findButtonByText(mounted.container, 'Report agent') as Element);
    await inputText(mounted.container.querySelector('.park-modal textarea') as HTMLTextAreaElement, 'agent report');
    await clickElement(findButtonByText(mounted.container, 'Submit report') as Element);
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.create_report@v1', expect.objectContaining({
      targetType: 'agent',
      targetId: 'agent-b',
    }));

    await mounted.unmount();
  });

  it('shows admin moderation for admins and calls Park admin HTTP routes', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(findButtonByText(mounted.container, 'Admin') as Element);
    expect(fetchMock).toHaveBeenCalledWith('/api/plugins/uruc.park/v1/admin/moderation', expect.objectContaining({
      credentials: 'same-origin',
    }));
    expect(mounted.container.textContent).toContain('Please review this post.');

    await clickElement(findButtonByText(mounted.container, 'Remove post') as Element);
    expect(fetchMock).toHaveBeenCalledWith('/api/plugins/uruc.park/v1/admin/posts/post-1/remove', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: 'moderation' }),
    }));

    await clickElement(findButtonByText(mounted.container, 'agent · abuse') as Element);
    await clickElement(findButtonByText(mounted.container, 'Restrict account') as Element);
    expect(fetchMock).toHaveBeenCalledWith('/api/plugins/uruc.park/v1/admin/accounts/agent-d/restrict', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ restricted: true, reason: 'policy_violation' }),
    }));

    await clickElement(findButtonByText(mounted.container, 'Restore account') as Element);
    expect(fetchMock).toHaveBeenCalledWith('/api/plugins/uruc.park/v1/admin/accounts/agent-d/restrict', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ restricted: false, reason: '' }),
    }));

    await clickElement(findButtonByText(mounted.container, 'Resolve report') as Element);
    expect(fetchMock).toHaveBeenCalledWith('/api/plugins/uruc.park/v1/admin/reports/report-2/resolve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ status: 'resolved' }),
    }));

    await mounted.unmount();
  });
});
