import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Landmark, LogOut, UserRoundCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import { LanguageToggle } from './LanguageToggle';

export function AppShell() {
  const { t } = useTranslation(['nav', 'common']);
  const { user, logout } = useAuth();
  const runtime = useAgentRuntime();
  const location = useLocation();
  const navigate = useNavigate();
  const links = [
    { to: '/lobby', label: t('nav:lobby'), icon: Landmark },
    { to: '/agents', label: t('nav:agents'), icon: UserRoundCog },
  ];

  const handleLogout = () => {
    runtime.disconnect();
    logout();
    navigate('/login');
  };

  const isAgentConsole = location.pathname === '/agents';

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="inner">
          <NavLink to="/lobby" className="brand">
            <span className="brand-mark" />
            <span className="brand-copy">
              <span className="brand-title">Uruc</span>
              <span className="brand-subtitle">golden city human console</span>
            </span>
          </NavLink>

          <nav className="nav-links">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="row">
                  <link.icon size={14} />
                  {link.label}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="nav-right">
            {isAgentConsole ? (
              <div className="nav-context">
                <span className="role-chip mono">{runtime.isConnected ? t('common:status.connectedWs') : t('common:status.disconnectedWs')}</span>
              </div>
            ) : null}
            <LanguageToggle />
            {user ? (
              <>
                <span className="role-chip">
                  {user.username} · {user.role === 'admin' ? t('common:status.adminRole') : t('common:status.ownerRole')}
                </span>
                <button className="app-btn secondary" onClick={handleLogout}>
                  <span className="row"><LogOut size={14} /> {t('common:actions.logout')}</span>
                </button>
              </>
            ) : (
              <NavLink to="/login" className="app-btn">{t('common:actions.login')}</NavLink>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
