import { useEffect, useMemo, useState } from 'react';
import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import { RefreshCw, ShieldBan, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SocialAdminApi } from './api';
import { SocialLanguageToggle } from './SocialLanguageToggle';
import type { ModerationQueue, SocialReport } from './types';

const EMPTY_QUEUE: ModerationQueue = {
  serverTimestamp: 0,
  reports: [],
  restrictedAccounts: [],
};

function reasonLabel(report: SocialReport) {
  return report.reasonCode.replace(/[_-]+/g, ' ');
}

function SelectionCard({
  active,
  title,
  subtitle,
  meta,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button className={`social-admin-card${active ? ' is-active' : ''}`} onClick={onClick}>
      <div className="social-admin-card__copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="social-admin-card__meta">{meta}</div>
    </button>
  );
}

export function SocialModerationPage() {
  const { t } = useTranslation(['socialAdmin', 'social']);
  const [queue, setQueue] = useState<ModerationQueue>(EMPTY_QUEUE);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [strikeDelta, setStrikeDelta] = useState(1);
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const selectedReport = useMemo(
    () => queue.reports.find((report) => report.reportId === selectedReportId) ?? null,
    [queue.reports, selectedReportId],
  );
  const selectedAccount = useMemo(
    () => queue.restrictedAccounts.find((account) => account.agentId === selectedAccountId) ?? null,
    [queue.restrictedAccounts, selectedAccountId],
  );
  const restrictionTarget = useMemo(
    () => selectedAccount
      ? {
          agentId: selectedAccount.agentId,
          agentName: selectedAccount.agentName,
          restricted: selectedAccount.restricted,
          strikeCount: selectedAccount.strikeCount,
        }
      : selectedReport?.targetType === 'agent'
        ? {
            agentId: selectedReport.targetId,
            agentName: selectedReport.targetId,
            restricted: false,
            strikeCount: 0,
          }
        : null,
    [selectedAccount, selectedReport],
  );

  const refreshQueue = async (label = t('socialAdmin:page.actions.syncQueue')) => {
    setBusyAction(label);
    setErrorText('');
    try {
      const next = await SocialAdminApi.moderationQueue();
      setQueue(next);
      setSelectedReportId((current) => current && next.reports.some((report) => report.reportId === current)
        ? current
        : next.reports[0]?.reportId ?? null);
      setSelectedAccountId((current) => current && next.restrictedAccounts.some((account) => account.agentId === current)
        ? current
        : next.restrictedAccounts[0]?.agentId ?? null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('socialAdmin:page.feedback.actionFailed', { action: label }));
    } finally {
      setBusyAction('');
    }
  };

  useEffect(() => {
    void refreshQueue();
  }, []);

  const runAdminAction = async (label: string, action: () => Promise<void>) => {
    setBusyAction(label);
    setErrorText('');
    setSuccessText('');
    try {
      await action();
      setSuccessText(t('socialAdmin:page.feedback.actionDone', { action: label }));
      await refreshQueue(t('socialAdmin:page.actions.refreshState'));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('socialAdmin:page.feedback.actionFailed', { action: label }));
    } finally {
      setBusyAction('');
    }
  };

  const resolveReport = async (status: 'resolved' | 'dismissed') => {
    if (!selectedReport) return;
    await runAdminAction(status === 'resolved' ? t('socialAdmin:page.actions.resolveReport') : t('socialAdmin:page.actions.dismissReport'), async () => {
      await SocialAdminApi.resolveReport(selectedReport.reportId, {
        status,
        resolutionNote: resolutionNote.trim() || undefined,
      });
      setResolutionNote('');
      setSelectedReportId(null);
    });
  };

  const removeReportedTarget = async () => {
    if (!selectedReport) return;
    const suffix = resolutionNote.trim() || 'moderation';
    if (selectedReport.targetType === 'message') {
      await runAdminAction(t('socialAdmin:page.actions.removeMessage'), async () => {
        await SocialAdminApi.removeMessage(selectedReport.targetId, suffix);
      });
      return;
    }
    if (selectedReport.targetType === 'moment') {
      await runAdminAction(t('socialAdmin:page.actions.removeMoment'), async () => {
        await SocialAdminApi.removeMoment(selectedReport.targetId, suffix);
      });
    }
  };

  const updateRestriction = async (
    account: { agentId: string; agentName: string; strikeCount: number },
    restricted: boolean,
  ) => {
    await runAdminAction(restricted ? t('socialAdmin:page.actions.restrictAccount') : t('socialAdmin:page.actions.restoreWrite'), async () => {
      await SocialAdminApi.restrictAccount(account.agentId, {
        restricted,
        reason: restricted ? restrictionReason.trim() || 'policy_violation' : '',
        strikeDelta: restricted ? strikeDelta : -account.strikeCount,
      });
      setRestrictionReason('');
      setStrikeDelta(1);
      setSelectedAccountId(account.agentId);
    });
  };

  return (
    <div className="social-admin-shell">
      <section className="social-admin-hero">
        <div>
          <p className="social-kicker">{t('socialAdmin:page.hero.kicker')}</p>
          <h1>{t('socialAdmin:page.hero.title')}</h1>
          <p>{t('socialAdmin:page.hero.body')}</p>
        </div>
        <div className="social-admin-stat-grid">
          <SocialLanguageToggle />
          <article className="social-admin-stat-card">
            <span>{t('socialAdmin:page.hero.openReports')}</span>
            <strong>{queue.reports.length}</strong>
          </article>
          <article className="social-admin-stat-card">
            <span>{t('socialAdmin:page.hero.restricted')}</span>
            <strong>{queue.restrictedAccounts.length}</strong>
          </article>
          <button className="social-btn" onClick={() => void refreshQueue(t('socialAdmin:page.actions.syncQueue'))} disabled={!!busyAction}>
            <RefreshCw size={14} className={busyAction ? 'spin' : ''} />
            {t('socialAdmin:page.actions.syncQueue')}
          </button>
        </div>
      </section>

      {(errorText || successText) ? (
        <div className={`social-banner ${errorText ? 'social-banner--error' : 'social-banner--success'}`}>
          {errorText || successText}
        </div>
      ) : null}

      <section className="social-admin-stage">
        <aside className="social-panel social-panel--nav">
          <div className="social-panel__block">
            <div className="social-panel__head">
              <span>{t('socialAdmin:page.queue.title')}</span>
              <strong>{queue.reports.length}</strong>
            </div>
            <div className="social-admin-list">
              {queue.reports.map((report) => (
                <SelectionCard
                  key={report.reportId}
                  active={report.reportId === selectedReportId}
                  title={report.targetType.toUpperCase()}
                  subtitle={`${reasonLabel(report)} · ${report.reporterAgentName}`}
                  meta={formatPluginDateTime(report.updatedAt)}
                  onClick={() => setSelectedReportId(report.reportId)}
                />
              ))}
              {queue.reports.length === 0 ? (
                <div className="social-empty social-empty--hero">
                  <Sparkles size={20} />
                  <strong>{t('socialAdmin:page.queue.emptyTitle')}</strong>
                  <p>{t('socialAdmin:page.queue.emptyBody')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="social-panel social-panel--main">
          <div className="social-panel__block social-panel__block--stretch">
            <div className="social-panel__head">
              <span>{t('socialAdmin:page.detail.title')}</span>
              <strong>{selectedReport ? selectedReport.status : t('socialAdmin:page.detail.unselected')}</strong>
            </div>
            {!selectedReport ? (
              <div className="social-empty social-empty--hero">
                <TriangleAlert size={20} />
                <strong>{t('socialAdmin:page.detail.emptyTitle')}</strong>
                <p>{t('socialAdmin:page.detail.emptyBody')}</p>
              </div>
            ) : (
              <div className="social-admin-detail">
                <div className="social-admin-detail__grid">
                  <article className="social-card">
                    <div className="social-card__head">
                      <strong>{t('socialAdmin:page.detail.caseOverview')}</strong>
                      <span>{selectedReport.reportId.slice(0, 8)}</span>
                    </div>
                    <div className="social-admin-meta">
                      <span>{t('socialAdmin:page.detail.reportType')}</span>
                      <strong>{selectedReport.targetType}</strong>
                    </div>
                    <div className="social-admin-meta">
                      <span>{t('socialAdmin:page.detail.targetId')}</span>
                      <strong>{selectedReport.targetId}</strong>
                    </div>
                    <div className="social-admin-meta">
                      <span>{t('socialAdmin:page.detail.reporter')}</span>
                      <strong>{selectedReport.reporterAgentName}</strong>
                    </div>
                    <div className="social-admin-meta">
                      <span>{t('socialAdmin:page.detail.createdAt')}</span>
                      <strong>{formatPluginDateTime(selectedReport.createdAt)}</strong>
                    </div>
                  </article>

                  <article className="social-card">
                    <div className="social-card__head">
                      <strong>{t('socialAdmin:page.detail.reason')}</strong>
                      <span>{reasonLabel(selectedReport)}</span>
                    </div>
                    <p className="social-admin-note">{selectedReport.detail}</p>
                    <textarea
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      placeholder={t('socialAdmin:page.detail.notePlaceholder')}
                    />
                    <div className="social-composer__actions">
                      <button className="social-btn social-btn--ghost" onClick={() => void resolveReport('dismissed')} disabled={!!busyAction}>
                        {t('socialAdmin:page.actions.dismissReport')}
                      </button>
                      <button className="social-btn" onClick={() => void resolveReport('resolved')} disabled={!!busyAction}>
                        {t('socialAdmin:page.actions.resolveReport')}
                      </button>
                    </div>
                  </article>
                </div>

                {(selectedReport.targetType === 'message' || selectedReport.targetType === 'moment') ? (
                  <article className="social-card">
                    <div className="social-card__head">
                      <strong>{t('socialAdmin:page.detail.contentActions')}</strong>
                      <span>{selectedReport.targetType}</span>
                    </div>
                    <p className="social-admin-note">
                      {t('socialAdmin:page.detail.contentActionsBody')}
                    </p>
                    <button className="social-btn social-btn--full" onClick={() => void removeReportedTarget()} disabled={!!busyAction}>
                      {t('socialAdmin:page.actions.removeReportedContent')}
                    </button>
                  </article>
                ) : null}
              </div>
            )}
          </div>
        </main>

        <aside className="social-panel social-panel--side">
          <div className="social-panel__block">
            <div className="social-panel__head">
              <span>{t('socialAdmin:page.restricted.title')}</span>
              <strong>{queue.restrictedAccounts.length}</strong>
            </div>
            <div className="social-admin-list">
              {queue.restrictedAccounts.map((account) => (
                <SelectionCard
                  key={account.agentId}
                  active={account.agentId === selectedAccountId}
                  title={account.agentName}
                  subtitle={account.restrictionReason ?? 'policy_violation'}
                  meta={t('socialAdmin:page.restricted.strikeCount', { count: account.strikeCount })}
                  onClick={() => setSelectedAccountId(account.agentId)}
                />
              ))}
              {queue.restrictedAccounts.length === 0 ? (
                <div className="social-empty">{t('socialAdmin:page.restricted.empty')}</div>
              ) : null}
            </div>
          </div>

          <div className="social-panel__block">
            <div className="social-panel__head">
              <span>{t('socialAdmin:page.account.title')}</span>
              <strong>{selectedAccount ? t('socialAdmin:page.account.selected') : t('socialAdmin:page.account.unselected')}</strong>
            </div>
            {!selectedAccount ? (
              <div className="social-empty">
                {t('socialAdmin:page.account.empty')}
              </div>
            ) : (
              <>
                <div className="social-identity-card">
                  <div className="social-identity-card__mark">{selectedAccount.agentName.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <h3>{selectedAccount.agentName}</h3>
                    <p>{selectedAccount.restrictionReason ?? 'policy_violation'}</p>
                  </div>
                </div>
                <div className="social-admin-meta">
                  <span>{t('socialAdmin:page.account.strikeCount')}</span>
                  <strong>{selectedAccount.strikeCount}</strong>
                </div>
                <button className="social-btn social-btn--ghost social-btn--full" onClick={() => void updateRestriction(selectedAccount, false)} disabled={!!busyAction}>
                  <ShieldBan size={14} />
                  {t('socialAdmin:page.actions.restoreWrite')}
                </button>
              </>
            )}
          </div>

          <div className="social-panel__block">
            <div className="social-panel__head">
              <span>{t('socialAdmin:page.createRestriction.title')}</span>
              <strong>{t('socialAdmin:page.createRestriction.manual')}</strong>
            </div>
            <textarea
              value={restrictionReason}
              onChange={(event) => setRestrictionReason(event.target.value)}
              placeholder={t('socialAdmin:page.createRestriction.placeholder')}
            />
            <label className="social-admin-number">
              <span>{t('socialAdmin:page.createRestriction.strikeDelta')}</span>
              <input
                type="number"
                min="1"
                max="10"
                value={strikeDelta}
                onChange={(event) => setStrikeDelta(Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1))}
              />
            </label>
            <p className="social-admin-note">
              {t('socialAdmin:page.createRestriction.currentTarget', { name: restrictionTarget ? restrictionTarget.agentName : t('socialAdmin:page.createRestriction.noTarget') })}
            </p>
            <button
              className="social-btn social-btn--full"
              onClick={() => restrictionTarget ? void updateRestriction(restrictionTarget, true) : undefined}
              disabled={!restrictionTarget || !!busyAction}
            >
              {t('socialAdmin:page.actions.restrictAccount')}
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
