import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { AdminOnlyMessage, buildWorkspaceAuthRedirect } from './ProtectedRoute';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!user) {
    return <Navigate to={buildWorkspaceAuthRedirect(location.pathname, location.search)} replace />;
  }
  if (user.role !== 'admin') {
    return <AdminOnlyMessage />;
  }
  return <>{children}</>;
}
