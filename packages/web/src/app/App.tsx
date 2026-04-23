import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

import { AdminRoute } from '../components/AdminRoute';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PluginRouteElement } from '../components/plugins/PluginRouteElement';
import { usePluginHost } from '../plugins/context';
import type { RegisteredPageRoute } from '../plugins/registry';
import { getSavedTheme, setSavedTheme } from '../lib/storage';

import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { AuthCallbackPage } from './components/public/AuthCallbackPage';
import { IntroPage } from './components/public/IntroPage';
import { LoginPage } from './components/public/LoginPage';
import { RegisterPage } from './components/public/RegisterPage';
import { VerifyEmailPage } from './components/public/VerifyEmailPage';
import { AgentsPage } from './components/workspace/AgentsPage';
import { DeveloperRuntimePage } from './components/workspace/DeveloperRuntimePage';
import { HomePage } from './components/workspace/HomePage';
import { LibraryPage } from './components/workspace/LibraryPage';
import { SettingsPage } from './components/workspace/SettingsPage';

function normalizePluginPath(path: string): string {
  if (path.startsWith('/workspace/')) return path;
  if (path.startsWith('/app/plugins/')) return path.replace('/app/plugins/', '/workspace/plugins/');
  if (path.startsWith('/play/plugins/')) return path.replace('/play/plugins/', '/workspace/plugins/');
  if (path.startsWith('/plugins/')) return path.replace('/plugins/', '/workspace/plugins/');
  return path;
}

function withRouteGuard(route: RegisteredPageRoute, element: ReactNode) {
  if (route.guard === 'admin') {
    return <AdminRoute>{element}</AdminRoute>;
  }
  if (route.guard === 'auth') {
    return <ProtectedRoute>{element}</ProtectedRoute>;
  }
  return element;
}

function DeferredPluginRouteFallback() {
  const location = useLocation();
  const { registryReady } = usePluginHost();
  const normalizedPath = normalizePluginPath(location.pathname);
  const isPluginRoute = normalizedPath.startsWith('/workspace/plugins/');

  if (isPluginRoute && !registryReady) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-3 rounded-[28px] border border-zinc-200 bg-white/90 p-8 text-zinc-900 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-100">
          <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <LoaderCircle className="size-4 animate-spin" />
            Loading plugin routes
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Resolving workspace plugin page</h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The frontend plugin registry is still loading, so the workspace is waiting before routing this direct plugin URL.
          </p>
        </div>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}

export default function App() {
  const { allPageRoutes } = usePluginHost();
  const [isDark, setIsDark] = useState(() => getSavedTheme() === 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
      setSavedTheme('dark');
      return;
    }
    root.classList.remove('dark');
    root.dataset.theme = 'light';
    setSavedTheme('light');
  }, [isDark]);

  const pluginRoutes = useMemo(
    () => allPageRoutes.map((route) => ({
      ...route,
      path: normalizePluginPath(route.path),
      aliases: (route.aliases ?? []).map(normalizePluginPath),
    })),
    [allPageRoutes],
  );

  const aliasRoutes = useMemo(
    () => pluginRoutes.flatMap((route) => (route.aliases ?? []).map((alias) => ({ path: alias, to: route.path }))),
    [pluginRoutes],
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route element={<WorkspaceLayout isDark={isDark} toggleTheme={() => setIsDark((current) => !current)} />}>
          <Route
            path="/workspace"
            element={(
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/workspace/venues"
            element={(
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/workspace/agents"
            element={(
              <ProtectedRoute>
                <AgentsPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/workspace/settings"
            element={(
              <ProtectedRoute>
                <SettingsPage isDark={isDark} toggleTheme={() => setIsDark((current) => !current)} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/workspace/dev/runtime"
            element={(
              <ProtectedRoute>
                <DeveloperRuntimePage />
              </ProtectedRoute>
            )}
          />

          {pluginRoutes.map((route) => (
            <Route
              key={`${route.pluginId}:${route.id}`}
              path={route.path}
              element={withRouteGuard(route, <PluginRouteElement route={route} />)}
            />
          ))}
        </Route>

        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/register" element={<Navigate to="/auth/register" replace />} />
        <Route path="/verify-email" element={<Navigate to="/auth/verify-email" replace />} />
        <Route path="/agents" element={<Navigate to="/workspace/agents" replace />} />
        <Route path="/lobby" element={<Navigate to="/workspace/venues" replace />} />
        <Route path="/play" element={<Navigate to="/workspace/venues" replace />} />
        <Route path="/dev/runtime" element={<Navigate to="/workspace/dev/runtime" replace />} />

        {aliasRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={<Navigate to={route.to} replace />} />
        ))}

        <Route path="*" element={<DeferredPluginRouteFallback />} />
      </Routes>
    </BrowserRouter>
  );
}
