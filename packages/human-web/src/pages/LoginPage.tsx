import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuthApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { localizeCoreError } from '../lib/error-text';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const params = new URLSearchParams(location.search);
  const redirectError = params.get('error') ?? '';
  const redirectCode = params.get('code') ?? undefined;
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/lobby';
  const initialError = redirectCode || redirectError ? localizeCoreError(redirectCode, redirectError || undefined) : '';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const onSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await AuthApi.login(username.trim(), password);
      login(res.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:login.failure'));
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
              <p className="kicker">{t('auth:login.kicker')}</p>
              <h1 className="section-title">{t('auth:login.title')}</h1>
              <p className="section-sub">{t('auth:login.subtitle')}</p>
            </div>

            <div className="auth-lore__grid">
              <div className="note-tablet">
                <strong>{t('auth:login.benefitTitle')}</strong>
                <p className="tiny muted u-mt-1">{t('auth:login.benefitBody')}</p>
              </div>
              <div className="note-tablet">
                <strong>{t('auth:login.reasonTitle')}</strong>
                <p className="tiny muted u-mt-1">{t('auth:login.reasonBody')}</p>
              </div>
            </div>
          </div>

          <div className="pill-row">
            <span className="status-chip"><KeyRound size={14} /> {t('auth:login.ownerEntry')}</span>
            <span className="status-chip"><LogIn size={14} /> {t('auth:login.afterLogin')}</span>
          </div>
        </section>

        <section className="card auth-panel">
          <div className="panel-copy">
            <p className="section-label">{t('auth:login.formLabel')}</p>
            <h2 className="section-title title-card">{t('auth:login.formTitle')}</h2>
            <p className="section-sub">{t('auth:login.formSub')}</p>
          </div>

          <form className="field-grid" onSubmit={onSubmit}>
            {error ? <div className="notice error">{error}</div> : null}

            <label>
              <span className="label">{t('common:labels.username')}</span>
              <input
                className="app-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('common:placeholders.username')}
                required
              />
            </label>

            <label>
              <span className="label">{t('common:labels.password')}</span>
              <input
                type="password"
                className="app-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('common:placeholders.password')}
                required
              />
            </label>

            <button className="app-btn" disabled={loading}>
              <span className="row"><LogIn size={14} /> {loading ? t('auth:login.loading') : t('common:actions.loginAndEnter')}</span>
            </button>

            <div className="note-tablet">
              <div className="row wrap tiny muted">
                <span>{t('auth:login.oauth')}</span>
                <a className="link-btn" href="/api/auth/oauth/google">Google</a>
                <a className="link-btn" href="/api/auth/oauth/github">GitHub</a>
              </div>
            </div>
          </form>

          <div className="utility-links tiny muted">
            <span>{t('auth:login.noAccount')}</span>
            <Link className="link-btn" to="/register">{t('common:actions.goToRegister')}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
