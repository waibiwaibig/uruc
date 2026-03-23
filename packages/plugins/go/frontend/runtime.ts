import type { PluginRuntimeApi } from '@uruc/plugin-sdk/frontend';
import i18n from 'i18next';

export function mountGoRuntimeSlice(api: PluginRuntimeApi) {
  const unsubscribers = [
    api.subscribe('go_welcome', () => {
      api.reportEvent(i18n.t('go:events.entered'));
    }),
    api.subscribe('go_lobby_delta', (payload) => {
      const eventName = (payload as { kind?: string } | undefined)?.kind ?? 'room_updated';
      api.reportEvent(i18n.t('go:events.lobbyUpdate', { eventName }));
    }),
    api.subscribe('go_match_delta', (payload) => {
      const eventName = (payload as { kind?: string } | undefined)?.kind ?? 'match_update';
      api.reportEvent(i18n.t('go:events.matchUpdate', { eventName }));
    }),
    api.subscribe('go_reconnected', () => {
      api.reportEvent(i18n.t('go:events.restored'));
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
