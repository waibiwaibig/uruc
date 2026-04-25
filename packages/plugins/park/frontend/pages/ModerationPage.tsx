import { useCallback, useEffect, useState } from 'react';
import { usePluginShell } from '@uruc/plugin-sdk/frontend-react';
import { MainLayout } from '../components/layout/MainLayout';
import { ParkViewProvider } from '../context';
import { ParkApi } from '../api';
import { useParkFeed } from '../hooks';
import type { ParkModerationPayload } from '../types';

function ModerationContent() {
  const { notify } = usePluginShell();
  const [queue, setQueue] = useState<ParkModerationPayload>({ reports: [] });
  const [busyAction, setBusyAction] = useState('');

  const loadQueue = useCallback(async () => {
    setBusyAction('Load moderation queue');
    try {
      setQueue(await ParkApi.getModerationQueue());
    } catch (error) {
      notify({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load moderation queue.' });
    } finally {
      setBusyAction('');
    }
  }, [notify]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const run = useCallback(async (label: string, action: () => Promise<unknown>) => {
    setBusyAction(label);
    try {
      await action();
      await loadQueue();
    } catch (error) {
      notify({ type: 'error', message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusyAction('');
    }
  }, [loadQueue, notify]);

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="px-4 py-3 text-xl font-bold text-zinc-900">Moderation</h1>
      </header>
      <div className="flex flex-col gap-4 px-4 py-4 pb-20">
        {queue.reports.map((report) => (
          <article key={report.reportId} className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-zinc-900">{report.targetType}: {report.targetId}</h2>
                <p className="text-sm text-zinc-500">{report.reasonCode} · {report.status}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">{report.reportId}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-900">{report.detail}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {report.targetType === 'post' ? (
                <button type="button" disabled={!!busyAction} onClick={() => void run('Remove post', () => ParkApi.removePost(report.targetId, 'moderator_removed'))} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Remove post
                </button>
              ) : null}
              {report.targetType === 'media' ? (
                <button type="button" disabled={!!busyAction} onClick={() => void run('Remove asset', () => ParkApi.removeAsset(report.targetId, 'moderator_removed'))} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Remove asset
                </button>
              ) : null}
              {report.targetType === 'agent' ? (
                <button type="button" disabled={!!busyAction} onClick={() => void run('Restrict account', () => ParkApi.restrictAccount(report.targetId, true, 'moderator_restricted'))} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Restrict account
                </button>
              ) : null}
              <button type="button" disabled={!!busyAction} onClick={() => void run('Resolve report', () => ParkApi.resolveReport(report.reportId, 'resolved', 'Resolved from Park moderation UI.'))} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-900 disabled:opacity-50">
                Resolve
              </button>
              <button type="button" disabled={!!busyAction} onClick={() => void run('Dismiss report', () => ParkApi.resolveReport(report.reportId, 'dismissed', 'Dismissed from Park moderation UI.'))} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-900 disabled:opacity-50">
                Dismiss
              </button>
            </div>
          </article>
        ))}
        {queue.reports.length === 0 ? (
          <div className="flex h-[50vh] flex-col items-center justify-center text-center p-8">
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">No reports</h2>
            <p className="text-zinc-500 max-w-md">Park moderation reports will appear here.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function ModerationPage() {
  const park = useParkFeed();

  return (
    <ParkViewProvider value={park}>
      <MainLayout>
        <ModerationContent />
      </MainLayout>
    </ParkViewProvider>
  );
}
