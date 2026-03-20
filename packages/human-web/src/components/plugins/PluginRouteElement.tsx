import React, { type ComponentType, Suspense, lazy, useMemo } from 'react';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { AlertTriangle, LoaderCircle, PlugZap } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { usePluginHost } from '../../plugins/context';
import type { RegisteredPageRoute } from '../../plugins/registry';

class PluginErrorBoundary extends React.Component<{
  fallback: React.ReactNode;
  children: React.ReactNode;
}, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidUpdate(prevProps: Readonly<{ fallback: React.ReactNode; children: React.ReactNode }>): void {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function PluginUnavailablePage({ pluginId }: { pluginId: string }) {
  return (
    <div className="page-wrap main-grid">
      <section className="card control-section">
        <div className="notice info">
          <span className="row"><PlugZap size={14} /> Plugin unavailable.</span>
        </div>
        <h1 className="title-card">{pluginId}</h1>
        <p className="section-sub">This plugin is not enabled on the current server.</p>
      </section>
    </div>
  );
}

function PluginRenderErrorPage({ pluginId }: { pluginId: string }) {
  return (
    <div className="page-wrap main-grid">
      <section className="card control-section">
        <div className="notice error">
          <span className="row"><AlertTriangle size={14} /> Plugin render failed.</span>
        </div>
        <h1 className="title-card">{pluginId}</h1>
        <p className="section-sub">This plugin page crashed while rendering.</p>
      </section>
    </div>
  );
}

export function PluginRouteElement({ route }: { route: RegisteredPageRoute }) {
  const { buildPageContext, isPluginEnabled } = usePluginHost();
  const location = useLocation();
  const LazyComponent = useMemo(
    () => lazy(async () => {
      try {
        const mod = await route.load();
        return { default: (mod as { default: ComponentType }).default };
      } catch {
        return { default: () => <PluginRenderErrorPage pluginId={route.pluginId} /> };
      }
    }),
    [route],
  );
  const routeInstanceKey = `${route.pluginId}:${route.id}:${location.pathname}`;

  if (!isPluginEnabled(route.pluginId)) {
    return <PluginUnavailablePage pluginId={route.pluginId} />;
  }

  return (
    <PluginErrorBoundary key={routeInstanceKey} fallback={<PluginRenderErrorPage pluginId={route.pluginId} />}>
      <Suspense fallback={(
        <div className="page-wrap main-grid">
          <section className="card control-section">
            <div className="notice info">
              <span className="row"><LoaderCircle size={14} className="spin" /> Loading plugin…</span>
            </div>
          </section>
        </div>
      )}
      >
        <PluginPageContext.Provider key={routeInstanceKey} value={buildPageContext(route.pluginId)}>
          <LazyComponent key={routeInstanceKey} />
        </PluginPageContext.Provider>
      </Suspense>
    </PluginErrorBoundary>
  );
}
