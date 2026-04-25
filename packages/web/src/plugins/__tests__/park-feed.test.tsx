// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { ParkHomePage } from '../../../../plugins/park/frontend/ParkHomePage';
import { NotificationsPage } from '../../../../plugins/park/frontend/pages/NotificationsPage';
import { SettingsPage } from '../../../../plugins/park/frontend/pages/SettingsPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createSessionState(): PluginSessionState {
  return {
    connected: true,
    hasController: true,
    isController: true,
    inCity: true,
    currentLocation: null,
    citytime: Date.now(),
  };
}

function createRuntime(sendCommand: PluginRuntimeApi['sendCommand']) {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const runtime: PluginRuntimeApi = {
    status: 'connected',
    isConnected: true,
    hasController: true,
    isController: true,
    error: '',
    inCity: true,
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
  };
  return runtime;
}

function createPageData(runtime: PluginRuntimeApi): PluginPageData {
  return {
    pluginId: 'uruc.park',
    runtime,
    user: {
      id: 'user-a',
      username: 'owner',
      role: 'user',
      email: 'owner@example.com',
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
    shell: {
      notify: vi.fn(),
    },
  };
}

async function mount(pageData: PluginPageData, element: ReactElement) {
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
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function click(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

async function inputText(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

function postSummary(overrides: Record<string, unknown> = {}) {
  return {
    postId: 'post-1',
    authorAgentId: 'agent-b',
    authorAgentName: 'Agent B',
    bodyPreview: 'Physics routing update #physics',
    replyToPostId: null,
    rootPostId: null,
    quotePostId: null,
    tags: ['physics'],
    mentionAgentIds: [],
    mediaCount: 0,
    madeWithAi: false,
    hiddenByRootAuthor: false,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    counts: {
      replies: 1,
      quotes: 0,
      reposts: 2,
      likes: 3,
    },
    viewer: {
      liked: false,
      reposted: false,
      bookmarked: false,
    },
    ...overrides,
  };
}

describe('Park frontend source integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('loads recommended posts by default and switches Timeline to list_posts', async () => {
    const sendCommand = vi.fn(async (type: string) => {
      if (type === 'uruc.park.list_recommended_posts@v1') {
        return { posts: [postSummary()], nextCursor: null };
      }
      if (type === 'uruc.park.list_posts@v1') {
        return { posts: [postSummary({ postId: 'post-2', bodyPreview: 'Timeline post' })], nextCursor: null };
      }
      return {};
    }) as PluginRuntimeApi['sendCommand'];
    const page = await mount(createPageData(createRuntime(sendCommand)), <ParkHomePage />);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.list_recommended_posts@v1', expect.objectContaining({ limit: 10 }));
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.mark_posts_seen@v1', { postIds: ['post-1'] });

    await click([...page.container.querySelectorAll('button')].find((button) => button.textContent?.includes('Timeline'))!);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.list_posts@v1', expect.objectContaining({ filter: 'timeline', limit: 20 }));
    await page.unmount();
  });

  it('publishes composer content through create_post with parsed tags and mentions', async () => {
    const sendCommand = vi.fn(async (type: string) => {
      if (type === 'uruc.park.list_recommended_posts@v1') {
        return { posts: [], nextCursor: null };
      }
      if (type === 'uruc.park.create_post@v1') {
        return { post: postSummary({ postId: 'created-post', authorAgentId: 'agent-a', authorAgentName: 'Agent A' }) };
      }
      return {};
    }) as PluginRuntimeApi['sendCommand'];
    const page = await mount(createPageData(createRuntime(sendCommand)), <ParkHomePage />);

    await inputText(page.container.querySelector('textarea')!, 'New routing note #physics @agent-b');
    const broadcast = [...page.container.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Broadcast' && !button.disabled)!;
    await click(broadcast);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.create_post@v1', {
      body: 'New routing note #physics @agent-b',
      tags: ['physics'],
      mentionAgentIds: ['agent-b'],
    });
    await page.unmount();
  });

  it('wires repost and like actions to Park interaction commands', async () => {
    const sendCommand = vi.fn(async (type: string) => {
      if (type === 'uruc.park.list_recommended_posts@v1') {
        return { posts: [postSummary()], nextCursor: null };
      }
      if (type === 'uruc.park.set_repost@v1') {
        return { post: postSummary({ viewer: { liked: false, reposted: true, bookmarked: false } }) };
      }
      if (type === 'uruc.park.set_post_like@v1') {
        return { post: postSummary({ viewer: { liked: true, reposted: true, bookmarked: false } }) };
      }
      return {};
    }) as PluginRuntimeApi['sendCommand'];
    const page = await mount(createPageData(createRuntime(sendCommand)), <ParkHomePage />);

    await click(page.container.querySelector('button[aria-label="Repost post"]')!);
    await click(page.container.querySelector('button[aria-label="Like post"]')!);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.set_repost@v1', { postId: 'post-1', value: true });
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.set_post_like@v1', { postId: 'post-1', value: true });
    await page.unmount();
  });

  it('opens post detail, replies, bookmark, delete, and report actions', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Needs moderation review.');
    const sendCommand = vi.fn(async (type: string) => {
      if (type === 'uruc.park.list_recommended_posts@v1') {
        return {
          posts: [postSummary({ authorAgentId: 'agent-a', authorAgentName: 'Agent A' })],
          nextCursor: null,
        };
      }
      if (type === 'uruc.park.get_post@v1') {
        return {
          post: {
            ...postSummary({ authorAgentId: 'agent-a', authorAgentName: 'Agent A' }),
            body: 'Full post body',
            media: [],
            quotePost: null,
          },
          replyPreview: [],
        };
      }
      if (type === 'uruc.park.list_replies@v1') {
        return { replies: [postSummary({ postId: 'reply-1', bodyPreview: 'Reply body' })], nextCursor: null };
      }
      if (type === 'uruc.park.set_bookmark@v1') {
        return { post: postSummary({ viewer: { liked: false, reposted: false, bookmarked: true } }) };
      }
      if (type === 'uruc.park.delete_post@v1') {
        return { postId: 'post-1' };
      }
      if (type === 'uruc.park.create_report@v1') {
        return { reportId: 'report-1' };
      }
      return {};
    }) as PluginRuntimeApi['sendCommand'];
    const page = await mount(createPageData(createRuntime(sendCommand)), <ParkHomePage />);

    await click(page.container.querySelector('button[aria-label="Open post detail"]')!);
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.get_post@v1', { postId: 'post-1' });
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.list_replies@v1', { postId: 'post-1', limit: 20 });

    await click(page.container.querySelector('button[aria-label="Bookmark post"]')!);
    await click(page.container.querySelector('button[aria-label="Report post"]')!);
    await click(page.container.querySelector('button[aria-label="Delete post"]')!);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.set_bookmark@v1', { postId: 'post-1', value: true });
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.delete_post@v1', { postId: 'post-1' });
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.create_report@v1', {
      targetType: 'post',
      targetId: 'post-1',
      reasonCode: 'user_report',
      detail: 'Needs moderation review.',
    });
    expect(prompt).toHaveBeenCalled();
    await page.unmount();
  });

  it('loads and saves Park feed preferences in settings', async () => {
    const sendCommand = vi.fn(async (type: string) => {
      if (type === 'uruc.park.get_feed_preferences@v1') {
        return {
          feed: {
            preferredTags: ['physics'],
            mutedTags: ['markets'],
            mutedAgentIds: ['agent-c'],
          },
        };
      }
      if (type === 'uruc.park.set_feed_preferences@v1') {
        return { feed: {} };
      }
      return {};
    }) as PluginRuntimeApi['sendCommand'];
    const pageData = createPageData(createRuntime(sendCommand));
    const notify = vi.fn();
    pageData.shell.notify = notify;
    const page = await mount(pageData, <SettingsPage />);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.get_feed_preferences@v1', undefined);
    await inputText(page.container.querySelector('input[aria-label="Preferred tags"]')!, 'physics, systems');
    await click([...page.container.querySelectorAll('button')].find((button) => button.textContent?.includes('Save preferences'))!);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.set_feed_preferences@v1', {
      preferredTags: ['physics', 'systems'],
      mutedTags: ['markets'],
      mutedAgentIds: ['agent-c'],
    });
    expect(notify).toHaveBeenCalledWith({ type: 'success', message: 'Feed preferences saved.' });
    await page.unmount();
  });

  it('loads notifications and marks them read through Park commands', async () => {
    const sendCommand = vi.fn(async (type: string) => {
      if (type === 'uruc.park.list_notifications@v1') {
        return {
          unreadCount: 1,
          notifications: [{
            notificationId: 'notice-1',
            kind: 'mention',
            postId: 'post-1',
            sourceAgentName: 'Agent B',
            summary: 'Agent B mentioned you in a post.',
            createdAt: 1_700_000_000_000,
            isRead: false,
          }],
          nextCursor: null,
        };
      }
      if (type === 'uruc.park.mark_notifications_read@v1') {
        return { unreadCount: 0 };
      }
      return {};
    }) as PluginRuntimeApi['sendCommand'];
    const page = await mount(createPageData(createRuntime(sendCommand)), <NotificationsPage />);

    expect(sendCommand).toHaveBeenCalledWith('uruc.park.list_notifications@v1', expect.objectContaining({ limit: 20 }));
    await click([...page.container.querySelectorAll('button')].find((button) => button.textContent?.includes('Mark all read'))!);
    expect(sendCommand).toHaveBeenCalledWith('uruc.park.mark_notifications_read@v1', {});
    await page.unmount();
  });
});
