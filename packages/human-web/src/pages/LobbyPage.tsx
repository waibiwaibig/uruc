import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, DoorOpen, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import { prepareGameWindow } from '../lib/game-window';

function statusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case 'connected':
      return t('dashboard:lobby.connectionStatusConnected');
    case 'error':
      return t('dashboard:lobby.connectionStatusError');
    case 'closed':
      return t('dashboard:lobby.connectionStatusClosed');
    default:
      return t('dashboard:lobby.connectionStatusDefault');
  }
}

export function LobbyPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { selectedAgent } = useAgents();
  const runtime = useAgentRuntime();
  const navigate = useNavigate();

  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [fallbackPath, setFallbackPath] = useState<string | null>(null);

  const run = async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    try {
      return await action();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : t('dashboard:lobby.openGameError'));
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const openPreparedGame = async (targetPath: string) => {
    const prepared = prepareGameWindow();
    if (!prepared) {
      setFallbackPath(targetPath);
      return false;
    }
    prepared.navigate(targetPath);
    return true;
  };

  const enterGame = () => run(t('dashboard:lobby.actionOpenGame'), async () => {
    if (!selectedAgent) {
      throw new Error(t('dashboard:lobby.chooseAgentError'));
    }

    const targetPath = '/play?autostart=1';
    setFallbackPath(null);
    const opened = await openPreparedGame(targetPath);
    if (opened && runtime.isConnected) {
      runtime.disconnect();
    }
  });

  const refreshRuntime = () => run(t('dashboard:lobby.actionRefresh'), async () => {
    if (runtime.isConnected) {
      await runtime.refreshCommands();
      return;
    }
    await runtime.connect();
  });

  const flowSteps = [
    {
      title: t('dashboard:lobby.stepInstallTitle'),
      body: t('dashboard:lobby.stepInstallBody'),
    },
    {
      title: t('dashboard:lobby.stepCreateTitle'),
      body: t('dashboard:lobby.stepCreateBody'),
    },
    {
      title: t('dashboard:lobby.stepShareTitle'),
      body: t('dashboard:lobby.stepShareBody'),
    },
    {
      title: t('dashboard:lobby.stepEnterTitle'),
      body: t('dashboard:lobby.stepEnterBody'),
    },
  ];

  return (
    <div className="page-wrap lobby-layout">
      <section className="card card-hero lobby-stage">
        <div className="stack-lg content-narrow">
          <div className="stack-md">
            <p className="kicker">human lobby</p>
            <h1 className="hero-title lobby-title">{t('dashboard:lobby.title')}</h1>
            <p className="section-sub lobby-copy">{t('dashboard:lobby.subtitle')}</p>
          </div>

          <div className="lobby-stage__status">
            <div className="pill-row">
              <span className="status-chip status-chip--accent"><ShieldCheck size={14} /> {statusLabel(t, runtime.status)}</span>
              <span className="status-chip">{t('dashboard:lobby.controlStatus')}: {runtime.isController ? t('dashboard:lobby.controlActive') : runtime.hasController ? t('dashboard:lobby.controlElsewhere') : t('dashboard:lobby.controlIdle')}</span>
              <span className="status-chip">{t('dashboard:lobby.roleStatus')}</span>
            </div>
            <button
              className="app-btn ghost lobby-refresh-btn"
              disabled={!!busyAction || (!selectedAgent && !runtime.isConnected)}
              onClick={refreshRuntime}
            >
              <span className="row"><RefreshCw size={14} /> {t('dashboard:lobby.actionRefresh')}</span>
            </button>
          </div>
        </div>

        <div className="lobby-stage__aside card card-muted">
          <div className="stack-md">
            <div className="panel-head lobby-assignment-head">
              <div className="panel-copy">
                <p className="section-label">current assignment</p>
                <h2 className="title-card">{t('dashboard:lobby.currentAssignmentTitle')}</h2>
              </div>
              {selectedAgent ? (
                <div className="lobby-assignment-head__meta">
                  <strong>{selectedAgent.name}</strong>
                  <span className="info-pill mono" title={selectedAgent.id}>{selectedAgent.id.slice(0, 8)}</span>
                </div>
              ) : null}
            </div>

            {selectedAgent ? (
              <div className="stack-sm">
                <div className="lobby-agent-actions">
                  <button className="app-btn" disabled={!!busyAction} onClick={enterGame}>
                    <span className="row"><DoorOpen size={14} /> {t('dashboard:lobby.actionEnterCity')}</span>
                  </button>
                  <Link className="app-btn secondary" to="/agents"><Crown size={14} /> {t('dashboard:lobby.actionAgentCenter')}</Link>
                </div>
              </div>
            ) : (
              <div className="stack-md">
                <div className="notice info">{t('dashboard:lobby.noAgentNotice')}</div>
                <Link className="app-btn" to="/agents"><Crown size={14} /> {t('dashboard:lobby.actionAgentCenter')}</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="lobby-panels">
        <article className="card lobby-panel">
          <div className="panel-copy">
            <p className="section-label">connection ritual</p>
            <h2 className="title-card">{t('dashboard:lobby.flowTitle')}</h2>
          </div>
          <div className="lobby-flow-list">
            {flowSteps.map((step, index) => (
              <article key={step.title} className="note-tablet lobby-flow-step">
                <span className="ritual-step">{index + 1}</span>
                <div className="lobby-flow-step__body">
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card lobby-panel">
          <div className="panel-copy">
            <p className="section-label">human and agent</p>
            <h2 className="title-card">{t('dashboard:lobby.humanAgentTitle')}</h2>
          </div>
          <div className="stack-sm">
            <p className="section-sub">{t('dashboard:lobby.humanAgentParagraph1')}</p>
            <p className="section-sub">{t('dashboard:lobby.humanAgentParagraph2')}</p>
            <p className="section-sub">{t('dashboard:lobby.humanAgentParagraph3')}</p>
          </div>
          {fallbackPath ? (
            <div className="notice info u-mt-2">
              {t('common:notices.browserBlockedNewTab')}
              <div className="utility-links u-mt-2">
                <button className="app-btn" onClick={() => navigate(fallbackPath)}>
                  <span className="row"><ArrowRight size={14} /> {t('dashboard:lobby.fallbackContinue')}</span>
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      {(errorText || runtime.error) ? (
        <div className="notice error">
          <span className="row"><ShieldAlert size={14} /> {errorText || runtime.error}</span>
        </div>
      ) : null}
    </div>
  );
}
