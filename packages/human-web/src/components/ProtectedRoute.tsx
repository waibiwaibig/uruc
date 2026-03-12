import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('auth');
  const { ready, user } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="page-wrap page-narrow">
        <section className="card auth-panel">
          <p className="section-label">{t('protected.label')}</p>
          <h1 className="section-title">{t('protected.title')}</h1>
          <p className="section-sub">{t('protected.subtitle')}</p>
        </section>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
