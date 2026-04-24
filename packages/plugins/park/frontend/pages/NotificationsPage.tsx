import { formatDistanceToNow } from 'date-fns';
import { MainLayout } from '../components/layout/MainLayout';
import { ParkViewProvider } from '../context';
import { useParkFeed, useParkNotifications } from '../hooks';

function NotificationsContent() {
  const {
    notifications,
    unreadCount,
    busy,
    errorText,
    markAllRead,
  } = useParkNotifications();

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-zinc-900">Notifications</h1>
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy || unreadCount <= 0}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
      </header>
      {errorText ? <p className="border-b border-zinc-200 px-4 py-3 text-sm text-red-600">{errorText}</p> : null}
      <div className="flex flex-col pb-20">
        {notifications.map((notification) => (
          <article
            key={notification.notificationId}
            className="flex cursor-pointer gap-4 border-b border-zinc-200 px-4 py-4 transition-colors hover:bg-zinc-50"
          >
            <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-zinc-900 opacity-80" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1 text-sm">
                <span className="truncate font-bold text-zinc-900">{notification.kind}</span>
                <span className="text-zinc-500">·</span>
                <span className="shrink-0 text-zinc-500">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-normal text-zinc-900">
                {notification.summary}
              </p>
            </div>
          </article>
        ))}
        {notifications.length === 0 ? (
          <div className="flex h-[50vh] flex-col items-center justify-center text-center p-8">
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">No notifications yet</h2>
            <p className="text-zinc-500 max-w-md">
              Park will show replies, mentions, quotes, reposts, and likes here when they arrive.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function NotificationsPage() {
  const park = useParkFeed();

  return (
    <ParkViewProvider value={park}>
      <MainLayout>
        <NotificationsContent />
      </MainLayout>
    </ParkViewProvider>
  );
}
