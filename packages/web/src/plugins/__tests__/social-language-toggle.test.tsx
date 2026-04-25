// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import i18n, { setLocale } from '../../i18n';
import socialEn from '../../../../plugins/social/frontend/locales/en';
import socialZhCN from '../../../../plugins/social/frontend/locales/zh-CN';
import { SocialHubPage } from '../../../../plugins/social/frontend/SocialHubPage';

const {
  listOwnedAgentsMock,
} = vi.hoisted(() => ({
  listOwnedAgentsMock: vi.fn(),
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
  const sendCommand: PluginRuntimeApi['sendCommand'] = async <T,>(commandId?: string) => {
    switch (commandId) {
      case 'uruc.social.list_relationships@v1':
        return {
          serverTimestamp: 1,
          friends: [],
          incomingRequests: [],
          outgoingRequests: [],
          blocks: [],
        } as T;
      case 'uruc.social.list_inbox@v1':
        return {
          serverTimestamp: 1,
          unreadTotal: 0,
          threads: [],
        } as T;
      case 'uruc.social.list_moments@v1':
        return {
          serverTimestamp: 1,
          moments: [],
        } as T;
      default:
        return {} as T;
    }
  };

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
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <PluginPageContext.Provider value={pageData}>
            {element}
          </PluginPageContext.Provider>
        </MemoryRouter>
      </I18nextProvider>,
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

describe('SocialHubPage language settings entry', () => {
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => window.setTimeout(callback, 0)) as typeof window.requestAnimationFrame;
    }

    i18n.addResourceBundle('en', 'social', socialEn.social, true, true);
    i18n.addResourceBundle('zh-CN', 'social', socialZhCN.social, true, true);
    i18n.addResourceBundle('en', 'socialAdmin', socialEn.socialAdmin, true, true);
    i18n.addResourceBundle('zh-CN', 'socialAdmin', socialZhCN.socialAdmin, true, true);

    await setLocale('zh-CN');

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
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await setLocale('en');
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('links to host settings without switching the shared locale inline', async () => {
    const mounted = await mountPluginPageDom(createPageData(), <SocialHubPage />);

    try {
      expect(mounted.container.textContent).toContain('聊天');
      expect(mounted.container.textContent).toContain('联系人');
      expect(mounted.container.textContent).toContain('动态');

      const settingsLink = mounted.container.querySelector<HTMLAnchorElement>('a[href="/workspace/settings#workspace-language-settings"]');
      expect(settingsLink).toBeDefined();
      expect(settingsLink?.textContent?.trim()).toBe('语言');

      await clickElement(settingsLink as HTMLAnchorElement);

      expect(i18n.resolvedLanguage).toBe('zh-CN');
      expect(mounted.container.textContent).toContain('聊天');
      expect(mounted.container.textContent).toContain('联系人');
      expect(mounted.container.textContent).toContain('动态');
    } finally {
      await mounted.unmount();
    }
  });
});
