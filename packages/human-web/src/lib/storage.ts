export const STORAGE_KEYS = {
  selectedAgentId: 'uruc_human_selected_agent',
  wsUrl: 'uruc_human_ws_url',
  locale: 'uruc_human_locale',
} as const;

export type AppLocale = 'en' | 'zh-CN';
export const DEFAULT_LOCALE: AppLocale = 'en';
const SUPPORTED_LOCALES = new Set<AppLocale>(['en', 'zh-CN']);

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

export function getSelectedAgentId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.selectedAgentId);
}

export function setSelectedAgentId(agentId: string | null): void {
  if (!agentId) {
    localStorage.removeItem(STORAGE_KEYS.selectedAgentId);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.selectedAgentId, agentId);
}

export function defaultWsUrl(): string {
  const { hostname, host, port, protocol } = window.location;
  if (protocol === 'https:') {
    return `wss://${host}/ws`;
  }

  if (isLocalHostname(hostname)) {
    // Local Vite dev and preview servers proxy HTTP to :3000 while WS stays on :3001.
    if (port === '5173' || port === '5174' || port === '4173') {
      return `ws://${hostname}:3001`;
    }

    const numericPort = Number.parseInt(port, 10);
    if (Number.isFinite(numericPort) && numericPort > 0) {
      return `ws://${hostname}:${numericPort + 1}`;
    }
    return `ws://${hostname}:3001`;
  }

  return `ws://${host}/ws`;
}

export function getSavedWsUrl(): string {
  return localStorage.getItem(STORAGE_KEYS.wsUrl) ?? defaultWsUrl();
}

export function setSavedWsUrl(url: string): void {
  localStorage.setItem(STORAGE_KEYS.wsUrl, url);
}

export function getSavedLocale(): AppLocale {
  const value = localStorage.getItem(STORAGE_KEYS.locale);
  if (value && SUPPORTED_LOCALES.has(value as AppLocale)) {
    return value as AppLocale;
  }
  return DEFAULT_LOCALE;
}

export function setSavedLocale(locale: AppLocale): void {
  localStorage.setItem(STORAGE_KEYS.locale, locale);
}
