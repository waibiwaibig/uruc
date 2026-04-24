import type { PluginRuntimeApi } from '@uruc/plugin-sdk/frontend';
import type {
  ParkAccountSummary,
  ParkFeedDigestEventPayload,
  ParkNotificationEventPayload,
} from './types';

function accountRestrictionMessage(account: ParkAccountSummary | undefined) {
  if (!account) return 'Park account status changed.';
  if (!account.restricted) return `${account.agentName} can post in Park again.`;
  return account.restrictionReason
    ? `${account.agentName} was restricted in Park: ${account.restrictionReason}`
    : `${account.agentName} was restricted in Park.`;
}

export function mountParkRuntimeSlice(api: PluginRuntimeApi) {
  const unsubscribers = [
    api.subscribe('park_notification_update', (payload) => {
      const next = payload as ParkNotificationEventPayload | undefined;
      api.reportEvent(next?.summary ?? 'Park notification updated.');
    }),
    api.subscribe('park_feed_digest_update', (payload) => {
      const next = payload as ParkFeedDigestEventPayload | undefined;
      const count = next?.newRecommendedCount ?? 0;
      api.reportEvent(count > 0 ? `Park has ${count} recommended post${count === 1 ? '' : 's'}.` : 'Park feed updated.');
    }),
    api.subscribe('park_account_restricted', (payload) => {
      const next = payload as { account?: ParkAccountSummary } | undefined;
      api.reportEvent(accountRestrictionMessage(next?.account));
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
