import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRoundPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthApi } from '../lib/api';

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth:register.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth:register.passwordShort'));
      return;
    }

    if (!/[a-zA-Z]/.test(password)) {
      setError(t('auth:register.passwordNeedsLetter'));
      return;
    }

    if (!/\d/.test(password)) {
      setError(t('auth:register.passwordNeedsDigit'));
      return;
    }

    setLoading(true);
    try {
      await AuthApi.register(username.trim(), email.trim(), password);
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:register.failure'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrap page-auth">
      <div className="auth-layout">
        <section className="card auth-lore">
          <div className="stack-lg">
            <div className="stack-md">
              <p className="kicker">{t('auth:register.kicker')}</p>
              <h1 className="section-title">{t('auth:register.title')}</h1>
              <p className="section-sub">{t('auth:register.subtitle')}</p>
            </div>

            <div className="auth-lore__grid">
              <div className="note-tablet">
                <strong>{t('auth:register.afterTitle')}</strong>
                <p className="tiny muted u-mt-1">{t('auth:register.afterBody')}</p>
              </div>
              <div className="note-tablet">
                <strong>{t('auth:register.limitTitle')}</strong>
                <p className="tiny muted u-mt-1">{t('auth:register.limitBody')}</p>
              </div>
              <div className="note-tablet">
                <strong>{t('auth:register.passwordTitle')}</strong>
                <p className="tiny muted u-mt-1">{t('auth:register.passwordBody')}</p>
              </div>
            </div>
          </div>

          <div className="pill-row">
            <span className="status-chip"><UserRoundPlus size={14} /> {t('auth:register.badge')}</span>
            <span className="status-chip">{t('auth:register.badgeSub')}</span>
          </div>
        </section>

        <section className="card auth-panel">
          <div className="panel-copy">
            <p className="section-label">{t('auth:register.formLabel')}</p>
            <h2 className="section-title title-card">{t('auth:register.formTitle')}</h2>
            <p className="section-sub">{t('auth:register.formSub')}</p>
          </div>

          <form className="field-grid" onSubmit={onSubmit}>
            {error ? <div className="notice error">{error}</div> : null}

            <label>
              <span className="label">{t('common:labels.username')}</span>
              <input className="app-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('common:placeholders.ownerName')} required />
            </label>

            <label>
              <span className="label">{t('common:labels.email')}</span>
              <input type="email" className="app-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
            </label>

            <div className="field-inline">
              <label>
                <span className="label">{t('common:labels.password')}</span>
                <input type="password" className="app-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>

              <label>
                <span className="label">{t('common:labels.confirmPassword')}</span>
                <input type="password" className="app-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </label>
            </div>

            <button className="app-btn" disabled={loading}>
              <span className="row"><UserRoundPlus size={14} /> {loading ? t('auth:register.loading') : t('common:actions.submitRegister')}</span>
            </button>
          </form>

          <div className="utility-links tiny muted">
            <span>{t('auth:register.existingAccount')}</span>
            <Link className="link-btn" to="/login">{t('common:actions.backToLogin')}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
