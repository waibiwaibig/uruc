import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    void DashboardApi.me()
      .then((res) => {
        if (!active) return;
        setUser(res.user);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (!active) return;
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback((nextUser: User) => {
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void AuthApi.logout().catch(() => undefined);
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await DashboardApi.me();
    setUser(res.user);
  }, []);

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
