import { type ReactNode, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoaderCircle, PlugZap } from 'lucide-react';
import { AdminRoute } from './components/AdminRoute';
import { AppShell } from './components/AppShell';
import { StandaloneShell } from './components/StandaloneShell';
import { PluginRouteElement } from './components/plugins/PluginRouteElement';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicShell } from './components/PublicShell';
import { IntroPage } from './pages/IntroPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AgentConsolePage } from './pages/AgentConsolePage';
import { LobbyPage } from './pages/LobbyPage';
import { PlayPage } from './pages/PlayPage';
import { DeveloperRuntimePage } from './pages/DeveloperRuntimePage';
import { usePluginHost } from './plugins/context';
import type { RegisteredPageRoute } from './plugins/registry';

function withRouteGuard(route: RegisteredPageRoute, element: ReactNode) {
  if (route.guard === 'admin') {
    return <AdminRoute>{element}</AdminRoute>;
  }
  if (route.guard === 'auth') {
    return <ProtectedRoute>{element}</ProtectedRoute>;
  }
  return element;
}

export default function App() {
  const { allPageRoutes, registryReady } = usePluginHost();
  const publicPluginRoutes = useMemo(
    () => allPageRoutes.filter((route) => route.shell === 'public'),
    [allPageRoutes],
  );
  const appPluginRoutes = useMemo(
    () => allPageRoutes.filter((route) => route.shell === 'app'),
    [allPageRoutes],
  );
  const standalonePluginRoutes = useMemo(
    () => allPageRoutes.filter((route) => route.shell === 'standalone'),
    [allPageRoutes],
  );
  const aliasRoutes = useMemo(
    () => allPageRoutes.flatMap((route) => (route.aliases ?? []).map((alias) => ({
      path: alias,
      to: route.path,
    }))),
    [allPageRoutes],
  );

  if (!registryReady) {
    return (
      <div className="page-wrap main-grid">
        <section className="card control-section">
          <div className="notice info">
            <span className="row"><LoaderCircle size={14} className="spin" /> Loading plugin registry…</span>
          </div>
          <h1 className="title-card">Plugin Host</h1>
          <p className="section-sub">
            <span className="row"><PlugZap size={14} /> Frontend plugins are loading independently.</span>
          </p>
        </section>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<IntroPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {publicPluginRoutes.map((route) => (
            <Route
              id={`plugin:${route.pluginId}:${route.id}`}
              key={`${route.pluginId}:${route.id}`}
              path={route.path}
              element={withRouteGuard(route, <PluginRouteElement route={route} />)}
            />
          ))}
        </Route>

        <Route element={<AppShell />}>
          <Route
            path="/agents"
            element={(
              <ProtectedRoute>
                <AgentConsolePage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/lobby"
            element={(
              <ProtectedRoute>
                <LobbyPage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/dev/runtime"
            element={(
              <ProtectedRoute>
                <DeveloperRuntimePage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/play"
            element={(
              <ProtectedRoute>
                <PlayPage />
              </ProtectedRoute>
            )}
          />
          {appPluginRoutes.map((route) => (
            <Route
              id={`plugin:${route.pluginId}:${route.id}`}
              key={`${route.pluginId}:${route.id}`}
              path={route.path}
              element={withRouteGuard(route, <PluginRouteElement route={route} />)}
            />
          ))}
        </Route>

        <Route element={<StandaloneShell />}>
          {standalonePluginRoutes.map((route) => (
            <Route
              id={`plugin:${route.pluginId}:${route.id}`}
              key={`${route.pluginId}:${route.id}`}
              path={route.path}
              element={withRouteGuard(route, <PluginRouteElement route={route} />)}
            />
          ))}
        </Route>

        <Route path="/city" element={<Navigate to="/lobby" replace />} />
        {aliasRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={<Navigate to={route.to} replace />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
