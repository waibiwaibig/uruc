import { createContext, useContext } from 'react';
import type { PluginPageData } from './frontend.js';
import { isPluginCommandError } from './frontend.js';

export const PluginPageContext = createContext<PluginPageData | null>(null);

export interface PluginDomBoundary {
  shadowRoot: ShadowRoot | null;
  portalContainer: HTMLElement | null;
}

const PluginDomBoundaryContext = createContext<PluginDomBoundary>({
  shadowRoot: null,
  portalContainer: null,
});

export const PluginDomBoundaryProvider = PluginDomBoundaryContext.Provider;

export function usePluginPage(): PluginPageData {
  const context = useContext(PluginPageContext);
  if (!context) {
    throw new Error('usePluginPage must be used within PluginPageContext.Provider');
  }
  return context;
}

export function usePluginRuntime() {
  return usePluginPage().runtime;
}

export function usePluginAgent() {
  const page = usePluginPage();
  return {
    ownerAgent: page.ownerAgent,
    connectedAgent: page.connectedAgent,
  };
}

export function usePluginShell() {
  return usePluginPage().shell;
}

export function usePluginShadowRoot(): ShadowRoot | null {
  return useContext(PluginDomBoundaryContext).shadowRoot;
}

export function usePluginPortalContainer(): HTMLElement | null {
  return useContext(PluginDomBoundaryContext).portalContainer;
}

export { isPluginCommandError };
