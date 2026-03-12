import { AlertTriangle, Info, WifiOff, X, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type ArcadeToastTone = 'error' | 'warning' | 'info';

export type ArcadeStatusToastItem = {
  id: string;
  tone: ArcadeToastTone;
  title: string;
  body: string;
  durationMs?: number | null;
  onDismiss?: () => void;
};

function toastIcon(tone: ArcadeToastTone, title: string): LucideIcon {
  if (tone === 'info') return Info;
  if (/连接|链路|socket|websocket|link|connection/i.test(title)) return WifiOff;
  return AlertTriangle;
}

export function ArcadeStatusToasts({ items }: { items: ArcadeStatusToastItem[] }) {
  const { t } = useTranslation('play');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    const liveIds = new Set(items.map((item) => item.id));
    setDismissedIds((prev) => prev.filter((id) => liveIds.has(id)));
  }, [items]);

  useEffect(() => {
    const timers = items
      .filter((item) => item.durationMs && !dismissedIds.includes(item.id))
      .map((item) => window.setTimeout(() => {
        setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
        item.onDismiss?.();
      }, item.durationMs ?? 0));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissedIds, items]);

  const visibleItems = items.filter((item) => !dismissedIds.includes(item.id));
  if (!visibleItems.length) return null;

  return (
    <div className="arcade-toast-stack" role="region" aria-label={t('arcade.table.feedTitle')}>
      {visibleItems.map((item) => {
        const Icon = toastIcon(item.tone, item.title);
        return (
          <section key={item.id} className={`arcade-toast arcade-toast--${item.tone}`} role="alert" aria-live="polite">
            <span className="arcade-toast__icon"><Icon size={18} /></span>
            <div className="arcade-toast__copy">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
            <button
              className="arcade-toast__close"
              type="button"
              aria-label={t('common:actions.close')}
              onClick={() => {
                setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                item.onDismiss?.();
              }}
            >
              <X size={14} />
            </button>
          </section>
        );
      })}
    </div>
  );
}
