// @vitest-environment jsdom

import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { usePluginPage } from '@uruc/plugin-sdk/frontend-react';

import { PluginRouteElement } from '../PluginRouteElement';
import type { RegisteredPageRoute } from '../../../plugins/registry';
import { usePluginPortalContainer } from '@uruc/plugin-sdk/frontend-react';

const runtime = {
  status: 'idle',
  isConnected: false,
  hasController: false,
  isController: false,
  error: '',
  inCity: false,
  currentLocation: null,
  agentId: null,
  agentName: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  claimControl: vi.fn(),
  releaseControl: vi.fn(),
  refreshSessionState: vi.fn(),
  refreshCommands: vi.fn(),
  sendCommand: vi.fn(),
  enterCity: vi.fn(),
  leaveCity: vi.fn(),
  enterLocation: vi.fn(),
  leaveLocation: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
  reportEvent: vi.fn(),
};

vi.mock('../../../plugins/context', () => ({
  usePluginHost: () => ({
    isPluginEnabled: () => true,
    buildPageContext: (pluginId: string) => ({
      pluginId,
      runtime,
      user: null,
      ownerAgent: null,
      connectedAgent: null,
      shell: {
        notify: vi.fn(),
      },
    }),
  }),
}));

function PluginProbe() {
  const page = usePluginPage();
  const portalContainer = usePluginPortalContainer();

  return (
    <>
      <div data-testid="plugin-page" data-plugin-id={page.pluginId} />
      {portalContainer ? createPortal(<div data-testid="plugin-portal-child" />, portalContainer) : null}
    </>
  );
}

function makeRoute(overrides: Partial<RegisteredPageRoute> = {}): RegisteredPageRoute {
  return {
    pluginId: 'acme.shadow',
    pluginVersion: '0.1.0',
    source: 'test',
    id: 'home',
    pathSegment: 'home',
    aliases: [],
    shell: 'app',
    guard: 'auth',
    order: 1,
    path: '/workspace/plugins/acme.shadow/home',
    styles: [async () => '.hidden{display:none}.flex-col{flex-direction:column}'],
    styleUrls: ['/runtime-plugin.css'],
    load: async () => ({ default: PluginProbe }),
    ...overrides,
  };
}

async function renderPluginRoute(route = makeRoute()) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[route.path]}>
        <PluginRouteElement route={route} />
      </MemoryRouter>,
    );
  });

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('PluginRouteElement isolation', () => {
  it('renders plugin pages and plugin styles inside the plugin shadow root', async () => {
    const { container, cleanup } = await renderPluginRoute();

    const host = container.querySelector<HTMLElement>('[data-uruc-plugin-host="acme.shadow"]');
    const shadowRoot = host?.shadowRoot;

    expect(shadowRoot).toBeTruthy();
    expect(container.querySelector('[data-testid="plugin-page"]')).toBeNull();
    expect(shadowRoot?.querySelector('[data-testid="plugin-page"]')).toBeTruthy();
    expect(shadowRoot?.querySelector<HTMLStyleElement>('style[data-uruc-plugin-base-style]')?.textContent).toContain('[data-uruc-plugin-app-root] {\n        display: block;');
    expect(shadowRoot?.querySelector<HTMLStyleElement>('style[data-uruc-plugin-style]')?.textContent).toContain('.hidden');
    expect(shadowRoot?.querySelector<HTMLLinkElement>('link[data-uruc-plugin-style-url]')?.href).toContain('/runtime-plugin.css');

    await cleanup();
  });

  it('renders plugin portal children into the plugin-local portal root', async () => {
    const { container, cleanup } = await renderPluginRoute();

    const host = container.querySelector<HTMLElement>('[data-uruc-plugin-host="acme.shadow"]');
    const shadowRoot = host?.shadowRoot;
    const portalRoot = shadowRoot?.querySelector('[data-uruc-plugin-portal-root]');

    expect(document.body.querySelector('[data-testid="plugin-portal-child"]')).toBeNull();
    expect(portalRoot?.querySelector('[data-testid="plugin-portal-child"]')).toBeTruthy();

    await cleanup();
  });
});
