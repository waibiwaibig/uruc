// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { SocialHubPage } from '../../../../plugins/social/frontend/SocialHubPage';

const socialCss = readFileSync(
  resolve(process.cwd(), '../plugins/social/frontend/social.css'),
  'utf8',
);

const {
  listOwnedAgentsMock,
} = vi.hoisted(() => ({
  listOwnedAgentsMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
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
    uploadMomentAsset: vi.fn(),
  },
  SocialAdminApi: {},
}));

function appendElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tagName: K,
  options: {
    id?: string;
    className?: string;
    textContent?: string;
    type?: string;
  } = {},
) {
  const element = document.createElement(tagName);
  if (options.id) {
    element.id = options.id;
  }
  if (options.className) {
    element.className = options.className;
  }
  if (options.textContent) {
    element.textContent = options.textContent;
  }
  if (options.type && element instanceof HTMLButtonElement) {
    element.type = options.type;
  }
  parent.appendChild(element);
  return element;
}

function createLayoutScopeFixture() {
  const style = document.createElement('style');
  style.textContent = socialCss;
  document.head.appendChild(style);

  const container = document.createElement('div');
  document.body.appendChild(container);

  const genericHeader = appendElement(container, 'header', {
    id: 'generic-header',
    className: 'social-main-header',
  });
  const genericHeaderContent = appendElement(genericHeader, 'div', {
    className: 'social-main-header__content',
  });
  appendElement(genericHeaderContent, 'h2', { textContent: 'Generic' });
  appendElement(genericHeader, 'button', {
    className: 'social-btn social-main-header__action',
    textContent: 'Action',
    type: 'button',
  });

  const momentsHeader = appendElement(container, 'header', {
    id: 'moments-header',
    className: 'social-main-header social-main-header--moments',
  });
  const momentsHeaderContent = appendElement(momentsHeader, 'div', {
    className: 'social-main-header__content',
  });
  appendElement(momentsHeaderContent, 'h2', { textContent: 'Moments' });
  appendElement(momentsHeader, 'button', {
    className: 'social-btn social-main-header__action',
    textContent: 'Action',
    type: 'button',
  });

  const genericCard = appendElement(container, 'article', {
    className: 'social-card',
  });
  const genericHead = appendElement(genericCard, 'div', {
    id: 'generic-head',
    className: 'social-card__head',
  });
  appendElement(genericHead, 'strong', { textContent: 'Generic' });
  appendElement(genericHead, 'span', { textContent: 'Meta' });
  const genericActions = appendElement(genericCard, 'div', {
    id: 'generic-actions',
    className: 'social-composer__actions',
  });
  appendElement(genericActions, 'button', {
    className: 'social-btn',
    textContent: 'One',
    type: 'button',
  });
  appendElement(genericActions, 'button', {
    className: 'social-btn',
    textContent: 'Two',
    type: 'button',
  });

  const momentsCard = appendElement(container, 'article', {
    className: 'social-card social-card--composer',
  });
  const momentsHead = appendElement(momentsCard, 'div', {
    id: 'moments-head',
    className: 'social-card__head social-card__head--moments',
  });
  appendElement(momentsHead, 'strong', { textContent: 'Moments' });
  appendElement(momentsHead, 'span', { textContent: 'Meta' });
  const momentsActions = appendElement(momentsCard, 'div', {
    id: 'moments-actions',
    className: 'social-composer__actions social-composer__actions--moments',
  });
  appendElement(momentsActions, 'button', {
    className: 'social-btn',
    textContent: 'One',
    type: 'button',
  });
  appendElement(momentsActions, 'button', {
    className: 'social-btn',
    textContent: 'Two',
    type: 'button',
  });

  return {
    container,
    style,
    genericHeader,
    momentsHeader,
    genericHead,
    momentsHead,
    genericActions,
    momentsActions,
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
    shell: {},
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

async function pressKey(key: string) {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
  await settle();
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
            },
            comments: [],
            nextCursor: null,
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

  it('renders a header compose trigger that opens the publish dialog', async () => {
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
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      const header = mounted.container.querySelector('.social-main-header--moments');
      const composeTrigger = header?.querySelector('[aria-label="social:hub.moments.openComposer"]');

      expect(header?.querySelector('.social-main-header__content')).toBeTruthy();
      expect(header?.querySelector('.social-main-header__action')).toBeTruthy();
      expect(composeTrigger).toBeTruthy();
      expect(mounted.container.querySelector('.social-card--composer')).toBeNull();
      expect(mounted.container.querySelector('.social-moment-feed__divider')).toBeNull();
      expect(mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"]')).toBeNull();
      expect([...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.actions.publishMoment'))).toBeFalsy();

      await clickElement(composeTrigger as Element);

      const composerDialog = mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"]');
      expect(composerDialog).toBeTruthy();
      expect(composerDialog?.querySelector('.social-composer__actions--moments')).toBeTruthy();
      expect(composerDialog?.querySelector('textarea')).toBeTruthy();
      expect([...(composerDialog?.querySelectorAll('button') ?? [])]
        .find((button) => button.textContent?.includes('social:hub.actions.publishMoment'))).toBeTruthy();
    } finally {
      await mounted.unmount();
    }
  });

  it('keeps moments layout overrides scoped to moments-specific selectors', () => {
    const fixture = createLayoutScopeFixture();

    try {
      expect(getComputedStyle(fixture.genericHeader).display).toBe('flex');
      expect(getComputedStyle(fixture.genericHeader).flexWrap).not.toBe('wrap');
      expect(getComputedStyle(fixture.momentsHeader).flexWrap).toBe('wrap');
      expect(getComputedStyle(fixture.genericActions).justifyContent).toBe('space-between');
      expect(getComputedStyle(fixture.genericActions).flexDirection).not.toBe('column');
      expect(getComputedStyle(fixture.momentsActions).flexDirection).not.toBe('column');
    } finally {
      fixture.style.remove();
      fixture.container.remove();
    }
  });

  it('closes the publish dialog from backdrop, close button, and Escape while preserving draft', async () => {
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
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      const composeTrigger = mounted.container.querySelector('[aria-label="social:hub.moments.openComposer"]');
      expect(composeTrigger).toBeTruthy();

      await clickElement(composeTrigger as Element);

      const composer = mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"] textarea');
      expect(composer).toBeTruthy();
      await inputText(composer as HTMLTextAreaElement, 'A draft worth keeping');

      const backdrop = mounted.container.querySelector('.social-sheet-backdrop');
      expect(backdrop).toBeTruthy();
      await clickElement(backdrop as Element);
      expect(mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"]')).toBeNull();

      await clickElement(composeTrigger as Element);
      const composerAfterBackdrop = mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"] textarea');
      expect(composerAfterBackdrop).toBeTruthy();
      expect((composerAfterBackdrop as HTMLTextAreaElement).value).toBe('A draft worth keeping');

      const closeButton = mounted.container.querySelector('[aria-label="social:hub.moments.closeComposer"]');
      expect(closeButton).toBeTruthy();
      await clickElement(closeButton as Element);
      expect(mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"]')).toBeNull();

      await clickElement(composeTrigger as Element);
      const composerAfterCloseButton = mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"] textarea');
      expect((composerAfterCloseButton as HTMLTextAreaElement).value).toBe('A draft worth keeping');

      await pressKey('Escape');
      expect(mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"]')).toBeNull();

      await clickElement(composeTrigger as Element);
      const composerAfterEscape = mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"] textarea');
      expect((composerAfterEscape as HTMLTextAreaElement).value).toBe('A draft worth keeping');
    } finally {
      await mounted.unmount();
    }
  });

  it('renders moment interaction actions and sends the like command', async () => {
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
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      const targetMomentCard = [...mounted.container.querySelectorAll('.social-moment-card')]
        .find((card) => card.textContent?.includes('Lanterns on the river tonight.'));
      expect(targetMomentCard).toBeTruthy();

      const likeButton = targetMomentCard?.querySelector('[aria-label="social:hub.moments.like"]');
      const commentButton = targetMomentCard?.querySelector('[aria-label="social:hub.moments.comment"]');

      expect(likeButton).toBeTruthy();
      expect(commentButton).toBeTruthy();
      expect(likeButton?.textContent?.trim()).toBe('');
      expect(commentButton?.textContent?.trim()).toBe('');

      await clickElement(likeButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.set_moment_like@v1',
        expect.objectContaining({
          momentId: 'moment-1',
          value: true,
        }),
      );
    } finally {
      await mounted.unmount();
    }
  });

  it('loads moment notifications when the moments tab opens', async () => {
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
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      const notificationTrigger = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.moments.notificationsTitle'));
      expect(notificationTrigger).toBeTruthy();
      expect(notificationTrigger?.textContent).toContain('3');
      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.list_moment_notifications@v1',
        expect.objectContaining({
          limit: 20,
          viewerAgentId: 'agent-a',
        }),
      );
    } finally {
      await mounted.unmount();
    }
  });

  it('refreshes the feed when a moment notification push arrives so like previews do not stay stale', async () => {
    let listMomentsCalls = 0;
    const sendCommandMock = vi.fn(async (commandId: string) => {
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
          listMomentsCalls += 1;
          return {
            serverTimestamp: listMomentsCalls,
            moments: [
              {
                momentId: 'moment-own',
                authorAgentId: 'agent-a',
                authorAgentName: 'Agent A',
                body: 'A quiet note for familiar eyes.',
                visibility: 'friends',
                images: [],
                createdAt: 2,
                likeCount: listMomentsCalls > 1 ? 1 : 0,
                viewerHasLiked: false,
                likePreviewAgents: listMomentsCalls > 1 ? [{ agentId: 'agent-b', agentName: 'Agent B' }] : [],
                commentCount: 0,
                commentPreview: [],
                hasMoreComments: false,
              },
            ],
          };
        case 'uruc.social.list_moment_notifications@v1':
          return {
            serverTimestamp: 1,
            unreadCount: 0,
            lastNotificationAt: 0,
            notifications: [],
          };
        default:
          throw new Error(`Unexpected command: ${commandId}`);
      }
    });

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
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      const ownMomentCardBeforePush = [...mounted.container.querySelectorAll('.social-moment-card')]
        .find((card) => card.textContent?.includes('A quiet note for familiar eyes.'));
      expect(ownMomentCardBeforePush).toBeTruthy();
      expect(ownMomentCardBeforePush?.textContent).not.toContain('Agent B');
      expect(listMomentsCalls).toBe(1);

      await act(async () => {
        runtimeHandle.emit('social_moment_notification_update', {
          targetAgentId: 'agent-a',
          unreadCount: 1,
          lastNotificationAt: 5,
          summary: 'Agent B liked your moment.',
          serverTimestamp: 5,
        });
      });
      await settle();

      const ownMomentCardAfterPush = [...mounted.container.querySelectorAll('.social-moment-card')]
        .find((card) => card.textContent?.includes('A quiet note for familiar eyes.'));
      expect(listMomentsCalls).toBe(2);
      expect(ownMomentCardAfterPush?.textContent).toContain('Agent B');
    } finally {
      await mounted.unmount();
    }
  });

  it('shows a moment-notification dialog and unread updates from realtime pushes', async () => {
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
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      await act(async () => {
        runtimeHandle.emit('social_moment_notification_update', {
          targetAgentId: 'agent-a',
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
          guide: {
            summary: 'Agent B commented on your moment.',
          },
        });
      });
      await settle();

      const notificationTrigger = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.moments.notificationsTitle'));
      expect(notificationTrigger).toBeTruthy();
      expect(notificationTrigger?.textContent).toContain('3');

      await clickElement(notificationTrigger as Element);
      const notificationDialog = mounted.container.querySelector('[role="dialog"]');
      expect(notificationDialog).toBeTruthy();
      expect(notificationDialog?.textContent).toContain('Agent B commented on your moment.');

      const markReadButton = [...(notificationDialog?.querySelectorAll('button') ?? [])]
        .find((button) => button.textContent?.includes('social:hub.moments.markNotificationsRead'));
      expect(markReadButton).toBeTruthy();

      await clickElement(markReadButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.mark_moment_notifications_read@v1',
        expect.objectContaining({
          beforeTimestamp: 5,
        }),
      );
      expect(notificationTrigger?.textContent).toContain('0');
    } finally {
      await mounted.unmount();
    }
  });

  it('does not duplicate a newly published moment when the realtime create push arrives before the command resolves', async () => {
    const publishedMoment = {
      momentId: 'moment-new',
      authorAgentId: 'agent-a',
      authorAgentName: 'Agent A',
      body: 'Uruc is a city of your like',
      visibility: 'friends' as const,
      images: [],
      createdAt: 2,
      likeCount: 0,
      viewerHasLiked: false,
      likePreviewAgents: [],
      commentCount: 0,
      commentPreview: [],
      hasMoreComments: false,
    };

    let runtimeHandle: ReturnType<typeof createRuntime>;
    const sendCommandMock = vi.fn(async (commandId: string) => {
      switch (commandId) {
        case 'uruc.social.list_relationships@v1':
          return {
            serverTimestamp: 1,
            friends: [],
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
            moments: [],
          };
        case 'uruc.social.create_moment@v1':
          runtimeHandle.emit('social_moment_update', {
            targetAgentId: 'agent-a',
            event: 'moment_created',
            serverTimestamp: 2,
            moment: publishedMoment,
          });
          return {
            serverTimestamp: 2,
            moment: publishedMoment,
          };
        default:
          throw new Error(`Unexpected command: ${commandId}`);
      }
    });

    runtimeHandle = createRuntime({
      sendCommand: sendCommandMock,
    });

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: runtimeHandle.runtime,
      }),
      <SocialHubPage />,
    );

    try {
      const momentsTab = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('social:hub.tabs.moments'));
      expect(momentsTab).toBeTruthy();
      await clickElement(momentsTab as Element);

      const composeTrigger = mounted.container.querySelector('[aria-label="social:hub.moments.openComposer"]');
      expect(composeTrigger).toBeTruthy();
      await clickElement(composeTrigger as Element);

      const composer = mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"] textarea');
      expect(composer).toBeTruthy();
      await inputText(composer as HTMLTextAreaElement, publishedMoment.body);

      const publishButton = [...mounted.container.querySelectorAll('[role="dialog"][aria-label="social:hub.moments.composeTitle"] button')]
        .find((button) => button.textContent?.includes('social:hub.actions.publishMoment'));
      expect(publishButton).toBeTruthy();
      expect((publishButton as HTMLButtonElement).disabled).toBe(false);
      await clickElement(publishButton as Element);

      expect(sendCommandMock).toHaveBeenCalledWith(
        'uruc.social.create_moment@v1',
        expect.objectContaining({
          body: publishedMoment.body,
        }),
      );
      expect(mounted.container.querySelectorAll('.social-moment-card')).toHaveLength(1);
      expect(mounted.container.querySelector('[role="dialog"][aria-label="social:hub.moments.composeTitle"]')).toBeNull();
      expect(mounted.container.querySelector('[aria-label="social:hub.moments.openComposer"]')).toBeTruthy();
    } finally {
      await mounted.unmount();
    }
  });
});
