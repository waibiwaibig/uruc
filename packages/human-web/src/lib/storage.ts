export const STORAGE_KEYS = {
  wsUrl: 'uruc_human_ws_url',
  locale: 'uruc_human_locale',
  appShellExpanded: 'uruc_human_app_shell_expanded',
  appShellAnchor: 'uruc_human_app_shell_anchor',
} as const;

export type AppLocale = 'en' | 'zh-CN';
export const DEFAULT_LOCALE: AppLocale = 'en';
const SUPPORTED_LOCALES = new Set<AppLocale>(['en', 'zh-CN']);

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

export function defaultWsUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://127.0.0.1:3001';
  }
  const { hostname, host, port, protocol } = window.location;
  if (protocol === 'https:') {
    return `wss://${host}/ws`;
  }

  // Local Vite dev and direct LAN/server runs all use a dedicated WS port.
  if (port === '5173' || port === '5174' || port === '4173') {
    return `ws://${hostname}:3001`;
  }

  const numericPort = Number.parseInt(port, 10);
  if (Number.isFinite(numericPort) && numericPort > 0) {
    return `ws://${hostname}:${numericPort + 1}`;
  }

  return `ws://${isLocalHostname(hostname) ? hostname : host}:3001`;
}

export function getSavedWsUrl(): string {
  return getStorage()?.getItem(STORAGE_KEYS.wsUrl) ?? defaultWsUrl();
}

export function setSavedWsUrl(url: string): void {
  getStorage()?.setItem(STORAGE_KEYS.wsUrl, url);
}

export function getSavedLocale(): AppLocale {
  const value = getStorage()?.getItem(STORAGE_KEYS.locale);
  if (value && SUPPORTED_LOCALES.has(value as AppLocale)) {
    return value as AppLocale;
  }
  return DEFAULT_LOCALE;
}

export function setSavedLocale(locale: AppLocale): void {
  getStorage()?.setItem(STORAGE_KEYS.locale, locale);
}

export function getSavedAppShellExpanded(): boolean {
  const value = getStorage()?.getItem(STORAGE_KEYS.appShellExpanded);
  if (value === '0') return false;
  if (value === '1') return true;
  return true;
}

export function setSavedAppShellExpanded(expanded: boolean): void {
  getStorage()?.setItem(STORAGE_KEYS.appShellExpanded, expanded ? '1' : '0');
}

export type AppShellAnchor = {
  left: number;
  top: number;
};

export function getSavedAppShellAnchor(): AppShellAnchor | null {
  const value = getStorage()?.getItem(STORAGE_KEYS.appShellAnchor);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<AppShellAnchor>;
    if (
      typeof parsed.left === 'number' &&
      Number.isFinite(parsed.left) &&
      typeof parsed.top === 'number' &&
      Number.isFinite(parsed.top)
    ) {
      return {
        left: parsed.left,
        top: parsed.top,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function setSavedAppShellAnchor(anchor: AppShellAnchor | null): void {
  const storage = getStorage();
  if (!storage) return;
  if (!anchor) {
    storage.removeItem(STORAGE_KEYS.appShellAnchor);
    return;
  }

  storage.setItem(STORAGE_KEYS.appShellAnchor, JSON.stringify(anchor));
}
