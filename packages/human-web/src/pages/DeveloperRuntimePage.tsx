import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';

export function DeveloperRuntimePage() {
  const { t } = useTranslation(['dashboard', 'common', 'runtime', 'nav']);
  const { selectedAgent } = useAgents();
  const runtime = useAgentRuntime();
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');

  const run = async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    try {
      const result = await action();
      return result;
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : t('dashboard:developer.connectFailure', { label }));
      return null;
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="page-wrap main-grid">
      <section className="card control-section">
        <div className="panel-head">
          <div className="panel-copy">
            <p className="section-label">developer only</p>
            <h1 className="section-title title-card">{t('dashboard:developer.title')}</h1>
            <p className="section-sub">
              {t('dashboard:developer.subtitle')} <Link className="link-btn" to="/lobby">{t('nav:lobby')}</Link>.
            </p>
          </div>
          <span className="status-chip">{runtime.isConnected ? t(`runtime:wsStatus.${runtime.status}`) : t('dashboard:developer.statusOffline')}</span>
        </div>

        {!selectedAgent ? (
          <div className="notice info">{t('dashboard:developer.noAgent')} <Link className="link-btn" to="/agents">{t('nav:agents')}</Link>.</div>
        ) : (
          <>
            <label>
              <span className="label">{t('common:labels.wsUrl')}</span>
              <input className="app-input mono" value={runtime.wsUrl} onChange={(e) => runtime.setWsUrl(e.target.value)} />
            </label>

            <div className="utility-links">
              <button className="app-btn" disabled={!!busyAction} onClick={() => void run(t('dashboard:developer.actionConnect'), runtime.connect)}>{t('common:actions.connect')}</button>
              <button className="app-btn secondary" disabled={!!busyAction} onClick={() => runtime.disconnect()}>{t('common:actions.disconnect')}</button>
              <button className="app-btn secondary" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run(t('dashboard:developer.actionRefreshSession'), runtime.refreshSessionState)}>
                <span className="row"><RefreshCw size={14} /> {t('common:actions.refreshSession')}</span>
              </button>
            </div>

            <div className="utility-links">
              <button className="app-btn secondary" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run(t('common:actions.claimControl'), runtime.claimControl)}>{t('dashboard:developer.actionClaim')}</button>
              <button className="app-btn secondary" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run(t('common:actions.releaseControl'), runtime.releaseControl)}>{t('dashboard:developer.actionRelease')}</button>
              <button className="app-btn secondary" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run(t('common:actions.enterCity'), runtime.enterCity)}>{t('dashboard:developer.actionEnterCity')}</button>
              <button className="app-btn secondary" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run(t('common:actions.leaveCity'), runtime.leaveCity)}>{t('dashboard:developer.actionLeaveCity')}</button>
              <button className="app-btn secondary" disabled={!!busyAction || !runtime.isConnected} onClick={() => void run(t('common:actions.leaveLocation'), runtime.leaveLocation)}>{t('dashboard:developer.actionLeaveLocation')}</button>
            </div>
          </>
        )}

        {(errorText || runtime.error) ? (
          <div className="notice error">
            <span className="row"><ShieldAlert size={14} /> {errorText || runtime.error}</span>
          </div>
        ) : null}
      </section>

      <section className="city-grid">
        <section className="card control-section">
          <div className="panel-head">
            <div className="panel-copy">
              <p className="section-label">commands</p>
              <h2 className="title-panel">{t('dashboard:developer.commandsTitle')}</h2>
            </div>
            <span className="info-pill">{runtime.availableCommands.length}</span>
          </div>
          {runtime.availableCommands.length === 0 ? (
            <div className="notice info">{t('dashboard:developer.commandNone')}</div>
          ) : (
            <div className="command-grid">
              {runtime.availableCommands.map((cmd) => (
                <article key={cmd.type} className="command-card">
                  <div className="row space">
                    <strong className="mono">{cmd.type}</strong>
                    <span className="tiny muted">{cmd.pluginName || 'core'}</span>
                  </div>
                  <p className="tiny muted u-mt-1">{cmd.description}</p>
                  <div className="code-block u-mt-1">
                    {Object.keys(cmd.params).length === 0
                      ? 'params: {}'
                      : `params: ${Object.keys(cmd.params).join(', ')}`}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card control-section">
          <div className="panel-head">
            <div className="panel-copy">
              <p className="section-label">events</p>
              <h2 className="title-panel">{t('dashboard:developer.eventsTitle')}</h2>
            </div>
            <span className="info-pill">{runtime.events.length}</span>
          </div>
          {runtime.events.length === 0 ? (
            <div className="notice info">{t('dashboard:developer.eventsNone')}</div>
          ) : (
            <div className="list-pane list-pane-lg scroll-pane">
              {runtime.events.map((item, idx) => (
                <div key={`${item}-${idx}`} className="code-block">{item}</div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
