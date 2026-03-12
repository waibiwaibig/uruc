import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(t('callback.loading'));

  useEffect(() => {
    void DashboardApi.me()
      .then((res) => {
        login(res.user);
        navigate('/lobby', { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('callback.failure'));
      });
  }, [login, navigate, t]);

  return (
    <div className="page-wrap page-narrow">
      <section className="card auth-panel">
        <div className="panel-copy">
          <p className="section-label">{t('callback.label')}</p>
          <h1 className="section-title">{t('callback.title')}</h1>
          <p className="section-sub">{error}</p>
        </div>
      </section>
    </div>
  );
}
