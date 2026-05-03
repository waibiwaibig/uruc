// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { SocialHubPage } from '../../../../plugins/social/frontend/SocialHubPage';

const {
  listOwnedAgentsMock,
  uploadMomentAssetMock,
} = vi.hoisted(() => ({
  listOwnedAgentsMock: vi.fn(),
  uploadMomentAssetMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'social:hub.moments.likeCount' || key === 'social:hub.moments.commentCount') {
        return String(params?.count ?? 0);
      }
      if (!params) return key;
      return Object.entries(params).reduce(
        (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
        key,
      );
    },
  }),
}));

vi.mock('i18next', () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
        key,
      );
    },
  },
  t: (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return Object.entries(params).reduce(
      (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
      key,
    );
  },
}));

vi.mock('../../../../plugins/social/frontend/api', () => ({
  SocialApi: {
    listOwnedAgents: (...args: unknown[]) => listOwnedAgentsMock(...args),
    privacyStatus: vi.fn(),
    requestDataExport: vi.fn(),
    requestDataErasure: vi.fn(),
    uploadMomentAsset: (...args: unknown[]) => uploadMomentAssetMock(...args),
  },
  SocialAdminApi: {},
}));

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
    acquireActionLease: async () => createSessionState(),
    releaseActionLease: async () => createSessionState(),
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

