import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function VerifyEmailPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const email = searchParams.get('email') ?? '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onVerify = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError(t('auth:verify.missingEmail'));
      return;
    }

    setLoading(true);
    try {
      const res = await AuthApi.verifyEmail(email, code.trim());
      login(res.user);
      navigate('/lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:verify.verifyFailure'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError('');
    setSuccess('');

    if (!email) {
      setError(t('auth:verify.missingEmail'));
      return;
    }

    setResending(true);
    try {
      await AuthApi.resendCode(email);
      setSuccess(t('auth:verify.resendSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:verify.resendFailure'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="page-wrap page-auth">
      <div className="auth-layout">
        <section className="card auth-lore">
          <div className="stack-lg">
            <div className="stack-md">
              <p className="kicker">{t('auth:verify.kicker')}</p>
              <h1 className="section-title">{t('auth:verify.title')}</h1>
              <p className="section-sub">{t('auth:verify.subtitle')}</p>
            </div>

            <div className="note-tablet">
              <strong>{t('auth:verify.targetEmail')}</strong>
              <p className="tiny muted u-mt-1">{email || t('auth:verify.missingEmail')}</p>
            </div>
          </div>

          <div className="pill-row">
            <span className="status-chip"><ShieldCheck size={14} /> {t('auth:verify.badge')}</span>
            <span className="status-chip">{t('auth:verify.badgeSub')}</span>
          </div>
        </section>

        <section className="card auth-panel">
          <div className="panel-copy">
            <p className="section-label">{t('auth:verify.formLabel')}</p>
            <h2 className="section-title title-card">{t('auth:verify.formTitle')}</h2>
            <p className="section-sub">{t('auth:verify.formSub')}</p>
          </div>

          <form className="field-grid" onSubmit={onVerify}>
            {error ? <div className="notice error">{error}</div> : null}
            {success ? <div className="notice success">{success}</div> : null}

            <label>
              <span className="label">{t('common:labels.verificationCode')}</span>
              <input
                className="app-input mono"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('common:placeholders.verificationCode')}
                required
              />
            </label>

            <button className="app-btn" disabled={loading}>
              <span className="row"><ShieldCheck size={14} /> {loading ? t('auth:verify.verifying') : t('common:actions.finishVerification')}</span>
            </button>

            <button type="button" className="app-btn secondary" disabled={resending} onClick={onResend}>
              {resending ? t('auth:verify.resending') : t('common:actions.resendCode')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
