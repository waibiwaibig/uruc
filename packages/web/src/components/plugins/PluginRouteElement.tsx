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

function PluginStatePanel({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-[32px] border border-zinc-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          {icon}
          {title}
        </div>
        <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">{body}</p>
      </section>
    </div>
  );
}

function PluginUnavailablePage({ pluginId }: { pluginId: string }) {
  return (
    <PluginStatePanel
      title="Plugin unavailable"
      body={`The plugin '${pluginId}' is not enabled on the current server.`}
      icon={<PlugZap className="size-4" />}
    />
  );
}

function PluginRenderErrorPage({ pluginId }: { pluginId: string }) {
  return (
    <PluginStatePanel
      title="Plugin render failed"
      body={`The plugin page for '${pluginId}' crashed while rendering.`}
      icon={<AlertTriangle className="size-4" />}
    />
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
        <PluginStatePanel
          title="Loading plugin"
          body="Frontend plugin assets are loading into the workspace host."
          icon={<LoaderCircle className="size-4 animate-spin" />}
        />
      )}
      >
        <PluginPageContext.Provider key={routeInstanceKey} value={buildPageContext(route.pluginId)}>
          <LazyComponent key={routeInstanceKey} />
        </PluginPageContext.Provider>
      </Suspense>
    </PluginErrorBoundary>
  );
}
