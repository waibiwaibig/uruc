import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import { usePluginHost } from '../plugins/context';

export function DeveloperRuntimePage() {
  const { t } = useTranslation(['dashboard', 'common', 'runtime', 'nav']);
  const { shadowAgent } = useAgents();
  const runtime = useAgentRuntime();
  const pluginHost = usePluginHost();
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!runtime.isConnected) return;
    void runtime.refreshCommands().catch(() => undefined);
  }, [runtime.isConnected, runtime.refreshCommands]);

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

        {!shadowAgent ? (
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
            <span className="info-pill">{runtime.commandGroups.length}</span>
          </div>
          {runtime.commandGroups.length === 0 ? (
            <div className="notice info">{t('dashboard:developer.commandNone')}</div>
          ) : (
            <>
              <div className="command-grid">
                {runtime.commandGroups.map((group) => (
                  <article key={group.scope === 'city' ? 'city' : group.pluginId} className="command-card">
                    <div className="row space">
                      <strong className="mono">{group.label}</strong>
                      <span className="tiny muted">{group.commandCount}</span>
                    </div>
                    <p className="tiny muted u-mt-1">
                      {group.scope === 'city' ? 'City core commands' : `Plugin commands for ${group.pluginId}`}
                    </p>
                    <button
                      className="app-btn secondary u-mt-2"
                      disabled={!!busyAction}
                      onClick={() => void run(
                        group.scope === 'city' ? 'Load city commands' : `Load ${group.label}`,
                        () => runtime.refreshCommands(group.scope === 'city' ? { scope: 'city' } : {
                          scope: 'plugin',
                          pluginId: group.pluginId!,
                        }),
                      )}
                    >
                      {t('common:actions.refresh')}
                    </button>
                  </article>
                ))}
              </div>

              {runtime.discoveredCommands.length > 0 ? (
                <div className="command-grid u-mt-2">
                  {runtime.discoveredCommands.map((cmd) => (
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
              ) : null}
            </>
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

        <section className="card control-section">
          <div className="panel-head">
            <div className="panel-copy">
              <p className="section-label">plugins</p>
              <h2 className="title-panel">Plugin diagnostics</h2>
            </div>
            <span className="info-pill">{pluginHost.diagnostics.length + pluginHost.backendDiagnostics.length}</span>
          </div>
          {(pluginHost.diagnostics.length + pluginHost.backendDiagnostics.length) === 0 ? (
            <div className="notice info">No plugin diagnostics reported.</div>
          ) : (
            <div className="command-grid">
              {pluginHost.diagnostics.map((item, index) => (
                <article key={`${item.pluginId}:${item.state}:${index}`} className="command-card">
                  <div className="row space">
                    <strong className="mono">{item.pluginId}</strong>
                    <span className="tiny muted">{item.state}</span>
                  </div>
                  <p className="tiny muted u-mt-1">{item.message}</p>
                  <div className="code-block u-mt-1">{item.target ? `${item.target} · ${item.source}` : item.source}</div>
                </article>
              ))}
              {pluginHost.backendDiagnostics.map((item) => (
                <article key={`backend:${item.pluginId ?? item.name}:${item.state}`} className="command-card">
                  <div className="row space">
                    <strong className="mono">{item.pluginId ?? item.name ?? 'unknown-plugin'}</strong>
                    <span className="tiny muted">{item.state}</span>
                  </div>
                  <p className="tiny muted u-mt-1">{item.lastError ?? item.reason ?? 'Backend plugin OK'}</p>
                  <div className="code-block u-mt-1">{item.packageName ?? item.package ?? item.version ?? 'unknown package'}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
