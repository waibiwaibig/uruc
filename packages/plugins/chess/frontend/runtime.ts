import type { PluginRuntimeApi } from '@uruc/plugin-sdk/frontend';
import i18n from 'i18next';

export function mountChessRuntimeSlice(api: PluginRuntimeApi) {
  const unsubscribers = [
    api.subscribe('chess_welcome', () => {
      api.reportEvent(i18n.t('chess:events.entered'));
    }),
    api.subscribe('chess_lobby_delta', (payload) => {
      const eventName = (payload as { kind?: string } | undefined)?.kind ?? 'room_updated';
      api.reportEvent(i18n.t('chess:events.lobbyUpdate', { eventName }));
    }),
    api.subscribe('chess_match_delta', (payload) => {
      const eventName = (payload as { kind?: string } | undefined)?.kind ?? 'match_update';
      api.reportEvent(i18n.t('chess:events.matchUpdate', { eventName }));
    }),
    api.subscribe('chess_reconnected', () => {
      api.reportEvent(i18n.t('chess:events.restored'));
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
