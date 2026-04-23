import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthApi, DashboardApi } from '../lib/api';
import type { User } from '../lib/types';

interface AuthContextValue {
  ready: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_SYNC_CHANNEL_NAME = 'uruc:web:auth';
const AUTH_SYNC_STORAGE_KEY = 'uruc_web_auth_sync';
const AUTH_SYNC_EVENT_CACHE_LIMIT = 32;

type AuthSyncEvent = {
  id: string;
  sourceTabId: string;
  type: 'signed_in' | 'signed_out' | 'profile_refreshed';
  user: User | null;
  at: number;
};

function createAuthSyncTabId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createAuthSyncEvent(sourceTabId: string, type: AuthSyncEvent['type'], user: User | null = null): AuthSyncEvent {
  const eventId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${sourceTabId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  return {
    id: eventId,
    sourceTabId,
    type,
    user,
    at: Date.now(),
  };
}

function parseAuthSyncEvent(raw: unknown): AuthSyncEvent | null {
  let candidate = raw;

  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  if (!candidate || typeof candidate !== 'object') return null;
  const next = candidate as Partial<AuthSyncEvent>;

  if (
    typeof next.id !== 'string'
    || typeof next.sourceTabId !== 'string'
    || typeof next.at !== 'number'
    || (next.type !== 'signed_in' && next.type !== 'signed_out' && next.type !== 'profile_refreshed')
  ) {
    return null;
  }

  if (next.user !== null && next.user !== undefined) {
    const user = next.user as Partial<User>;
    if (
      typeof user !== 'object'
      || typeof user.id !== 'string'
      || typeof user.username !== 'string'
      || (user.role !== 'user' && user.role !== 'admin')
    ) {
      return null;
    }
  }

  return {
    id: next.id,
    sourceTabId: next.sourceTabId,
    type: next.type,
    user: (next.user as User | null | undefined) ?? null,
    at: next.at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const tabIdRef = useRef(createAuthSyncTabId());
  const mountedRef = useRef(true);
  const authRevisionRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const seenEventIdsRef = useRef<string[]>([]);

  const rememberEventId = useCallback((eventId: string) => {
    const seenIds = seenEventIdsRef.current;
    if (seenIds.includes(eventId)) {
      return false;
    }
    seenIds.push(eventId);
    if (seenIds.length > AUTH_SYNC_EVENT_CACHE_LIMIT) {
      seenIds.splice(0, seenIds.length - AUTH_SYNC_EVENT_CACHE_LIMIT);
    }
    return true;
  }, []);

  const applyAuthState = useCallback((nextUser: User | null) => {
    authRevisionRef.current += 1;
    if (!mountedRef.current) return;
    setUser(nextUser);
    setReady(true);
  }, []);

  const publishAuthEvent = useCallback((type: AuthSyncEvent['type'], nextUser: User | null = null) => {
    const event = createAuthSyncEvent(tabIdRef.current, type, nextUser);
    rememberEventId(event.id);

    try {
      channelRef.current?.postMessage(event);
    } catch {
      // Ignore BroadcastChannel failures and rely on the storage-event fallback.
    }

    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(event));
    } catch {
      // Ignore storage failures and keep same-tab auth behavior intact.
    }
  }, [rememberEventId]);

  const hydrateProfile = useCallback(async (options?: { clearOnError?: boolean; broadcast?: boolean }) => {
    const revisionAtStart = authRevisionRef.current;
    try {
      const res = await DashboardApi.me();
      if (authRevisionRef.current !== revisionAtStart) return null;
      applyAuthState(res.user);
      if (options?.broadcast) {
        publishAuthEvent('profile_refreshed', res.user);
      }
      return res.user;
    } catch (error) {
      if (authRevisionRef.current !== revisionAtStart) return null;
      if (options?.clearOnError) {
        applyAuthState(null);
        return null;
      }
      throw error;
    }
  }, [applyAuthState, publishAuthEvent]);

  useEffect(() => {
    void hydrateProfile({ clearOnError: true });
  }, [hydrateProfile]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const applyRemoteAuthEvent = (raw: unknown) => {
      const event = parseAuthSyncEvent(raw);
      if (!event) return;
      if (event.sourceTabId === tabIdRef.current) return;
      if (!rememberEventId(event.id)) return;

      if (event.type === 'signed_out') {
        applyAuthState(null);
        return;
      }

      if (event.user) {
        applyAuthState(event.user);
        return;
      }

      void hydrateProfile({ clearOnError: true });
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME);
      channel.onmessage = (message) => {
        applyRemoteAuthEvent(message.data);
      };
      channelRef.current = channel;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
      applyRemoteAuthEvent(event.newValue);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      channel?.close();
    };
  }, [applyAuthState, hydrateProfile, rememberEventId]);

  const login = useCallback((nextUser: User) => {
    applyAuthState(nextUser);
    publishAuthEvent('signed_in', nextUser);
  }, [applyAuthState, publishAuthEvent]);

  const logout = useCallback(() => {
    applyAuthState(null);
    publishAuthEvent('signed_out');
    void AuthApi.logout().catch(() => undefined);
  }, [applyAuthState, publishAuthEvent]);

  const refreshProfile = useCallback(async () => {
    await hydrateProfile({ broadcast: true });
  }, [hydrateProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, user, login, logout, refreshProfile }),
    [login, logout, ready, refreshProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
