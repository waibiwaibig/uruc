import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import type { NotificationRequest, NotificationType } from '@uruc/plugin-sdk/frontend';

interface NotificationItem extends NotificationRequest {
  id: string;
  createdAt: number;
}

interface NotificationContextValue {
  notify: (notification: NotificationRequest) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATIONS: Record<NotificationType, number | null> = {
  success: 4500,
  info: 4500,
  warning: 10000,
  error: null,
};

const typeStyles: Record<NotificationType, string> = {
  success: 'border-emerald-500/25 bg-emerald-50/85 text-emerald-950 shadow-emerald-950/10 dark:border-emerald-400/20 dark:bg-emerald-950/70 dark:text-emerald-50',
  info: 'border-sky-500/25 bg-sky-50/85 text-sky-950 shadow-sky-950/10 dark:border-sky-400/20 dark:bg-sky-950/70 dark:text-sky-50',
  warning: 'border-amber-500/30 bg-amber-50/90 text-amber-950 shadow-amber-950/10 dark:border-amber-400/25 dark:bg-amber-950/75 dark:text-amber-50',
  error: 'border-rose-500/30 bg-rose-50/90 text-rose-950 shadow-rose-950/10 dark:border-rose-400/25 dark:bg-rose-950/75 dark:text-rose-50',
};

const iconStyles: Record<NotificationType, string> = {
  success: 'text-emerald-600 dark:text-emerald-300',
  info: 'text-sky-600 dark:text-sky-300',
  warning: 'text-amber-600 dark:text-amber-300',
  error: 'text-rose-600 dark:text-rose-300',
};

function notificationIcon(type: NotificationType) {
  if (type === 'success') return CheckCircle2;
  if (type === 'warning') return AlertTriangle;
  if (type === 'error') return XCircle;
  return Info;
}

function notificationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback((notification: NotificationRequest) => {
    const id = notificationId();
    const next: NotificationItem = {
      ...notification,
      id,
      createdAt: Date.now(),
    };
    setNotifications((current) => [next, ...current].slice(0, 6));
    if (notification.type === 'warning' || notification.type === 'error') {
      setAssertiveMessage(notification.message);
    }
    return id;
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    notify,
    dismiss,
  }), [dismiss, notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        data-uruc-notification-assertive
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
      <div
        data-uruc-notification-viewport
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3 sm:right-6 sm:top-6"
      >
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  const duration = notification.durationMs ?? DEFAULT_DURATIONS[notification.type];
  const Icon = notificationIcon(notification.type);

  useEffect(() => {
    if (duration === null) return undefined;
    const timer = window.setTimeout(() => onDismiss(notification.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, notification.id, onDismiss]);

  return (
    <article
      role={notification.type === 'error' || notification.type === 'warning' ? 'alert' : 'status'}
      data-uruc-notification-type={notification.type}
      className={`pointer-events-auto flex translate-y-0 items-start gap-3 rounded-2xl border px-4 py-3 text-sm opacity-100 shadow-xl backdrop-blur-xl transition-[opacity,transform] duration-200 ${typeStyles[notification.type]}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconStyles[notification.type]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {notification.title ? (
          <strong className="block text-sm font-semibold leading-5">{notification.title}</strong>
        ) : null}
        <p className="m-0 break-words leading-5">{notification.message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(notification.id)}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-current opacity-70 transition-[opacity,transform] hover:scale-105 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/30"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </article>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
