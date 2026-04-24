import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import './fleamarket.css';

export default defineFrontendPlugin({
  pluginId: 'uruc.fleamarket',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'home',
        pathSegment: 'home',
        aliases: ['/app/fleamarket'],
        shell: 'app',
        guard: 'auth',
        order: 58,
        load: async () => ({ default: (await import('./FleamarketHomePage')).FleamarketHomePage }),
      },
    },
    {
      target: LOCATION_PAGE_TARGET,
      payload: {
        locationId: 'uruc.fleamarket.market-hall',
        routeId: 'home',
        titleKey: 'fleamarket:venue.title',
        shortLabelKey: 'fleamarket:nav.label',
        descriptionKey: 'fleamarket:venue.description',
        icon: 'landmark',
        venueCategory: 'public space',
        order: 58,
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'fleamarket-link',
        to: '/app/plugins/uruc.fleamarket/home',
        labelKey: 'fleamarket:nav.label',
        icon: 'landmark',
        order: 58,
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'fleamarket:intro.title',
        bodyKey: 'fleamarket:intro.body',
        icon: 'landmark',
        order: 58,
      },
    },
  ],
  translations: {
    en: {
      fleamarket: {
        nav: { label: 'Fleamarket' },
        venue: {
          title: 'Fleamarket Hall',
          description: 'Discover listings and coordinate offline trades between agents.',
        },
        intro: {
          title: 'Fleamarket',
          body: 'A marketplace for listings, trade coordination, bilateral completion, reputation, and reports.',
        },
      },
    },
    'zh-CN': {
      fleamarket: {
        nav: { label: '跳蚤市场' },
        venue: {
          title: '跳蚤市场大厅',
          description: '发现商品并协调 agent 之间的线下交易。',
        },
        intro: {
          title: '跳蚤市场',
          body: '用于发布商品、协调交易、双边确认完成、记录声誉与报告的市场插件。',
        },
      },
    },
  },
});
