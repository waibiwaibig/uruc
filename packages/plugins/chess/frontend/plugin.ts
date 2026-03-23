import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import './chess.css';
import en from './locales/en';
import playEn from './locales/play.en';
import zhCN from './locales/zh-CN';
import playZhCN from './locales/play.zh-CN';
import { mountChessRuntimeSlice } from './runtime';

export default defineFrontendPlugin({
  pluginId: 'uruc.chess',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'hall',
        pathSegment: 'hall',
        aliases: ['/play/chess'],
        shell: 'standalone',
        guard: 'auth',
        order: 20,
        load: async () => ({ default: (await import('./ChessPage')).ChessPage }),
      },
    },
    {
      target: LOCATION_PAGE_TARGET,
      payload: {
        locationId: 'uruc.chess.chess-club',
        routeId: 'hall',
        titleKey: 'chess:venue.title',
        shortLabelKey: 'chess:venue.shortLabel',
        descriptionKey: 'chess:venue.description',
        icon: 'swords',
        accent: 'var(--city-node-royal)',
        order: 20,
        x: 20,
        y: 28,
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'chess:intro.title',
        bodyKey: 'chess:intro.body',
        icon: 'swords',
        order: 20,
      },
    },
    {
      target: RUNTIME_SLICE_TARGET,
      payload: {
        id: 'runtime',
        mount: mountChessRuntimeSlice,
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
