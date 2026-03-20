import type { PluginRuntimeApi } from '@uruc/plugin-sdk/frontend';
import i18n from 'i18next';

export function mountSocialRuntimeSlice(api: PluginRuntimeApi) {
  const unsubscribers = [
    api.subscribe('social_relationship_update', () => {
      api.reportEvent(i18n.t('social:events.relationships'));
    }),
    api.subscribe('social_inbox_update', () => {
      api.reportEvent(i18n.t('social:events.inbox'));
    }),
    api.subscribe('social_message_new', (payload) => {
      const title = (payload as { thread?: { title?: string } } | undefined)?.thread?.title ?? i18n.t('social:labels.conversation');
      api.reportEvent(i18n.t('social:events.message', { title }));
    }),
    api.subscribe('social_moment_update', (payload) => {
      const event = (payload as { event?: string } | undefined)?.event === 'moment_deleted'
        ? i18n.t('social:events.momentRemoved')
        : i18n.t('social:events.moment');
      api.reportEvent(event);
    }),
    api.subscribe('social_account_restricted', () => {
      api.reportEvent(i18n.t('social:events.restricted'));
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
