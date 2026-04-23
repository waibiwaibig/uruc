export const STORAGE_KEYS = {
  wsUrl: 'uruc_web_ws_url',
  locale: 'uruc_web_locale',
  appShellExpanded: 'uruc_web_app_shell_expanded',
  appShellAnchor: 'uruc_web_app_shell_anchor',
  linkedVenues: 'uruc_web_linked_venues',
  recentDestinations: 'uruc_web_recent_destinations',
  destinationLaunchMemory: 'uruc_web_destination_launch_memory',
  preferences: 'uruc_web_preferences',
  theme: 'uruc_web_theme',
} as const;

const LEGACY_STORAGE_KEYS = {
  wsUrl: 'uruc_human_ws_url',
  locale: 'uruc_human_locale',
  appShellExpanded: 'uruc_human_app_shell_expanded',
  appShellAnchor: 'uruc_human_app_shell_anchor',
  linkedVenues: 'uruc_web_pinned_destinations',
  theme: 'uruc-human-web-design-theme',
} as const;

export type AppLocale = 'en' | 'zh-CN';
export const DEFAULT_LOCALE: AppLocale = 'en';
const SUPPORTED_LOCALES = new Set<AppLocale>(['en', 'zh-CN']);

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function readString(key: string, legacyKey?: string): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(key) ?? (legacyKey ? storage.getItem(legacyKey) : null);
}

function writeString(key: string, value: string): void {
  getStorage()?.setItem(key, value);
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

  if (port === '5173' || port === '5174' || port === '4173' || port === '5176') {
    return `ws://${hostname}:3001`;
  }

  const numericPort = Number.parseInt(port, 10);
  if (Number.isFinite(numericPort) && numericPort > 0) {
    return `ws://${hostname}:${numericPort + 1}`;
  }

  return `ws://${isLocalHostname(hostname) ? hostname : host}:3001`;
}

export function getSavedWsUrl(): string {
  return readString(STORAGE_KEYS.wsUrl, LEGACY_STORAGE_KEYS.wsUrl) ?? defaultWsUrl();
}

export function setSavedWsUrl(url: string): void {
  writeString(STORAGE_KEYS.wsUrl, url);
}

export function getSavedLocale(): AppLocale {
  const value = readString(STORAGE_KEYS.locale, LEGACY_STORAGE_KEYS.locale);
  if (value && SUPPORTED_LOCALES.has(value as AppLocale)) {
    return value as AppLocale;
  }
  return DEFAULT_LOCALE;
}

export function setSavedLocale(locale: AppLocale): void {
  writeString(STORAGE_KEYS.locale, locale);
}

export function getSavedTheme(): 'light' | 'dark' {
  const value = readString(STORAGE_KEYS.theme, LEGACY_STORAGE_KEYS.theme);
  return value === 'dark' ? 'dark' : 'light';
}

export function setSavedTheme(theme: 'light' | 'dark'): void {
  writeString(STORAGE_KEYS.theme, theme);
}

export function getSavedAppShellExpanded(): boolean {
  const value = readString(STORAGE_KEYS.appShellExpanded, LEGACY_STORAGE_KEYS.appShellExpanded);
  if (value === '0') return false;
  if (value === '1') return true;
  return true;
}

export function setSavedAppShellExpanded(expanded: boolean): void {
  writeString(STORAGE_KEYS.appShellExpanded, expanded ? '1' : '0');
}

export type AppShellAnchor = {
  left: number;
  top: number;
};

export function getSavedAppShellAnchor(): AppShellAnchor | null {
  const value = readString(STORAGE_KEYS.appShellAnchor, LEGACY_STORAGE_KEYS.appShellAnchor);
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

export function getSavedStringList(key: string, legacyKey?: string): string[] {
  const raw = readString(key, legacyKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function setSavedStringList(key: string, values: string[]): void {
  getStorage()?.setItem(key, JSON.stringify(values));
}

export type SavedLaunchMode = 'same-tab' | 'new-tab';

type DestinationLaunchMemoryRecord = {
  mode: SavedLaunchMode;
  date: string;
};

type DestinationLaunchMemoryState = Record<string, DestinationLaunchMemoryRecord>;

function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readDestinationLaunchMemory(): DestinationLaunchMemoryState {
  const raw = readString(STORAGE_KEYS.destinationLaunchMemory);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DestinationLaunchMemoryRecord>>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([destinationId, value]) => (
        typeof value?.mode === 'string' &&
        (value.mode === 'same-tab' || value.mode === 'new-tab') &&
        typeof value.date === 'string' &&
        value.date
          ? [[destinationId, { mode: value.mode, date: value.date } satisfies DestinationLaunchMemoryRecord]]
          : []
      )),
    );
  } catch {
    return {};
  }
}

function writeDestinationLaunchMemory(value: DestinationLaunchMemoryState): void {
  getStorage()?.setItem(STORAGE_KEYS.destinationLaunchMemory, JSON.stringify(value));
}

function pruneDestinationLaunchMemory(
  value: DestinationLaunchMemoryState,
  now: Date,
): DestinationLaunchMemoryState {
  const today = localDateKey(now);
  return Object.fromEntries(
    Object.entries(value).filter(([, record]) => record.date === today),
  );
}

export function getSavedLinkedVenueIds(): string[] {
  return getSavedStringList(STORAGE_KEYS.linkedVenues, LEGACY_STORAGE_KEYS.linkedVenues);
}

export function setSavedLinkedVenueIds(values: string[]): void {
  setSavedStringList(STORAGE_KEYS.linkedVenues, values);
}

export function getRememberedLaunchMode(
  destinationId: string,
  now: Date = new Date(),
): SavedLaunchMode | null {
  const value = pruneDestinationLaunchMemory(readDestinationLaunchMemory(), now);
  const record = value[destinationId];
  if (!record) return null;
  return record.mode;
}

export function rememberLaunchMode(
  destinationId: string,
  mode: SavedLaunchMode,
  now: Date = new Date(),
): void {
  const next = pruneDestinationLaunchMemory(readDestinationLaunchMemory(), now);
  next[destinationId] = {
    mode,
    date: localDateKey(now),
  };
  writeDestinationLaunchMemory(next);
}

export function clearRememberedLaunchMode(
  destinationId: string,
  now: Date = new Date(),
): void {
  const next = pruneDestinationLaunchMemory(readDestinationLaunchMemory(), now);
  delete next[destinationId];
  writeDestinationLaunchMemory(next);
}
