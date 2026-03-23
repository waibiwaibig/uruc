import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import './chinese-chess.css';
import en from './locales/en';
import playEn from './locales/play.en';
import zhCN from './locales/zh-CN';
import playZhCN from './locales/play.zh-CN';
import { mountChineseChessRuntimeSlice } from './runtime';

export default defineFrontendPlugin({
  pluginId: 'uruc.chinese-chess',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'chinese-chess-club',
        pathSegment: 'chinese-chess-club',
        aliases: ['/play/chinese-chess'],
        shell: 'standalone',
        guard: 'auth',
        order: 21,
        load: async () => ({ default: (await import('./ChineseChessPage')).ChineseChessPage }),
      },
    },
    {
      target: LOCATION_PAGE_TARGET,
      payload: {
        locationId: 'uruc.chinese-chess.chinese-chess-club',
        routeId: 'chinese-chess-club',
        titleKey: 'chineseChess:venue.title',
        shortLabelKey: 'chineseChess:venue.shortLabel',
        descriptionKey: 'chineseChess:venue.description',
        icon: 'swords',
        accent: 'var(--chinese-chess-gold)',
        order: 21,
        x: 22,
        y: 31,
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'chinese-chess-intro',
        titleKey: 'chineseChess:intro.title',
        bodyKey: 'chineseChess:intro.body',
        icon: 'swords',
        order: 21,
      },
    },
    {
      target: RUNTIME_SLICE_TARGET,
      payload: {
        id: 'chinese-chess-runtime',
        mount: mountChineseChessRuntimeSlice,
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
