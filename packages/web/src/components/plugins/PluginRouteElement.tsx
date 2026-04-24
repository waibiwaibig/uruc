import React, {
  type ComponentType,
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { PluginDomBoundaryProvider, PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { AlertTriangle, LoaderCircle, PlugZap } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { usePluginHost } from '../../plugins/context';
import type { RegisteredPageRoute } from '../../plugins/registry';

interface PluginShadowMount {
  shadowRoot: ShadowRoot;
  appRoot: HTMLElement;
  portalRoot: HTMLElement;
}

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

function normalizeStyleModule(mod: unknown): string {
  if (typeof mod === 'string') {
    return mod;
  }
  if (mod && typeof mod === 'object' && 'default' in mod && typeof mod.default === 'string') {
    return mod.default;
  }
  return '';
}

function syncShadowRootAttributes(appRoot: HTMLElement, portalRoot: HTMLElement): void {
  const doc = appRoot.ownerDocument;
  const docEl = doc.documentElement;
  const targets = [appRoot, portalRoot];

  for (const target of targets) {
    target.lang = docEl.lang || doc.body?.lang || '';
    target.dir = docEl.dir || doc.body?.dir || '';
    target.classList.toggle('dark', docEl.classList.contains('dark') || doc.body?.classList.contains('dark'));

    for (const attribute of Array.from(target.attributes)) {
      if (attribute.name.startsWith('data-theme') || attribute.name === 'data-color-scheme') {
        target.removeAttribute(attribute.name);
      }
    }

    for (const attribute of Array.from(docEl.attributes)) {
      if (attribute.name.startsWith('data-theme') || attribute.name === 'data-color-scheme') {
        target.setAttribute(attribute.name, attribute.value);
      }
    }
  }
}

function usePluginShadowMount(pluginId: string, routeId: string): [React.RefObject<HTMLDivElement | null>, PluginShadowMount | null] {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<PluginShadowMount | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    shadowRoot.replaceChildren();

    const baseStyle = document.createElement('style');
    baseStyle.setAttribute('data-uruc-plugin-base-style', '');
    baseStyle.textContent = `
      :host {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        color: inherit;
        font: inherit;
      }
      *, ::before, ::after {
        box-sizing: border-box;
      }
      [data-uruc-plugin-app-root] {
        display: block;
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
      }
    `;

    const appRoot = document.createElement('div');
    appRoot.setAttribute('data-uruc-plugin-app-root', '');
    appRoot.setAttribute('data-plugin-id', pluginId);
    appRoot.setAttribute('data-route-id', routeId);

    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('data-uruc-plugin-portal-root', '');
    portalRoot.setAttribute('data-plugin-id', pluginId);
    portalRoot.setAttribute('data-route-id', routeId);

    shadowRoot.append(baseStyle, appRoot, portalRoot);
    syncShadowRootAttributes(appRoot, portalRoot);

    const observer = new MutationObserver(() => syncShadowRootAttributes(appRoot, portalRoot));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'dir', 'lang', 'data-theme', 'data-color-scheme'] });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'dir', 'lang', 'data-theme', 'data-color-scheme'] });
    }

    const nextMount = { shadowRoot, appRoot, portalRoot };
    setMount(nextMount);

    return () => {
      observer.disconnect();
    };
  }, [pluginId, routeId]);

  return [hostRef, mount];
}

function usePluginShadowStyles(route: RegisteredPageRoute, mount: PluginShadowMount | null): void {
  useEffect(() => {
    if (!mount) return undefined;
    let active = true;
    const nodes: Array<HTMLStyleElement | HTMLLinkElement> = [];

    for (const url of route.styleUrls) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-uruc-plugin-style-url', url);
      if (mount.appRoot.parentNode === mount.shadowRoot) {
        mount.shadowRoot.insertBefore(link, mount.appRoot);
      } else {
        mount.shadowRoot.append(link);
      }
      nodes.push(link);
    }

    void Promise.all((route.styles ?? []).map(async (loadStyle, index) => {
      try {
        const cssText = normalizeStyleModule(await loadStyle());
        if (!active || !cssText) return;
        const style = document.createElement('style');
        style.setAttribute('data-uruc-plugin-style', `${route.pluginId}:${route.id}:${index}`);
        style.textContent = cssText;
        if (mount.appRoot.parentNode === mount.shadowRoot) {
          mount.shadowRoot.insertBefore(style, mount.appRoot);
        } else {
          mount.shadowRoot.append(style);
        }
        nodes.push(style);
      } catch (error) {
        console.error(`[PluginHost] Failed to load plugin stylesheet for ${route.pluginId}:${route.id}`, error);
      }
    }));

    return () => {
      active = false;
      for (const node of nodes) {
        node.remove();
      }
    };
  }, [mount, route]);
}

function IsolatedPluginHost({
  route,
  children,
}: {
  route: RegisteredPageRoute;
  children: React.ReactNode;
}) {
  const [hostRef, mount] = usePluginShadowMount(route.pluginId, route.id);
  usePluginShadowStyles(route, mount);

  return (
    <div
      ref={hostRef}
      data-uruc-plugin-host={route.pluginId}
      data-plugin-route={route.id}
      className="flex min-h-0 flex-1"
      style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, width: '100%' }}
    >
      {mount ? createPortal(
        <PluginDomBoundaryProvider value={{ shadowRoot: mount.shadowRoot, portalContainer: mount.portalRoot }}>
          {children}
        </PluginDomBoundaryProvider>,
        mount.appRoot,
      ) : null}
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
        <PluginStatePanel
          title="Loading plugin"
          body="Frontend plugin assets are loading into the workspace host."
          icon={<LoaderCircle className="size-4 animate-spin" />}
        />
      )}
      >
        <IsolatedPluginHost key={routeInstanceKey} route={route}>
          <PluginPageContext.Provider key={routeInstanceKey} value={buildPageContext(route.pluginId)}>
            <LazyComponent key={routeInstanceKey} />
          </PluginPageContext.Provider>
        </IsolatedPluginHost>
      </Suspense>
    </PluginErrorBoundary>
  );
}
