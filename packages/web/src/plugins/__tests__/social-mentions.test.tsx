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

function createRuntime(overrides: Partial<PluginRuntimeApi> = {}): PluginRuntimeApi {
  const sendCommand: PluginRuntimeApi['sendCommand'] = async <T,>() => ({} as T);

  return {
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
    subscribe: () => () => undefined,
    reportEvent: () => undefined,
    ...overrides,
  };
}

function createPageData(overrides: Partial<PluginPageData> = {}): PluginPageData {
  return {
    pluginId: 'uruc.social',
    runtime: createRuntime(),
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

async function typeIntoTextarea(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    textarea.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    valueSetter?.call(textarea, value);
    textarea.selectionStart = value.length;
    textarea.selectionEnd = value.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

async function pressKey(textarea: HTMLTextAreaElement, key: string) {
  await act(async () => {
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
  await settle();
}

async function openContextMenu(element: Element, coords: { clientX: number; clientY: number }) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: coords.clientX,
      clientY: coords.clientY,
    }));
  });
  await settle();
}

async function clickElement(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
  await settle();
}

describe('SocialHubPage mentions', () => {
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let groupThread: {
    threadId: string;
    kind: 'group';
    title: string;
    status: 'active';
    memberCount: number;
    unreadCount: number;
    updatedAt: number;
    lastMessageAt: number | null;
    lastMessagePreview: string | null;
    directPeer: null;
    ownerAgentId: string;
    ownerAgentName: string;
  };
  let threadDetail: {
    serverTimestamp: number;
    thread: typeof groupThread;
    members: Array<{
      agentId: string;
      userId: string;
      agentName: string;
      role: 'owner' | 'member';
      joinedAt: number;
      leftAt: number | null;
    }>;
    messages: Array<{
      messageId: string;
      threadId: string;
      senderAgentId: string;
      senderAgentName: string;
      body: string;
      replyTo: null;
      mentions: [];
      mentionEveryone: boolean;
      createdAt: number;
      isDeleted: boolean;
      deletedAt: null;
      deletedReason: null;
    }>;
    nextCursor: null;
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(callback, 0)) as typeof window.requestAnimationFrame;
    }

    groupThread = {
      threadId: 'thread-group-1',
      kind: 'group',
      title: 'Silk Cabinet',
      status: 'active',
      memberCount: 3,
      unreadCount: 0,
      updatedAt: 10,
      lastMessageAt: null,
      lastMessagePreview: null,
      directPeer: null,
      ownerAgentId: 'agent-a',
      ownerAgentName: 'Agent A',
    } as const;

    threadDetail = {
      serverTimestamp: 10,
      thread: groupThread,
      members: [
        { agentId: 'agent-a', userId: 'user-a', agentName: 'Agent A', role: 'owner', joinedAt: 1, leftAt: null },
        { agentId: 'agent-b', userId: 'user-b', agentName: 'Agent B', role: 'member', joinedAt: 1, leftAt: null },
        { agentId: 'agent-c', userId: 'user-c', agentName: 'Agent C', role: 'member', joinedAt: 1, leftAt: null },
      ],
      messages: [],
      nextCursor: null,
    };

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
              { agentId: 'agent-c', agentName: 'Agent C', description: 'Gamma', avatarPath: null, isOnline: false },
            ],
            incomingRequests: [],
            outgoingRequests: [],
            blocks: [],
          };
        case 'uruc.social.list_inbox@v1':
          return {
            serverTimestamp: 1,
            unreadTotal: 0,
            threads: [groupThread],
          };
        case 'uruc.social.list_moments@v1':
          return {
            serverTimestamp: 1,
            moments: [],
          };
        case 'uruc.social.get_thread_history@v1':
          return threadDetail;
        case 'uruc.social.send_thread_message@v1':
          return {
            serverTimestamp: 11,
            thread: {
              ...groupThread,
              updatedAt: 11,
              lastMessageAt: 11,
              lastMessagePreview: typeof (payload as { body?: unknown } | undefined)?.body === 'string'
                ? (payload as { body: string }).body
                : null,
            },
            message: {
              messageId: 'message-1',
              threadId: groupThread.threadId,
              senderAgentId: 'agent-a',
              senderAgentName: 'Agent A',
              body: typeof (payload as { body?: unknown } | undefined)?.body === 'string'
                ? (payload as { body: string }).body
                : '',
              replyTo: null,
              mentions: [],
              mentionEveryone: Boolean((payload as { mentionEveryone?: unknown } | undefined)?.mentionEveryone),
              createdAt: 11,
              isDeleted: false,
              deletedAt: null,
              deletedReason: null,
            },
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

  it('opens mention suggestions when the user types @ in a group chat', async () => {
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          sendCommand: sendCommandMock,
        }),
      }),
      <SocialHubPage />,
    );

    try {
      const textarea = mounted.container.querySelector('textarea');
      expect(textarea).toBeInstanceOf(HTMLTextAreaElement);

      await typeIntoTextarea(textarea as HTMLTextAreaElement, '@');

      expect(mounted.container.textContent).toContain('social:hub.chats.mentionEveryone');
      expect(mounted.container.textContent).toContain('Agent B');
    } finally {
      await mounted.unmount();
    }
  });

  it('selects @全体成员 from the keyboard flow and sends mentionEveryone', async () => {
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          sendCommand: sendCommandMock,
        }),
      }),
      <SocialHubPage />,
    );

    try {
      const textarea = mounted.container.querySelector('textarea');
      expect(textarea).toBeInstanceOf(HTMLTextAreaElement);

      await typeIntoTextarea(textarea as HTMLTextAreaElement, '@全');
      await pressKey(textarea as HTMLTextAreaElement, 'Enter');

      expect(mounted.container.textContent).toContain('@social:hub.chats.mentionEveryone');

      await typeIntoTextarea(textarea as HTMLTextAreaElement, `${(textarea as HTMLTextAreaElement).value} 请看这里`);
      await pressKey(textarea as HTMLTextAreaElement, 'Enter');

      const sendCall = sendCommandMock.mock.calls.find(([commandId]) => commandId === 'uruc.social.send_thread_message@v1');
      expect(sendCall?.[1]).toMatchObject({
        mentionEveryone: true,
        mentionAgentIds: [],
      });
    } finally {
      await mounted.unmount();
    }
  });

  it('uses a single clear mention button label instead of @成员', async () => {
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          sendCommand: sendCommandMock,
        }),
      }),
      <SocialHubPage />,
    );

    try {
      const buttons = [...mounted.container.querySelectorAll('button')];
      const mentionButton = buttons.find((button) => button.textContent?.replace(/\s+/g, '') === 'social:hub.chats.mention');

      expect(mentionButton).toBeDefined();
      expect(mounted.container.textContent).not.toContain('@成员');
    } finally {
      await mounted.unmount();
    }
  });

  it('renders telegram-style grouped message metadata outside the bubble header', async () => {
    threadDetail = {
      ...threadDetail,
      messages: [
        {
          messageId: 'message-1',
          threadId: groupThread.threadId,
          senderAgentId: 'agent-b',
          senderAgentName: 'Agent B',
          body: '第一条来自 B',
          replyTo: null,
          mentions: [],
          mentionEveryone: false,
          createdAt: Date.parse('2026-03-17T10:00:00Z'),
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
        },
        {
          messageId: 'message-2',
          threadId: groupThread.threadId,
          senderAgentId: 'agent-b',
          senderAgentName: 'Agent B',
          body: '第二条来自 B',
          replyTo: null,
          mentions: [],
          mentionEveryone: false,
          createdAt: Date.parse('2026-03-17T10:03:00Z'),
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
        },
        {
          messageId: 'message-3',
          threadId: groupThread.threadId,
          senderAgentId: 'agent-a',
          senderAgentName: 'Agent A',
          body: '第一条来自我',
          replyTo: null,
          mentions: [],
          mentionEveryone: false,
          createdAt: Date.parse('2026-03-17T10:04:00Z'),
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
        },
        {
          messageId: 'message-4',
          threadId: groupThread.threadId,
          senderAgentId: 'agent-a',
          senderAgentName: 'Agent A',
          body: '第二条来自我',
          replyTo: null,
          mentions: [],
          mentionEveryone: false,
          createdAt: Date.parse('2026-03-17T10:06:00Z'),
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
        },
        {
          messageId: 'message-5',
          threadId: groupThread.threadId,
          senderAgentId: 'agent-b',
          senderAgentName: 'Agent B',
          body: '隔天来自 B',
          replyTo: null,
          mentions: [],
          mentionEveryone: false,
          createdAt: Date.parse('2026-03-18T08:00:00Z'),
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
        },
      ],
    };

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          sendCommand: sendCommandMock,
        }),
      }),
      <SocialHubPage />,
    );

    try {
      expect(mounted.container.querySelectorAll('.social-bubble__meta')).toHaveLength(0);
      expect(mounted.container.querySelectorAll('.social-message-day-pill')).toHaveLength(2);
      expect(mounted.container.querySelectorAll('.social-message-group-label')).toHaveLength(2);
      expect(mounted.container.querySelectorAll('.social-bubble__time')).toHaveLength(5);
      expect(mounted.container.querySelectorAll('.social-bubble__copy > .social-bubble__time')).toHaveLength(5);
    } finally {
      await mounted.unmount();
    }
  });

  it('opens a desktop context menu to reply instead of showing inline reply buttons', async () => {
    threadDetail = {
      ...threadDetail,
      messages: [
        {
          messageId: 'message-1',
          threadId: groupThread.threadId,
          senderAgentId: 'agent-b',
          senderAgentName: 'Agent B',
          body: '请回复我',
          replyTo: null,
          mentions: [],
          mentionEveryone: false,
          createdAt: Date.parse('2026-03-17T10:00:00Z'),
          isDeleted: false,
          deletedAt: null,
          deletedReason: null,
        },
      ],
    };

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          sendCommand: sendCommandMock,
        }),
      }),
      <SocialHubPage />,
    );

    try {
      expect(mounted.container.querySelectorAll('.social-message-row__tool')).toHaveLength(0);

      const bubble = mounted.container.querySelector('.social-bubble');
      expect(bubble).toBeTruthy();

      await openContextMenu(bubble as Element, { clientX: 160, clientY: 220 });

      const menu = mounted.container.querySelector('.social-message-context-menu');
      expect(menu).toBeTruthy();

      const replyButton = [...mounted.container.querySelectorAll('.social-message-context-menu__item')]
        .find((element) => element.textContent?.includes('social:hub.chats.reply'));
      expect(replyButton).toBeTruthy();

      await clickElement(replyButton as Element);

      expect(mounted.container.textContent).toContain('social:hub.chats.replyingTo');
      expect(mounted.container.textContent).toContain('请回复我');
    } finally {
      await mounted.unmount();
    }
  });
});
