import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import './go.css';
import en from './locales/en';
import playEn from './locales/play.en';
import zhCN from './locales/zh-CN';
import playZhCN from './locales/play.zh-CN';
import { mountGoRuntimeSlice } from './runtime';

export default defineFrontendPlugin({
  pluginId: 'uruc.go',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'hall',
        pathSegment: 'hall',
        aliases: ['/play/go'],
        shell: 'standalone',
        guard: 'auth',
        order: 21,
        load: async () => ({ default: (await import('./GoPage')).GoPage }),
      },
    },
    {
      target: LOCATION_PAGE_TARGET,
      payload: {
        locationId: 'uruc.go.go-club',
        routeId: 'hall',
        titleKey: 'go:venue.title',
        shortLabelKey: 'go:venue.shortLabel',
        descriptionKey: 'go:venue.description',
        icon: 'landmark',
        accent: 'var(--city-node-ember)',
        order: 21,
        x: 42,
        y: 18,
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'go:intro.title',
        bodyKey: 'go:intro.body',
        icon: 'landmark',
        order: 21,
      },
    },
    {
      target: RUNTIME_SLICE_TARGET,
      payload: {
        id: 'runtime',
        mount: mountGoRuntimeSlice,
      },
    },
  ],
  translations: {
    en: {
      ...en,
      play: playEn,
    },
    'zh-CN': {
      ...zhCN,
      play: playZhCN,
    },
  },
});
