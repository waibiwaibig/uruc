import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import * as ReactJsxDevRuntime from 'react/jsx-dev-runtime';
import i18next from 'i18next';
import * as LucideReact from 'lucide-react';
import * as ReactI18next from 'react-i18next';
import * as ReactRouterDom from 'react-router-dom';
import * as UrucPluginSdkFrontend from '@uruc/plugin-sdk/frontend';
import * as UrucPluginSdkFrontendReact from '@uruc/plugin-sdk/frontend-react';
import * as UrucPluginSdkFrontendHttp from '@uruc/plugin-sdk/frontend-http';

declare global {
  interface Window {
    __uruc_plugin_globals?: {
      React: typeof React;
      ReactDOM: typeof ReactDOM;
      ReactJsxRuntime: typeof ReactJsxRuntime;
      ReactJsxDevRuntime: typeof ReactJsxDevRuntime;
      I18next: typeof i18next;
      LucideReact: typeof LucideReact;
      ReactI18next: typeof ReactI18next;
      ReactRouterDom: typeof ReactRouterDom;
      UrucPluginSdkFrontend: typeof UrucPluginSdkFrontend;
      UrucPluginSdkFrontendReact: typeof UrucPluginSdkFrontendReact;
      UrucPluginSdkFrontendHttp: typeof UrucPluginSdkFrontendHttp;
    };
    __uruc_plugin_exports?: Record<string, unknown>;
  }
}

export function installPluginRuntimeGlobals(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__uruc_plugin_globals = {
    React,
    ReactDOM,
    ReactJsxRuntime,
    ReactJsxDevRuntime,
    I18next: i18next,
    LucideReact,
    ReactI18next,
    ReactRouterDom,
    UrucPluginSdkFrontend,
    UrucPluginSdkFrontendReact,
    UrucPluginSdkFrontendHttp,
  };
  window.__uruc_plugin_exports ??= {};
}
