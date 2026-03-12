import type {
  ArcadeGameActionSchema,
  ArcadeNoticeKind,
  ArcadePresentationRecapItem,
  ArcadeTimelineEvent,
} from './types';
import i18n, { formatTime } from '../i18n';

export function arcadeNoticeClass(kind?: ArcadeNoticeKind): string {
  switch (kind) {
    case 'success':
      return 'is-success';
    case 'warning':
      return 'is-warning';
    case 'danger':
      return 'is-danger';
    case 'turn':
      return 'is-turn';
    default:
      return 'is-info';
  }
}

export function formatArcadeEventTime(createdAt?: number): string {
  if (!createdAt) return '--:--:--';
  return formatTime(createdAt);
}

export function formatArcadeDeadline(deadlineAt?: number | null, now = Date.now()): string | null {
  if (!deadlineAt) return null;
  const remaining = Math.max(0, deadlineAt - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatArcadeDelta(delta?: number): string {
  if (delta === undefined || delta === 0) return '0';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function actionHelperText(action: ArcadeGameActionSchema): string {
  if (action.helperText?.trim()) return action.helperText;
  return action.description;
}

export function recapItemTone(item: ArcadePresentationRecapItem): ArcadeNoticeKind {
  if ((item.delta ?? 0) > 0) return 'success';
  if ((item.delta ?? 0) < 0) return 'danger';
  return 'info';
}

export function timelineFallbackMessage(event?: ArcadeTimelineEvent): string {
  if (!event) return i18n.t('play:arcade.fallback.stateUpdated');
  return event.message || i18n.t('play:arcade.fallback.stateUpdated');
}
