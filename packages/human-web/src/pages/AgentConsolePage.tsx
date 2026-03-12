import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Eye, EyeOff, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardApi } from '../lib/api';
import { formatDate, formatDateTime } from '../i18n';
import type { ActionLog, LocationDef } from '../lib/types';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';

function getBuiltinLocationOptions(t: (key: string) => string): LocationDef[] {
  return [
    { id: 'chess-club', name: t('play:playPage.builtinChess') },
    { id: 'arcade', name: t('play:playPage.builtinArcade') },
  ];
}

export function AgentConsolePage() {
  const { t } = useTranslation(['dashboard', 'common', 'play']);
  const {
    loading,
    error,
    agents,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    reloadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    getAllowedLocations,
    setAllowedLocations,
  } = useAgents();
  const runtime = useAgentRuntime();

  const [createName, setCreateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
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
  const builtinLocationOptions = useMemo(() => getBuiltinLocationOptions(t), [t]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, LocationDef>();
    builtinLocationOptions.forEach((location) => map.set(location.id, location));
    runtime.availableLocations.forEach((location) => map.set(location.id, location));
    storedAllowedLocationIds.forEach((locationId) => {
      if (!map.has(locationId)) {
        map.set(locationId, { id: locationId, name: locationId });
      }
    });
    return Array.from(map.values());
  }, [builtinLocationOptions, runtime.availableLocations, storedAllowedLocationIds]);

  const locationOptionsById = useMemo(
    () => new Map(locationOptions.map((location) => [location.id, location])),
    [locationOptions],
  );

  useEffect(() => () => {
    Object.values(avatarPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

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
    if (!selectedAgent) {
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

    setName(selectedAgent.name);
    setDescription(selectedAgent.description ?? '');
    setTrustMode(selectedAgent.trustMode);
    setStoredAllowedLocationIds([]);
    setBlockedLocationIds([]);
    setLocationSelectionDirty(false);
    setLocationPickerOpen(false);
    setTokenVisible(false);

    void getAllowedLocations(selectedAgent.id)
      .then((locations) => {
        setStoredAllowedLocationIds(locations);
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : t('dashboard:agents.fetchLocationsFailure'));
      });

    setLogsLoading(true);
    void DashboardApi.listLogs(selectedAgent.id)
      .then((res) => {
        setLogs(res.logs);
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : t('dashboard:agents.fetchLogsFailure'));
      })
      .finally(() => {
        setLogsLoading(false);
      });
  }, [selectedAgent, getAllowedLocations, t]);

  useEffect(() => {
    if (!selectedAgent || locationSelectionDirty) return;
    setBlockedLocationIds(
      storedAllowedLocationIds.length === 0
        ? []
        : locationOptions
          .map((location) => location.id)
          .filter((locationId) => !storedAllowedLocationIds.includes(locationId)),
    );
  }, [selectedAgent, storedAllowedLocationIds, locationOptions, locationSelectionDirty]);

  const onCreateAgent = async () => {
    const trimmed = createName.trim();
    if (!trimmed) return;

    setSaving(true);
    setMessage('');
    try {
      const next = await createAgent(trimmed);
      setCreateName('');
      setMessage(t('dashboard:agents.createSuccess', { name: next.name }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('dashboard:agents.createFailure'));
    } finally {
      setSaving(false);
    }
  };

  const onSaveSettings = async () => {
    if (!selectedAgentId) return;
    setSaving(true);
    setMessage('');
    try {
      const nextFields: { name?: string; description?: string; trustMode?: 'confirm' | 'full' } = {
        name: name.trim(),
        description: description.trim(),
      };
      if (!selectedAgentIsShadow) {
        nextFields.trustMode = trustMode;
      }
      await updateAgent(selectedAgentId, nextFields);
      setMessage(t('dashboard:agents.updateSuccess'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('dashboard:agents.updateFailure'));
    } finally {
      setSaving(false);
    }
  };

  const onSaveLocations = async () => {
    if (!selectedAgentId) return;
    if (selectedAgentIsShadow) {
      setMessage(t('dashboard:agents.shadowNoLocationConfig'));
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const nextAllowedLocations = blockedLocationIds.length === 0
        ? []
        : locationOptions
          .map((location) => location.id)
          .filter((locationId) => !blockedLocationIds.includes(locationId));
      await setAllowedLocations(selectedAgentId, nextAllowedLocations);
      setStoredAllowedLocationIds(nextAllowedLocations);
      setLocationSelectionDirty(false);
      setLocationPickerOpen(false);
      setMessage(t('dashboard:agents.locationSaveSuccess'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('dashboard:agents.locationSaveFailure'));
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
    if (!selectedAgentId) return;
    if (selectedAgentIsShadow) {
      setMessage(t('dashboard:agents.deleteBlocked'));
      return;
    }
    if (!window.confirm(t('dashboard:agents.deleteConfirm'))) return;

    setSaving(true);
    setMessage('');
    try {
      await deleteAgent(selectedAgentId);
      setMessage(t('dashboard:agents.deleteSuccess'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('dashboard:agents.deleteFailure'));
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!selectedAgent?.token) return;
    await navigator.clipboard.writeText(selectedAgent.token);
    setMessage(t('dashboard:agents.tokenCopied'));
  };

  const uploadAvatar = async (file: File | null) => {
    if (!selectedAgentId || !file) return;
    const localPreviewUrl = URL.createObjectURL(file);
    const previousPreviewUrl = avatarPreviewUrlsRef.current[selectedAgentId];
    if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
    avatarPreviewUrlsRef.current[selectedAgentId] = localPreviewUrl;
    setAvatarRefreshKey((prev) => ({ ...prev, [selectedAgentId]: Date.now() }));
    setSaving(true);
    setMessage('');
    try {
      await DashboardApi.uploadAgentAvatar(selectedAgentId, file);
      await reloadAgents();
      setAvatarRefreshKey((prev) => ({ ...prev, [selectedAgentId]: Date.now() }));
      setMessage(t('dashboard:agents.uploadSuccess'));
    } catch (err) {
      URL.revokeObjectURL(localPreviewUrl);
      delete avatarPreviewUrlsRef.current[selectedAgentId];
      setAvatarRefreshKey((prev) => ({ ...prev, [selectedAgentId]: Date.now() }));
      setMessage(err instanceof Error ? err.message : t('dashboard:agents.uploadFailure'));
    } finally {
      setSaving(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const selectedAgentIsShadow = Boolean(selectedAgent?.isShadow);
  const recentLogPreview = logs.slice(0, 3);
  const avatarInitial = (selectedAgent?.name ?? '?').slice(0, 1).toUpperCase();
  const avatarSrc = selectedAgent
    ? avatarPreviewUrlsRef.current[selectedAgent.id]
      ?? (selectedAgent.avatarPath
        ? `${selectedAgent.avatarPath}${selectedAgent.avatarPath.includes('?') ? '&' : '?'}v=${avatarRefreshKey[selectedAgent.id] ?? 0}`
        : null)
    : null;
  const blockedLocationSummary = blockedLocationIds.length === 0
    ? t('dashboard:agents.defaultAllowed')
    : t('dashboard:agents.blockedSummary', { count: blockedLocationIds.length });

  return (
    <div className="page-wrap main-grid agent-console-page">
      <section className="console-grid">
        <aside className="card control-section agent-console-registry">
          <div className="panel-head">
            <div className="panel-copy">
              <p className="section-label">registry</p>
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
                className={`list-item registry-card ${agent.id === selectedAgentId ? 'active' : ''}`}
                onClick={() => setSelectedAgentId(agent.id)}
              >
                <div className="registry-card__row">
                  <div className="registry-card__copy">
                    <strong>{agent.name}</strong>
                    <span className="tiny muted mono">{formatDate(agent.createdAt)}</span>
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

        {!selectedAgent ? (
          <section className="card control-section empty-state agent-console-main">
            <p className="section-label">no active agent</p>
            <h2 className="title-card">{t('dashboard:agents.emptyTitle')}</h2>
            <p className="section-sub">{t('dashboard:agents.emptyBody')}</p>
          </section>
        ) : (
          <div className="agent-console-main">
            <div className={`split-panel${selectedAgentIsShadow ? ' split-panel--single' : ''}`}>
              <section className="card control-section">
                <div className="panel-head">
                  <div className="panel-copy">
                    <p className="section-label">identity and doctrine</p>
                    <h3 className="title-panel">{t('dashboard:agents.sectionBase')}</h3>
                  </div>
                  <button className="app-btn secondary" onClick={onDeleteAgent} disabled={saving || selectedAgentIsShadow}>
                    <span className="row"><Trash2 size={14} /> {t('common:actions.delete')}</span>
                  </button>
                </div>

                <div className="field-grid">
                  <div className="agent-avatar-field">
                    <div className="agent-avatar-field__preview">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={`${selectedAgent.name} ${t('common:labels.avatar')}`} />
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

                  {!selectedAgentIsShadow ? (
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
                  ) : null}

                  <button className="app-btn" onClick={onSaveSettings} disabled={saving}>
                    <span className="row"><Save size={14} /> {t('common:actions.saveSettings')}</span>
                  </button>
                </div>

                {selectedAgentIsShadow ? (
                  <div className="notice info">
                    {t('common:status.noTokenConfigNeeded')}
                  </div>
                ) : null}
              </section>

                {!selectedAgentIsShadow ? (
                  <div className="stack-lg agent-console-side">
                  <section className="card control-section agent-token-card">
                    <div className="agent-token-card__head">
                      <h3 className="title-panel">{t('dashboard:agents.sectionToken')}</h3>
                      <p className="agent-token-card__hint">{t('common:labels.tokenCredentials')}</p>
                    </div>

                    <div className="agent-token-card__actions">
                      <button className="app-btn secondary" onClick={() => setTokenVisible((value) => !value)}>
                        {tokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        {tokenVisible ? t('common:actions.hide') : t('common:actions.show')}
                      </button>
                      <button className="app-btn" onClick={copyToken}>
                        <Copy size={14} />
                        {t('common:actions.copyToken')}
                      </button>
                    </div>

                    <div className="code-block mask-token">
                      {tokenVisible ? selectedAgent.token : t('dashboard:agents.hiddenToken')}
                    </div>
                  </section>

                  <section className="card control-section agent-location-card">
                    <div className="panel-head">
                      <div className="panel-copy">
                        <p className="section-label">allowed locations</p>
                        <h3 className="title-panel">{t('dashboard:agents.sectionLocations')}</h3>
                      </div>
                      <span className="info-pill">{blockedLocationIds.length}</span>
                    </div>

                    <p className="agent-location-card__hint">{t('dashboard:agents.blockedHint')}</p>

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
                        <span>{blockedLocationSummary}</span>
                        <span className="agent-location-picker__summary-meta">
                          <span className="tiny muted">{t('dashboard:agents.openPicker')}</span>
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

                    <button className="app-btn secondary" onClick={onSaveLocations} disabled={saving || selectedAgentIsShadow}>
                      {t('common:actions.saveBlockedLocations')}
                    </button>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {selectedAgent ? (
          <section className="card control-section agent-activity-strip">
            <div className="agent-activity-strip__head">
              <h3 className="title-panel">{t('dashboard:agents.sectionRecent')}</h3>
              <span className="info-pill">{logs.length}</span>
            </div>

            {logsLoading ? <p className="agent-activity-strip__hint">{t('dashboard:agents.logsLoading')}</p> : null}

            {!logsLoading && logs.length === 0 ? (
              <p className="agent-activity-strip__hint">{t('dashboard:agents.noLogs')}</p>
            ) : null}

            {!logsLoading && logs.length > 0 ? (
              <div className="agent-activity-strip__items">
                {recentLogPreview.map((log) => (
                  <span key={log.id} className="info-pill">
                    {log.actionType}
                    {log.locationId ? ` · ${log.locationId}` : ''}
                  </span>
                ))}
                {logs.length > recentLogPreview.length ? <span className="info-pill">{t('dashboard:agents.extraLogs', { count: logs.length - recentLogPreview.length })}</span> : null}
                <span className="agent-activity-strip__hint">{t('dashboard:agents.latestLog', { date: formatDateTime(recentLogPreview[0].createdAt) })}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {message ? <div className="notice info agent-console-message">{message}</div> : null}
      </section>
    </div>
  );
}
