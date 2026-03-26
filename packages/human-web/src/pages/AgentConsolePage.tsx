import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, Eye, EyeOff, ImagePlus, Info, Plus, Save, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardApi } from '../lib/api';
import { formatDate, formatDateTime } from '../i18n';
import type { ActionLog, LocationDef } from '../lib/types';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import { usePluginHost } from '../plugins/context';

type AgentConsoleToastTone = 'info' | 'success' | 'error';

type AgentConsoleToast = {
  text: string;
  tone: AgentConsoleToastTone;
};

export function AgentConsolePage() {
  const { t } = useTranslation(['dashboard', 'common', 'play']);
  const {
    loading,
    error,
    agents,
    reloadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    getAllowedLocations,
    setAllowedLocations,
  } = useAgents();
  const runtime = useAgentRuntime();
  const { enabledLocationPages } = usePluginHost();

  const [createName, setCreateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<AgentConsoleToast | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarPreviewUrlsRef = useRef<Record<string, string>>({});
  const locationPickerRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trustMode, setTrustMode] = useState<'confirm' | 'full'>('confirm');
  const [storedAllowedLocationIds, setStoredAllowedLocationIds] = useState<string[]>([]);
  const [blockedLocationIds, setBlockedLocationIds] = useState<string[]>([]);
  const [locationSelectionDirty, setLocationSelectionDirty] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState<Record<string, number>>({});
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [managedAgentId, setManagedAgentId] = useState<string | null>(null);
  const showToast = (text: string, tone: AgentConsoleToastTone) => setToast({ text, tone });
  const builtinLocationOptions = useMemo(() => (
    enabledLocationPages.map((location) => ({
      id: location.locationId,
      name: t(location.titleKey),
      description: location.descriptionKey ? t(location.descriptionKey) : undefined,
    }))
  ), [enabledLocationPages, t]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, LocationDef>();
    builtinLocationOptions.forEach((location) => map.set(location.id, location));
    runtime.discoveredLocations.forEach((location) => map.set(location.id, location));
    storedAllowedLocationIds.forEach((locationId) => {
      if (!map.has(locationId)) {
        map.set(locationId, { id: locationId, name: locationId });
      }
    });
    return Array.from(map.values());
  }, [builtinLocationOptions, runtime.discoveredLocations, storedAllowedLocationIds]);

  const locationOptionsById = useMemo(
    () => new Map(locationOptions.map((location) => [location.id, location])),
    [locationOptions],
  );
  const managedAgent = useMemo(
    () => agents.find((agent) => agent.id === managedAgentId) ?? null,
    [agents, managedAgentId],
  );

  useEffect(() => () => {
    Object.values(avatarPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (agents.length === 0) {
      setManagedAgentId(null);
      return;
    }
    if (!managedAgentId || !agents.some((agent) => agent.id === managedAgentId)) {
      setManagedAgentId(agents[0].id);
    }
  }, [agents, managedAgentId]);

  useEffect(() => {
    if (!locationPickerOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!locationPickerRef.current?.contains(event.target as Node)) {
        setLocationPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLocationPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [locationPickerOpen]);

  useEffect(() => {
    if (!managedAgent) {
      setName('');
      setDescription('');
      setTrustMode('confirm');
      setStoredAllowedLocationIds([]);
      setBlockedLocationIds([]);
      setLocationSelectionDirty(false);
      setLocationPickerOpen(false);
      setTokenVisible(false);
      setLogs([]);
      return;
    }

    setName(managedAgent.name);
    setDescription(managedAgent.description ?? '');
    setTrustMode(managedAgent.trustMode);
    setStoredAllowedLocationIds([]);
    setBlockedLocationIds([]);
    setLocationSelectionDirty(false);
    setLocationPickerOpen(false);
    setTokenVisible(false);

    void getAllowedLocations(managedAgent.id)
      .then((locations) => {
        setStoredAllowedLocationIds(locations);
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : t('dashboard:agents.fetchLocationsFailure'), 'error');
      });

    setLogsLoading(true);
    void DashboardApi.listLogs(managedAgent.id)
      .then((res) => {
        setLogs(res.logs);
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : t('dashboard:agents.fetchLogsFailure'), 'error');
      })
      .finally(() => {
        setLogsLoading(false);
      });
  }, [managedAgent, getAllowedLocations, t]);

  useEffect(() => {
    if (!managedAgent || locationSelectionDirty) return;
    setBlockedLocationIds(
      storedAllowedLocationIds.length === 0
        ? []
        : locationOptions
          .map((location) => location.id)
          .filter((locationId) => !storedAllowedLocationIds.includes(locationId)),
    );
  }, [managedAgent, storedAllowedLocationIds, locationOptions, locationSelectionDirty]);

  const onCreateAgent = async () => {
    const trimmed = createName.trim();
    if (!trimmed) return;

    setSaving(true);
    setToast(null);
    try {
      const next = await createAgent(trimmed);
      setCreateName('');
      setManagedAgentId(next.id);
      showToast(t('dashboard:agents.createSuccess', { name: next.name }), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('dashboard:agents.createFailure'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSaveSettings = async () => {
    if (!managedAgentId) return;
    setSaving(true);
    setToast(null);
    try {
      const nextFields: { name?: string; description?: string; trustMode?: 'confirm' | 'full' } = {
        name: name.trim(),
        description: description.trim(),
      };
      if (!managedAgentIsShadow) {
        nextFields.trustMode = trustMode;
      }
      await updateAgent(managedAgentId, nextFields);
      showToast(t('dashboard:agents.updateSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('dashboard:agents.updateFailure'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSaveLocations = async () => {
    if (!managedAgentId) return;
    if (managedAgentIsShadow) {
      showToast(t('dashboard:agents.shadowNoLocationConfig'), 'info');
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const nextAllowedLocations = blockedLocationIds.length === 0
        ? []
        : locationOptions
          .map((location) => location.id)
          .filter((locationId) => !blockedLocationIds.includes(locationId));
      await setAllowedLocations(managedAgentId, nextAllowedLocations);
      setStoredAllowedLocationIds(nextAllowedLocations);
      setLocationSelectionDirty(false);
      setLocationPickerOpen(false);
      showToast(t('dashboard:agents.locationSaveSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('dashboard:agents.locationSaveFailure'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleBlockedLocation = (locationId: string) => {
    setLocationSelectionDirty(true);
    setBlockedLocationIds((prev) => (
      prev.includes(locationId)
        ? prev.filter((item) => item !== locationId)
        : [...prev, locationId]
    ));
  };

  const onDeleteAgent = async () => {
    if (!managedAgentId) return;
    if (managedAgentIsShadow) {
      showToast(t('dashboard:agents.deleteBlocked'), 'info');
      return;
    }
    if (!window.confirm(t('dashboard:agents.deleteConfirm'))) return;

    setSaving(true);
    setToast(null);
    try {
      await deleteAgent(managedAgentId);
      showToast(t('dashboard:agents.deleteSuccess'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('dashboard:agents.deleteFailure'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!managedAgent?.token) return;
    await navigator.clipboard.writeText(managedAgent.token);
    showToast(t('dashboard:agents.tokenCopied'), 'success');
  };

  const uploadAvatar = async (file: File | null) => {
    if (!managedAgentId || !file) return;
    const localPreviewUrl = URL.createObjectURL(file);
    const previousPreviewUrl = avatarPreviewUrlsRef.current[managedAgentId];
    if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
    avatarPreviewUrlsRef.current[managedAgentId] = localPreviewUrl;
    setAvatarRefreshKey((prev) => ({ ...prev, [managedAgentId]: Date.now() }));
    setSaving(true);
    setToast(null);
    try {
      await DashboardApi.uploadAgentAvatar(managedAgentId, file);
      await reloadAgents();
      setAvatarRefreshKey((prev) => ({ ...prev, [managedAgentId]: Date.now() }));
      showToast(t('dashboard:agents.uploadSuccess'), 'success');
    } catch (err) {
      URL.revokeObjectURL(localPreviewUrl);
      delete avatarPreviewUrlsRef.current[managedAgentId];
      setAvatarRefreshKey((prev) => ({ ...prev, [managedAgentId]: Date.now() }));
      showToast(err instanceof Error ? err.message : t('dashboard:agents.uploadFailure'), 'error');
    } finally {
      setSaving(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const managedAgentIsShadow = Boolean(managedAgent?.isShadow);
  const recentLogPreview = logs.slice(0, 3);
  const latestLog = recentLogPreview[0] ?? null;
  const avatarInitial = (managedAgent?.name ?? '?').slice(0, 1).toUpperCase();
  const avatarSrc = managedAgent
    ? avatarPreviewUrlsRef.current[managedAgent.id]
      ?? (managedAgent.avatarPath
        ? `${managedAgent.avatarPath}${managedAgent.avatarPath.includes('?') ? '&' : '?'}v=${avatarRefreshKey[managedAgent.id] ?? 0}`
        : null)
    : null;
  const blockedLocationSummary = blockedLocationIds.length === 0
    ? t('dashboard:agents.defaultAllowed')
    : t('dashboard:agents.blockedSummary', { count: blockedLocationIds.length });
  const toastIcon = toast?.tone === 'error'
    ? <AlertTriangle size={18} />
    : toast?.tone === 'success'
      ? <Check size={18} />
      : <Info size={18} />;

  return (
    <div className="page-wrap main-grid agent-console-page">
      <section className="agent-console-shell">
        {toast ? (
          <div
            className="agent-console-toast-stack"
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <section className={`agent-console-toast agent-console-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <span className="agent-console-toast__icon" aria-hidden="true">{toastIcon}</span>
              <div className="agent-console-toast__copy">
                <p>{toast.text}</p>
              </div>
              <button
                type="button"
                className="agent-console-toast__close"
                aria-label={t('common:actions.close')}
                onClick={() => setToast(null)}
              >
                <X size={14} />
              </button>
            </section>
          </div>
        ) : null}

        {managedAgent ? (
          <section className="card control-section selected-agent-banner">
            <div className="selected-agent-banner__main">
              <div className="agent-avatar-field__preview selected-agent-banner__avatar">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={`${managedAgent.name} ${t('common:labels.avatar')}`} />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>

              <div className="selected-agent-banner__copy">
                <div className="row wrap">
                  <h2 className="selected-agent-banner__name">{managedAgent.name}</h2>
                  {managedAgent.isShadow ? <span className="info-pill">{t('dashboard:agents.primaryIdentity')}</span> : null}
                  <span className="info-pill">{managedAgent.trustMode}</span>
                  <span className="info-pill">
                    <span className={`status-dot ${managedAgent.isOnline ? 'online' : 'offline'}`} />
                    {managedAgent.isOnline ? t('common:status.online') : t('common:status.offline')}
                  </span>
                </div>

                <p className="selected-agent-banner__meta tiny muted">
                  {t('dashboard:agents.created')} {formatDate(managedAgent.createdAt)}
                </p>

                {tokenVisible && !managedAgentIsShadow ? (
                  <div className="code-block mask-token selected-agent-banner__token">{managedAgent.token}</div>
                ) : null}
              </div>
            </div>

            <div className="selected-agent-banner__actions">
              {!managedAgentIsShadow ? (
                <>
                  <button className="app-btn secondary" onClick={() => setTokenVisible((value) => !value)}>
                    {tokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    {tokenVisible ? t('common:actions.hide') : t('common:actions.show')}
                  </button>
                  <button className="app-btn" onClick={copyToken}>
                    <Copy size={14} />
                    {t('common:actions.copyToken')}
                  </button>
                </>
              ) : null}
              <button className="app-btn secondary" onClick={onDeleteAgent} disabled={saving || managedAgentIsShadow}>
                <Trash2 size={14} />
                {t('common:actions.delete')}
              </button>
            </div>
          </section>
        ) : null}

        <div className="console-grid agent-console-body">
          <aside className="card control-section agent-console-registry">
            <div className="panel-head">
              <div className="panel-copy">
                <h2 className="title-card">{t('dashboard:agents.title')}</h2>
              </div>
              <span className="info-pill">{t('dashboard:agents.countLabel', { count: agents.length })}</span>
            </div>

            <div className="agent-create-strip">
              <label>
                <span className="label">{t('common:labels.agentName')}</span>
                <input
                  className="app-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('common:placeholders.agentName')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void onCreateAgent();
                    }
                  }}
                />
              </label>
              <button className="app-btn" onClick={onCreateAgent} disabled={saving}>
                <span className="row"><Plus size={14} /> {t('common:actions.createAgent')}</span>
              </button>
            </div>

            {loading ? <div className="notice info">{t('dashboard:agents.loading')}</div> : null}
            {error ? <div className="notice error">{error}</div> : null}

            <div className="registry-list">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className={`list-item registry-card ${agent.id === managedAgentId ? 'active' : ''}`}
                  onClick={() => setManagedAgentId(agent.id)}
                >
                  <div className="registry-card__row">
                    <div className="registry-card__copy">
                      <strong>{agent.name}</strong>
                    </div>
                    <div className="registry-card__meta">
                      {agent.isShadow ? <span className="info-pill">{t('dashboard:agents.primaryIdentity')}</span> : null}
                      <span className="info-pill">{agent.trustMode}</span>
                      <span className="row tiny muted">
                        <span className={`status-dot ${agent.isOnline ? 'online' : 'offline'}`} />
                        {agent.isOnline ? t('common:status.online') : t('common:status.offline')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {!managedAgent ? (
            <section className="card control-section empty-state agent-console-main">
              <h2 className="title-card">{t('dashboard:agents.emptyTitle')}</h2>
              <p className="section-sub">{t('dashboard:agents.emptyBody')}</p>
            </section>
          ) : (
            <div className="agent-console-main stack-lg">
              <section className="card control-section agent-console-primary">
                <div className="panel-head">
                  <div className="panel-copy">
                    <h3 className="title-panel">{t('dashboard:agents.sectionBase')}</h3>
                  </div>
                </div>

                <div className="field-grid">
                  <div className="agent-avatar-field">
                    <div className="agent-avatar-field__preview">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={`${managedAgent.name} ${t('common:labels.avatar')}`} />
                      ) : (
                        <span>{avatarInitial}</span>
                      )}
                    </div>
                    <div className="agent-avatar-field__copy">
                      <span className="label">{t('common:labels.avatar')}</span>
                      <button
                        type="button"
                        className="app-btn secondary"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={saving}
                      >
                        <ImagePlus size={14} />
                        {t('common:actions.uploadAvatar')}
                      </button>
                      <p className="tiny muted">{t('common:notices.avatarSupport')}</p>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        className="agent-avatar-field__input"
                        onChange={(e) => void uploadAvatar(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>

                  <label>
                    <span className="label">{t('common:labels.name')}</span>
                    <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>

                  <label>
                    <span className="label">{t('common:labels.description')}</span>
                    <textarea
                      className="app-textarea"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('common:placeholders.avatarDescription')}
                    />
                  </label>

                  {!managedAgentIsShadow ? (
                    <label>
                      <span className="label">{t('common:labels.trustMode')}</span>
                      <select
                        className="app-select agent-console-select"
                        value={trustMode}
                        onChange={(e) => setTrustMode(e.target.value as 'confirm' | 'full')}
                      >
                        <option value="confirm">confirm</option>
                        <option value="full">full</option>
                      </select>
                    </label>
                  ) : (
                    <p className="tiny muted agent-console-primary__note">{t('common:status.noTokenConfigNeeded')}</p>
                  )}
                </div>

                <div className="agent-console-primary__footer">
                  <button className="app-btn" onClick={onSaveSettings} disabled={saving}>
                    <span className="row"><Save size={14} /> {t('common:actions.saveSettings')}</span>
                  </button>
                </div>
              </section>

              <div className={`agent-console-secondary${managedAgentIsShadow ? ' agent-console-secondary--single' : ''}`}>
                {!managedAgentIsShadow ? (
                  <section className="card control-section agent-location-card">
                    <div className="panel-head">
                      <div className="panel-copy">
                        <h3 className="title-panel">{t('dashboard:agents.sectionLocations')}</h3>
                        <p className="agent-location-card__summary">{blockedLocationSummary}</p>
                      </div>
                      <span className="info-pill">{blockedLocationIds.length}</span>
                    </div>

                    <div
                      ref={locationPickerRef}
                      className={`agent-location-picker${locationPickerOpen ? ' is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="agent-location-picker__summary"
                        onClick={() => setLocationPickerOpen((value) => !value)}
                        aria-expanded={locationPickerOpen}
                        aria-haspopup="listbox"
                      >
                        <span>{t('dashboard:agents.openPicker')}</span>
                        <span className="agent-location-picker__summary-meta">
                          <ChevronDown className="agent-location-picker__chevron" size={14} />
                        </span>
                      </button>

                      {locationPickerOpen ? (
                        <div className="agent-location-picker__menu" role="listbox" aria-label={t('common:labels.blockedLocations')}>
                          {locationOptions.map((location) => {
                            const checked = blockedLocationIds.includes(location.id);
                            return (
                              <button
                                key={location.id}
                                type="button"
                                className={`agent-location-picker__item${checked ? ' is-selected' : ''}`}
                                onClick={() => toggleBlockedLocation(location.id)}
                                aria-pressed={checked}
                              >
                                <span className="agent-location-picker__mark" aria-hidden="true">
                                  {checked ? <Check size={12} /> : null}
                                </span>
                                <div className="agent-location-picker__copy">
                                  <strong>{location.name}</strong>
                                  <span className="tiny muted mono">{location.id}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="chip-grid">
                      {blockedLocationIds.length === 0 ? (
                        <span className="info-pill">{t('dashboard:agents.noBlockedLocations')}</span>
                      ) : blockedLocationIds.map((locationId) => {
                        const location = locationOptionsById.get(locationId);
                        return <span key={locationId} className="info-pill">{location?.name ?? locationId}</span>;
                      })}
                    </div>

                    <button className="app-btn" onClick={onSaveLocations} disabled={saving || managedAgentIsShadow}>
                      {t('common:actions.saveBlockedLocations')}
                    </button>
                  </section>
                ) : null}

                <section className="card control-section agent-activity-panel">
                  <div className="panel-head">
                    <div className="panel-copy">
                      <h3 className="title-panel">{t('dashboard:agents.sectionRecent')}</h3>
                      {latestLog ? (
                        <p className="agent-activity-panel__summary">
                          {t('dashboard:agents.latestLog', { date: formatDateTime(latestLog.createdAt) })}
                        </p>
                      ) : null}
                    </div>
                    <span className="info-pill">{logs.length}</span>
                  </div>

                  {logsLoading ? <p className="agent-activity-panel__empty">{t('dashboard:agents.logsLoading')}</p> : null}

                  {!logsLoading && logs.length === 0 ? (
                    <p className="agent-activity-panel__empty">{t('dashboard:agents.noLogs')}</p>
                  ) : null}

                  {!logsLoading && logs.length > 0 ? (
                    <div className="chip-grid">
                      {recentLogPreview.map((log) => (
                        <span key={log.id} className="info-pill">
                          {log.actionType}
                          {log.locationId ? ` · ${log.locationId}` : ''}
                        </span>
                      ))}
                      {logs.length > recentLogPreview.length ? (
                        <span className="info-pill">{t('dashboard:agents.extraLogs', { count: logs.length - recentLogPreview.length })}</span>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
