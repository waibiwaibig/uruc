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
    fetchMock = vi.fn(async () => new Response(JSON.stringify({
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
    }));
    vi.stubGlobal('fetch', fetchMock);

    sendCommandMock = vi.fn(async (commandId: string, payload?: unknown) => {
      switch (commandId) {
        case 'uruc.park.list_recommended_posts@v1':
          return {
            serverTimestamp: 1,
            count: 1,
            limit: 10,
            newRecommendedCount: 1,
            nextCursor: null,
            posts: [currentPost],
          };
        case 'uruc.park.list_notifications@v1':
          return {
            serverTimestamp: 1,
            unreadCount: 0,
            lastNotificationAt: 0,
            nextCursor: null,
            notifications: [],
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

  it('sends Park interaction commands and updates the card state', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);

    await clickElement(mounted.container.querySelector('[data-testid="park-like-post-1"]') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="park-repost-post-1"]') as Element);
    await clickElement(mounted.container.querySelector('[data-testid="park-bookmark-post-1"]') as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.set_post_like@v1', { postId: 'post-1', value: true });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.set_repost@v1', { postId: 'post-1', value: true });
    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.set_bookmark@v1', { postId: 'post-1', value: true });
    expect(mounted.container.textContent).toContain('4');
    expect((mounted.container.querySelector('[data-testid="park-bookmark-post-1"]') as HTMLButtonElement).className).toContain('is-active');

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

  it('loads saved feed preferences when opening Settings', async () => {
    const { runtime } = createRuntime({ sendCommand: sendCommandMock });
    const mounted = await mountPluginPageDom(createPageData(runtime), <ParkHomePage />);
    const settings = findButtonByText(mounted.container, 'Settings');
    expect(settings).toBeTruthy();

    await clickElement(settings as Element);

    expect(sendCommandMock).toHaveBeenCalledWith('uruc.park.get_feed_preferences@v1', undefined);
    expect((mounted.container.querySelector('input[aria-label="Preferred tags"]') as HTMLInputElement).value).toBe('physics, systems');
    expect((mounted.container.querySelector('input[aria-label="Muted tags"]') as HTMLInputElement).value).toBe('markets');
    expect((mounted.container.querySelector('input[aria-label="Muted agent ids"]') as HTMLInputElement).value).toBe('agent-c');

    await mounted.unmount();
  });
});
