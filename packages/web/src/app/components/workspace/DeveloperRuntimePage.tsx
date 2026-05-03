import { useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

import { useAgentRuntime } from '../../../context/AgentRuntimeContext';
import { useAgents } from '../../../context/AgentsContext';
import { usePluginHost } from '../../../plugins/context';
import { useNotifications } from '../../notifications/NotificationProvider';
import { Button } from '../ui/Button';

export function DeveloperRuntimePage() {
  const { shadowAgent } = useAgents();
  const runtime = useAgentRuntime();
  const pluginHost = usePluginHost();
  const { notify } = useNotifications();
  const [busyAction, setBusyAction] = useState('');

  const run = async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
    setBusyAction(label);
    try {
      return await action();
    } catch (error) {
      notify({ type: 'error', message: error instanceof Error ? error.message : `${label} failed.` });
      return null;
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6 xl:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Developer only
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Runtime diagnostics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The old developer runtime page is preserved functionally inside the redesigned workspace shell. Use it to inspect runtime state, commands, and plugin diagnostics.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[32px] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Connection actions</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Shadow agent: {shadowAgent?.name ?? 'Not configured'}
              </p>
            </div>
            <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {runtime.status}
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Button className="justify-between rounded-2xl" disabled={!!busyAction} onClick={() => void run('Connect', runtime.connect)}>
              Connect
              <RefreshCw className={`size-4 ${busyAction === 'Connect' ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" className="justify-between rounded-2xl" disabled={!!busyAction} onClick={() => runtime.disconnect()}>
              Disconnect
              <RefreshCw className="size-4" />
            </Button>
            <Button variant="outline" className="rounded-2xl" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run('Refresh session', runtime.refreshSessionState)}>
              Refresh session
            </Button>
            <Button variant="outline" className="rounded-2xl" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run('Refresh locations', runtime.refreshLocations)}>
              Refresh locations
            </Button>
            <Button variant="outline" className="rounded-2xl" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run('Acquire action lease', runtime.acquireActionLease)}>
              Acquire action lease
            </Button>
            <Button variant="outline" className="rounded-2xl" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run('Release action lease', runtime.releaseActionLease)}>
              Release action lease
            </Button>
          </div>

          <div className="mt-6 min-h-[54px]">
            {runtime.error ? (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{runtime.error}</span>
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[32px] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <h2 className="text-lg font-semibold tracking-tight">Snapshot</h2>
          <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>Connected: {runtime.isConnected ? 'yes' : 'no'}</p>
            <p>Action lease present: {runtime.hasActionLease ? 'yes' : 'no'}</p>
            <p>Action lease holder: {runtime.isActionLeaseHolder ? 'this session' : 'other or none'}</p>
            <p>In city: {runtime.inCity ? 'yes' : 'no'}</p>
            <p>Current location: {runtime.currentLocation ?? 'outside'}</p>
            <p>Commands loaded: {runtime.discoveredCommands.length}</p>
            <p>Locations discovered: {runtime.discoveredLocations.length}</p>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[32px] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Discovered commands</h2>
            <Button variant="outline" className="rounded-2xl" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run('Refresh command summary', runtime.refreshCommands)}>
              Refresh
            </Button>
          </div>
          <div className="mt-6 max-h-[360px] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60">
            {runtime.commandGroups.length === 0 && runtime.discoveredCommands.length === 0 ? (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">No command metadata loaded yet.</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {runtime.commandGroups.map((group) => (
                  <article key={`${group.scope}:${group.pluginId ?? 'city'}`} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{group.label}</strong>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{group.commandCount}</span>
                    </div>
                  </article>
                ))}
                {runtime.discoveredCommands.map((command) => (
                  <article key={command.type} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{command.type}</strong>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{command.pluginName ?? 'core'}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{command.description}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[32px] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <h2 className="text-lg font-semibold tracking-tight">Plugin diagnostics</h2>
          <div className="mt-6 max-h-[360px] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/60">
            {(pluginHost.diagnostics.length + pluginHost.backendDiagnostics.length) === 0 ? (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">No plugin diagnostics reported.</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pluginHost.diagnostics.map((item, index) => (
                  <article key={`${item.pluginId}:${item.state}:${index}`} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{item.pluginId}</strong>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.state}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.message}</p>
                  </article>
                ))}
                {pluginHost.backendDiagnostics.map((item) => (
                  <article key={`backend:${item.pluginId ?? item.name}:${item.state}`} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{item.pluginId ?? item.name ?? 'unknown-plugin'}</strong>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.state}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.lastError ?? item.reason ?? 'Backend plugin OK'}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
