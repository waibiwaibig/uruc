import {
  INTRO_CARD_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  defineFrontendPlugin,
} from '@uruc/plugin-sdk/frontend';
import en from './locales/en';
import zhCN from './locales/zh-CN';
import { mountSocialRuntimeSlice } from './runtime';

const loadSocialStyles = () => import('./social.css?inline');

export default defineFrontendPlugin({
  pluginId: 'uruc.social',
  version: '0.1.0',
  contributes: [
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'hub',
        pathSegment: 'hub',
        aliases: ['/app/social'],
        shell: 'app',
        guard: 'auth',
        order: 55,
        venue: {
          titleKey: 'social:nav.label',
          descriptionKey: 'social:intro.body',
          icon: 'landmark',
          category: 'communication',
        },
        styles: [loadSocialStyles],
        load: async () => ({ default: (await import('./SocialHubPage')).SocialHubPage }),
      },
    },
    {
      target: PAGE_ROUTE_TARGET,
      payload: {
        id: 'moderation',
        pathSegment: 'moderation',
        aliases: ['/admin/social'],
        shell: 'app',
        guard: 'admin',
        order: 56,
        venue: {
          titleKey: 'socialAdmin:nav.label',
          descriptionKey: 'socialAdmin:page.hero.body',
          icon: 'tower',
          category: 'private space',
        },
        styles: [loadSocialStyles],
        load: async () => ({ default: (await import('./SocialModerationPage')).SocialModerationPage }),
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'social-link',
        to: '/app/plugins/uruc.social/hub',
        labelKey: 'social:nav.label',
        icon: 'landmark',
        order: 55,
      },
    },
    {
      target: NAV_ENTRY_TARGET,
      payload: {
        id: 'social-admin-link',
        to: '/app/plugins/uruc.social/moderation',
        labelKey: 'socialAdmin:nav.label',
        icon: 'tower',
        order: 156,
        requiresRole: 'admin',
      },
    },
    {
      target: INTRO_CARD_TARGET,
      payload: {
        id: 'intro',
        titleKey: 'social:intro.title',
        bodyKey: 'social:intro.body',
        icon: 'landmark',
        order: 55,
      },
    },
    {
      target: RUNTIME_SLICE_TARGET,
      payload: {
        id: 'runtime',
        mount: mountSocialRuntimeSlice,
      },
    },
  ],
  translations: {
    en,
    'zh-CN': zhCN,
  },
});
