import { Outlet } from 'react-router-dom';
import { LanguageToggle } from './LanguageToggle';

export function PublicShell() {
  return (
    <div className="public-shell">
      <div className="public-shell__utility">
        <LanguageToggle />
      </div>
      <Outlet />
    </div>
  );
}