function createPageData(overrides: Partial<PluginPageData> = {}): PluginPageData {
  return {
    pluginId: 'uruc.social',
    runtime: createRuntime().runtime,
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
    shell: {
      notify: vi.fn(),
    },
    ...overrides,
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
  for (let index = 0; index < 4; index += 1) {
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

async function openMomentsTab(container: HTMLElement) {
  const momentsTab = findButtonByText(container, 'social:hub.tabs.moments');
  expect(momentsTab).toBeTruthy();
  await clickElement(momentsTab as Element);
}

describe('SocialHubPage moments', () => {
  let sendCommandMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();

    listOwnedAgentsMock.mockResolvedValue({
      serverTimestamp: 1,
      agents: [
        {
          agentId: 'agent-a',
          agentName: 'Agent A',
          avatarPath: null,
          isShadow: true,
          frozen: false,
          restricted: false,
        },
      ],
    });

    uploadMomentAssetMock.mockResolvedValue({
      asset: {
        assetId: 'asset-1',
        url: '/social-assets/asset-1.png',
        mimeType: 'image/png',
        sizeBytes: 12,
        createdAt: 4,
      },
    });

    sendCommandMock = vi.fn(async (commandId: string, payload?: unknown) => {
      switch (commandId) {
        case 'uruc.social.list_relationships@v1':
          return {
            serverTimestamp: 1,
            friends: [
              { agentId: 'agent-b', agentName: 'Agent B', description: 'Beta', avatarPath: null, isOnline: true },
            ],
            incomingRequests: [],
            outgoingRequests: [],
            blocks: [],
          };
        case 'uruc.social.list_inbox@v1':
          return {
            serverTimestamp: 1,
            unreadTotal: 0,
            threads: [],
          };
        case 'uruc.social.list_moments@v1':
          return {
            serverTimestamp: 1,
            moments: [
              {
                momentId: 'moment-own',
                authorAgentId: 'agent-a',
                authorAgentName: 'Agent A',
                body: 'A quiet note for familiar eyes.',
                visibility: 'friends',
                images: [],
                createdAt: 2,
                likeCount: 0,
                viewerHasLiked: false,
                likePreviewAgents: [],
                commentCount: 0,
                commentPreview: [],
                hasMoreComments: false,
              },
              {
                momentId: 'moment-1',
                authorAgentId: 'agent-b',
                authorAgentName: 'Agent B',
                body: 'Lanterns on the river tonight.',
                visibility: 'friends',
                images: [],
                createdAt: 1,
                likeCount: 1,
                viewerHasLiked: false,
                likePreviewAgents: [],
                commentCount: 1,
                commentPreview: [],
                hasMoreComments: false,
              },
            ],
          };
        case 'uruc.social.create_moment@v1':
          return {
            serverTimestamp: 4,
            moment: {
              momentId: 'moment-new',
              authorAgentId: 'agent-a',
              authorAgentName: 'Agent A',
              body: (payload as { body: string }).body,
              visibility: 'friends',
              images: [{
                assetId: 'asset-1',
                url: '/social-assets/asset-1.png',
                mimeType: 'image/png',
                sizeBytes: 12,
                createdAt: 4,
              }],
              createdAt: 4,
              likeCount: 0,
              viewerHasLiked: false,
              likePreviewAgents: [],
              commentCount: 0,
              commentPreview: [],
              hasMoreComments: false,
            },
          };
        case 'uruc.social.set_moment_like@v1':
          return {
            serverTimestamp: 2,
            moment: {
              momentId: 'moment-1',
              authorAgentId: 'agent-b',
              authorAgentName: 'Agent B',
              body: 'Lanterns on the river tonight.',
              visibility: 'friends',
              images: [],
              createdAt: 1,
              likeCount: (payload as { value?: boolean } | undefined)?.value === false ? 0 : 2,
              viewerHasLiked: (payload as { value?: boolean } | undefined)?.value !== false,
              likePreviewAgents: [{ agentId: 'agent-a', agentName: 'Agent A' }],
              commentCount: 1,
              commentPreview: [],
              hasMoreComments: false,
            },
          };
        case 'uruc.social.list_moment_comments@v1':
          return {
            serverTimestamp: 3,
            moment: {
              momentId: 'moment-1',
              authorAgentId: 'agent-b',
              authorAgentName: 'Agent B',
              body: 'Lanterns on the river tonight.',
              visibility: 'friends',
              images: [],
              createdAt: 1,
              likeCount: 1,
              viewerHasLiked: false,
              likePreviewAgents: [],
              commentCount: 1,
              commentPreview: [],
              hasMoreComments: false,
            },
            comments: [
              {
                commentId: 'comment-1',
                momentId: 'moment-1',
                authorAgentId: 'agent-b',
                authorAgentName: 'Agent B',
                body: 'First note',
                parentCommentId: null,
                replyToCommentId: null,
                replyTo: null,
                createdAt: 3,
                isDeleted: false,
                deletedAt: null,
                deletedReason: null,
              },
            ],
            nextCursor: null,
          };
        case 'uruc.social.create_moment_comment@v1':
          return {
            serverTimestamp: 4,
            moment: {
              momentId: 'moment-1',
              authorAgentId: 'agent-b',
              authorAgentName: 'Agent B',
              body: 'Lanterns on the river tonight.',
              visibility: 'friends',
              images: [],
              createdAt: 1,
              likeCount: 1,
              viewerHasLiked: false,
              likePreviewAgents: [],
              commentCount: 2,
              commentPreview: [],
              hasMoreComments: false,
            },
            comment: {
              commentId: 'comment-2',
              momentId: 'moment-1',
              authorAgentId: 'agent-a',
              authorAgentName: 'Agent A',
              body: (payload as { body: string }).body,
              parentCommentId: null,
              replyToCommentId: (payload as { replyToCommentId: string | null }).replyToCommentId,
              replyTo: {
                agentId: 'agent-b',
                agentName: 'Agent B',
              },
              createdAt: 4,
              isDeleted: false,
              deletedAt: null,
              deletedReason: null,
            },
          };
        case 'uruc.social.delete_moment_comment@v1':
          return {
            serverTimestamp: 5,
            moment: {
              momentId: 'moment-1',
              authorAgentId: 'agent-b',
              authorAgentName: 'Agent B',
              body: 'Lanterns on the river tonight.',
              visibility: 'friends',
              images: [],
              createdAt: 1,
              likeCount: 1,
              viewerHasLiked: false,
              likePreviewAgents: [],
              commentCount: 1,
              commentPreview: [],
              hasMoreComments: false,
            },
            comment: {
              commentId: (payload as { commentId: string }).commentId,
              momentId: 'moment-1',
              authorAgentId: 'agent-a',
              authorAgentName: 'Agent A',
              body: '[deleted]',
              parentCommentId: null,
              replyToCommentId: 'comment-1',
              replyTo: {
                agentId: 'agent-b',
                agentName: 'Agent B',
              },
              createdAt: 4,
              isDeleted: true,
              deletedAt: 5,
              deletedReason: 'user_request',
            },
          };
        case 'uruc.social.list_moment_notifications@v1':
          return {
            serverTimestamp: 5,
            unreadCount: 3,
            lastNotificationAt: 5,
            notifications: [
              {
                notificationId: 'notif-1',
                kind: 'moment_comment',
                actorAgentId: 'agent-b',
                actorAgentName: 'Agent B',
                momentId: 'moment-1',
                commentId: 'comment-1',
                summary: 'Agent B commented on your moment.',
                createdAt: 5,
                isRead: false,
              },
            ],
          };
        case 'uruc.social.mark_moment_notifications_read@v1':
          return {
            serverTimestamp: 6,
            unreadCount: 0,
            lastNotificationAt: 5,
            notifications: [
              {
                notificationId: 'notif-1',
                kind: 'moment_comment',
                actorAgentId: 'agent-b',
                actorAgentName: 'Agent B',
                momentId: 'moment-1',
                commentId: 'comment-1',
                summary: 'Agent B commented on your moment.',
                createdAt: 5,
                isRead: true,
              },
            ],
          };
        default:
          throw new Error(`Unexpected command: ${commandId}`);
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('opens the inline composer, uploads assets, and publishes a new moment', async () => {
    const runtimeHandle = createRuntime({
      sendCommand: sendCommandMock,
    });
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: runtimeHandle.runtime,
      }),
      <SocialHubPage />,
    );

    try {
      await openMomentsTab(mounted.container);

      const openComposer = mounted.container.querySelector('[aria-label="social:hub.moments.openComposer"]');
      expect(openComposer).toBeTruthy();
      await clickElement(openComposer as Element);

      const composer = mounted.container.querySelector('textarea');
      expect(composer).toBeTruthy();
      await inputText(composer as HTMLTextAreaElement, 'Fresh dispatch');

      const uploadInput = mounted.container.querySelector('input[type="file"]');
      expect(uploadInput).toBeTruthy();
      await uploadFiles(uploadInput as HTMLInputElement, [
        new File(['image'], 'photo.png', { type: 'image/png' }),
      ]);

      expect(uploadMomentAssetMock).toHaveBeenCalledWith('agent-a', expect.any(File));

      const publishButton = findButtonByText(mounted.container, 'social:hub.actions.publishMoment');
      expect(publishButton).toBeTruthy();
      await clickElement(publishButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.create_moment@v1',
        expect.objectContaining({
          body: 'Fresh dispatch',
          assetIds: ['asset-1'],
        }),
      );
      expect(mounted.container.textContent).toContain('Fresh dispatch');
    } finally {
      await mounted.unmount();
    }
  });

  it('opens the notifications panel and marks moment notifications read', async () => {
    const runtimeHandle = createRuntime({
      sendCommand: sendCommandMock,
    });
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: runtimeHandle.runtime,
      }),
      <SocialHubPage />,
    );

    try {
      await openMomentsTab(mounted.container);

      const notificationsButton = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.moments.notificationsTitle'));
      expect(notificationsButton).toBeTruthy();
      await clickElement(notificationsButton as Element);

      expect(mounted.container.textContent).toContain('Agent B commented on your moment.');

      const markReadButton = findButtonByText(mounted.container, 'social:hub.moments.markNotificationsRead');
      expect(markReadButton).toBeTruthy();
      await clickElement(markReadButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.mark_moment_notifications_read@v1',
        expect.objectContaining({
          beforeTimestamp: 5,
        }),
      );
    } finally {
      await mounted.unmount();
    }
  });

  it('updates like state and keeps reply/comment actions working on expanded comments', async () => {
    const runtimeHandle = createRuntime({
      sendCommand: sendCommandMock,
    });
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: runtimeHandle.runtime,
      }),
      <SocialHubPage />,
    );

    try {
      await openMomentsTab(mounted.container);

      const momentCard = [...mounted.container.querySelectorAll('article')]
        .find((card) => card.textContent?.includes('Lanterns on the river tonight.'));
      expect(momentCard).toBeTruthy();

      const likeButton = momentCard?.querySelector('[aria-label="social:hub.moments.like"]');
      expect(likeButton).toBeTruthy();
      await clickElement(likeButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.set_moment_like@v1',
        expect.objectContaining({
          momentId: 'moment-1',
          value: true,
        }),
      );
      expect(momentCard?.querySelector('[aria-label="social:hub.moments.unlike"]')).toBeTruthy();
      expect(momentCard?.textContent).toContain('2');

      const commentToggle = momentCard?.querySelector('[aria-label="social:hub.moments.comment"]');
      expect(commentToggle).toBeTruthy();
      await clickElement(commentToggle as Element);

      expect(momentCard?.textContent).toContain('First note');

      const replyButton = [...momentCard?.querySelectorAll('button') ?? []].find((btn) => btn.textContent?.includes('social:hub.moments.reply'));
      expect(replyButton).toBeTruthy();
      await clickElement(replyButton as Element);

      expect(momentCard?.textContent).toContain('social:hub.moments.replyingTo');
      expect(momentCard?.textContent).toContain('Agent B');

      const commentInput = momentCard?.querySelector('input[placeholder="social:hub.moments.commentPlaceholder"]');
      expect(commentInput).toBeTruthy();
      await inputText(commentInput as HTMLInputElement, 'Count me in');

      const submitCommentButton = momentCard?.querySelector('.social-composer__actions button');
      expect(submitCommentButton).toBeTruthy();
      await clickElement(submitCommentButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.create_moment_comment@v1',
        expect.objectContaining({
          momentId: 'moment-1',
          body: 'Count me in',
          replyToCommentId: 'comment-1',
        }),
      );

      const deleteButton = [...momentCard?.querySelectorAll('button') ?? []].find((btn) => btn.textContent?.includes('social:hub.moments.deleteComment'));
      expect(deleteButton).toBeTruthy();
      await clickElement(deleteButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.delete_moment_comment@v1',
        expect.objectContaining({
          commentId: 'comment-2',
        }),
      );
    } finally {
      await mounted.unmount();
    }
  });
});
