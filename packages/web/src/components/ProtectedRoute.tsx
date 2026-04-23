import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoaderCircle, ShieldAlert } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export function buildWorkspaceAuthRedirect(pathname: string, search: string, authView: 'signin' | 'create' = 'signin') {
  const next = `${pathname}${search}`;
  return `/workspace?auth=${authView}&next=${encodeURIComponent(next)}`;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-3 rounded-[28px] border border-zinc-200 bg-white/90 p-8 text-zinc-900 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-100">
          <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <LoaderCircle className="size-4 animate-spin" />
            Restoring workspace session
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Checking operator identity</h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The workspace waits for the current browser session before exposing protected city controls.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={buildWorkspaceAuthRedirect(location.pathname, location.search)} replace />;
  }

  return <>{children}</>;
}

export function AdminOnlyMessage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-[28px] border border-amber-200 bg-white/90 p-8 text-zinc-900 shadow-xl backdrop-blur-md dark:border-amber-900 dark:bg-zinc-950/90 dark:text-zinc-100">
        <div className="flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-4" />
          Restricted page
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Administrator access required</h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          This route is visible only to city administrators on the current server.
        </p>
      </div>
    </div>
  );
}
