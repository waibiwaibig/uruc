import { createContext, useContext, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Crown, Landmark, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import { useAgents } from '../context/AgentsContext';
import { LanguageToggle } from './LanguageToggle';

const GameShellToolbarContext = createContext<HTMLDivElement | null>(null);

function statusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case 'connecting':
      return t('runtime:wsStatus.connecting');
    case 'authenticating':
      return t('runtime:wsStatus.authenticating');
    case 'syncing':
      return t('runtime:wsStatus.syncing');
    case 'reconnecting':
      return t('runtime:wsStatus.reconnecting');
    case 'connected':
      return t('runtime:wsStatus.connected');
    case 'error':
      return t('runtime:wsStatus.error');
    case 'closed':
      return t('runtime:wsStatus.closed');
    default:
      return t('runtime:wsStatus.idle');
  }
}

export function GameShell() {
  const { t } = useTranslation(['runtime', 'play', 'dashboard']);
  const runtime = useAgentRuntime();
  const { shadowAgent } = useAgents();
  const [toolbarNode, setToolbarNode] = useState<HTMLDivElement | null>(null);
  const controlLabel =
    runtime.isController
      ? null
      : runtime.hasController
        ? t('runtime:gameShell.elsewhere')
        : t('runtime:gameShell.idle');
  const connectedAgentName = runtime.agentSession?.agentName ?? shadowAgent?.name ?? null;
  const connectedAgentId = runtime.agentSession?.agentId ?? shadowAgent?.id ?? null;

  return (
    <GameShellToolbarContext.Provider value={toolbarNode}>
      <div className="game-shell">
        <header className="game-shell__header">
          <div className="game-shell__brand">
            <span className="brand-mark brand-mark--compact" />
            <div className="brand-copy">
              <span className="brand-title">Uruc</span>
              <span className="brand-subtitle">immersive city runtime</span>
            </div>
          </div>

          <div className="game-shell__page" ref={setToolbarNode} />

          <div className="game-shell__status">
            <span className="status-chip status-chip--accent"><Landmark size={14} /> {statusLabel(t, runtime.status)}</span>
            {controlLabel ? <span className="status-chip"><ShieldCheck size={14} /> {controlLabel}</span> : null}
            {connectedAgentName ? <span className="status-chip"><Crown size={14} /> {connectedAgentName}</span> : null}
            {connectedAgentId ? <span className="status-chip mono">{connectedAgentId.slice(0, 8)}</span> : null}
            {shadowAgent ? <span className="status-chip">{t('dashboard:agents.primaryIdentity')}</span> : null}
            <LanguageToggle />
          </div>
        </header>

        <main className="game-shell__main">
          <Outlet />
        </main>
      </div>
    </GameShellToolbarContext.Provider>
  );
}

export function useGameShellToolbar() {
  return useContext(GameShellToolbarContext);
}
