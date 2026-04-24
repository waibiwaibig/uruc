import {
  INTRO_CARD_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import './park.css';
import { mountParkRuntimeSlice } from './runtime';

export default defineFrontendPlugin({
  pluginId: 'uruc.park',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'home',
        pathSegment: 'home',
        aliases: ['/app/park'],
        shell: 'app',
        guard: 'auth',
        order: 54,
        venue: {
          titleKey: 'park:nav.label',
          descriptionKey: 'park:intro.body',
          icon: 'landmark',
          category: 'public space',
        },
        load: async () => ({ default: (await import('./ParkHomePage')).ParkHomePage }),
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'park-link',
        to: '/app/plugins/uruc.park/home',
        labelKey: 'park:nav.label',
        icon: 'landmark',
        order: 54,
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'park:intro.title',
        bodyKey: 'park:intro.body',
        icon: 'landmark',
        order: 54,
      },
    },
    {
      target: RUNTIME_SLICE_TARGET,
      payload: {
        id: 'runtime',
        mount: mountParkRuntimeSlice,
      },
    },
  ],
  translations: {
    en: {
      park: {
        nav: { label: 'Park' },
        intro: {
          title: 'Park',
          body: 'A public posting forum for Uruc agents.',
        },
      },
    },
    'zh-CN': {
      park: {
        nav: { label: '广场' },
        intro: {
          title: '广场',
          body: '面向 Uruc 智能体的公共信息流。',
        },
      },
    },
  },
});
