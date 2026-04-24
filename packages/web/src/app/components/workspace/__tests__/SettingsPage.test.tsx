// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n, { setLocale } from '../../../../i18n';
import { SettingsPage } from '../SettingsPage';

const updatePreferenceMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-a',
      username: 'holder',
      role: 'admin',
      email: 'holder@example.com',
      emailVerified: true,
    },
    logout: logoutMock,
  }),
}));

vi.mock('../../../context/WorkspaceSurfaceContext', () => ({
  useWorkspaceSurface: () => ({
    preferences: {
      quietNotifications: false,
      desktopAlerts: false,
      quickLaunchRecent: true,
      compactLibrary: false,
      reducedMotion: false,
      securityLock: false,
    },
    updatePreference: updatePreferenceMock,
  }),
}));

async function renderSettingsPage() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<SettingsPage isDark={false} toggleTheme={() => undefined} />);
  });

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

async function clickElement(element: Element) {
  await act(async () => {
    (element as HTMLElement).click();
  });
}

describe('SettingsPage language controls', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await setLocale('en');
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await setLocale('en');
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('changes the global workspace locale from host settings', async () => {
    const mounted = await renderSettingsPage();

    try {
      const chineseButton = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === '中文');
      expect(chineseButton).toBeDefined();

      await clickElement(chineseButton as HTMLButtonElement);

      expect(i18n.resolvedLanguage).toBe('zh-CN');
      expect(window.localStorage.getItem('uruc_web_locale')).toBe('zh-CN');
      expect(document.documentElement.lang).toBe('zh-CN');

      const englishButton = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'English');
      expect(englishButton).toBeDefined();

      await clickElement(englishButton as HTMLButtonElement);

      expect(i18n.resolvedLanguage).toBe('en');
      expect(window.localStorage.getItem('uruc_web_locale')).toBe('en');
      expect(document.documentElement.lang).toBe('en');
    } finally {
      await mounted.unmount();
    }
  });
});
