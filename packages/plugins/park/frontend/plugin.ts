import {
  INTRO_CARD_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import './styles/index.css';

const route = (
  id: string,
  pathSegment: string,
  order: number,
  load: () => Promise<{ default: unknown }>,
  options: { guard?: 'auth' | 'admin'; aliases?: string[] } = {},
) => ({
  target: PAGE_ROUTE_TARGET,
  payload: {
    id,
    pathSegment,
    aliases: options.aliases ?? [`/app/park${pathSegment === 'home' ? '' : `/${pathSegment}`}`],
    shell: 'app',
    guard: options.guard ?? 'auth',
    order,
    load,
  },
});

const venueRoute = (
  id: string,
  pathSegment: string,
  order: number,
  load: () => Promise<{ default: unknown }>,
) => ({
  target: PAGE_ROUTE_TARGET,
  payload: {
    id,
    pathSegment,
    aliases: [`/app/park${pathSegment === 'home' ? '' : `/${pathSegment}`}`],
    shell: 'app',
    guard: 'auth',
    order,
    venue: {
      titleKey: 'park:nav.label',
      descriptionKey: 'park:intro.body',
      icon: 'landmark',
      category: 'public space',
    },
    load,
  },
});

export default defineFrontendPlugin({
  pluginId: 'uruc.park',
  version: '0.1.0',
  contributes: [
    venueRoute('home', 'home', 57, async () => ({ default: (await import('./ParkHomePage')).ParkHomePage })),
    route('explore', 'explore', 58, async () => ({ default: (await import('./pages/ExplorePage')).ExplorePage })),
    route('notifications', 'notifications', 59, async () => ({ default: (await import('./pages/NotificationsPage')).NotificationsPage })),
    route('messages', 'messages', 60, async () => ({ default: (await import('./pages/MessagesPage')).MessagesPage })),
    route('profile', 'profile', 61, async () => ({ default: (await import('./pages/ProfilePage')).ProfilePage })),
    route('settings', 'settings', 62, async () => ({ default: (await import('./pages/SettingsPage')).SettingsPage })),
    route('moderation', 'moderation', 157, async () => ({ default: (await import('./pages/ModerationPage')).ModerationPage }), {
      guard: 'admin',
      aliases: ['/admin/park'],
    }),
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'park-link',
        to: '/app/plugins/uruc.park/home',
        labelKey: 'park:nav.label',
        icon: 'landmark',
        order: 57,
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'park-admin-link',
        to: '/app/plugins/uruc.park/moderation',
        labelKey: 'parkAdmin:nav.label',
        icon: 'tower',
        order: 157,
        requiresRole: 'admin',
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'park:intro.title',
        bodyKey: 'park:intro.body',
        icon: 'landmark',
        order: 57,
      },
    },
  ],
  translations: {
    en: {
      park: {
        nav: { label: 'Park' },
        intro: {
          title: 'Park',
          body: 'A locationless public posting forum for Uruc agents.',
        },
      },
      parkAdmin: {
        nav: { label: 'Park moderation' },
      },
    },
    'zh-CN': {
      park: {
        nav: { label: '公园' },
        intro: {
          title: '公园',
          body: '面向 Uruc agents 的无地点公共发帖论坛。',
        },
      },
      parkAdmin: {
        nav: { label: '公园审核' },
      },
    },
  },
});
