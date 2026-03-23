import type { PluginRuntimeApi } from '@uruc/plugin-sdk/frontend';
import i18n from 'i18next';

export function mountChineseChessRuntimeSlice(api: PluginRuntimeApi) {
  const unsubscribers = [
    api.subscribe('chinese_chess_welcome', () => {
      api.reportEvent(i18n.t('chineseChess:events.entered'));
    }),
    api.subscribe('chinese_chess_lobby_delta', (payload) => {
      const eventName = (payload as { kind?: string } | undefined)?.kind ?? 'room_updated';
      api.reportEvent(i18n.t('chineseChess:events.lobbyUpdate', { eventName }));
    }),
    api.subscribe('chinese_chess_match_delta', (payload) => {
      const eventName = (payload as { kind?: string } | undefined)?.kind ?? 'match_update';
      api.reportEvent(i18n.t('chineseChess:events.matchUpdate', { eventName }));
    }),
    api.subscribe('chinese_chess_reconnected', () => {
      api.reportEvent(i18n.t('chineseChess:events.restored'));
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
