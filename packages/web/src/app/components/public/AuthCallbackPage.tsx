import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardApi } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PublicPageShell } from './PublicPageShell';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('Finalizing OAuth session…');

  useEffect(() => {
    void DashboardApi.me()
      .then((response) => {
        login(response.user);
        navigate('/workspace', { replace: true });
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : 'OAuth callback failed.');
      });
  }, [login, navigate]);

  return (
    <PublicPageShell
      eyebrow="OAuth Callback"
      title="Finishing sign in"
      description="The backend callback already set the session cookie. This page only restores the profile and forwards into the workspace."
    >
      <section className="max-w-xl rounded-[32px] border border-zinc-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">{status}</p>
      </section>
    </PublicPageShell>
  );
}
