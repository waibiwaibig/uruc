import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { AuthApi } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { localizeCoreError } from '../../../lib/error-text';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { PublicPageShell } from './PublicPageShell';

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/workspace';
  const params = new URLSearchParams(location.search);
  const redirectError = params.get('error') ?? '';
  const redirectCode = params.get('code') ?? undefined;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    redirectCode || redirectError ? localizeCoreError(redirectCode, redirectError || undefined) : '',
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await AuthApi.login(username.trim(), password);
      login(result.user);
      navigate(redirectTo, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicPageShell
      eyebrow="Authentication"
      title="Sign in to the workspace"
      description="The top-bar mock auth dialog has been replaced with real session routes that talk to the backend auth API."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-[32px] border border-zinc-200 bg-white/85 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Before entry
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <h3 className="font-medium">Browser session</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Login sets the existing server session cookie and unlocks protected workspace routes.
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <h3 className="font-medium">OAuth</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Google and GitHub continue to use the same backend callback flow and redirect into `/auth/callback`.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-[32px] border border-zinc-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Operator access
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Enter city control</h2>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <Button className="w-full rounded-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full">
                <a href="/api/auth/oauth/google">Continue with Google</a>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <a href="/api/auth/oauth/github">Continue with GitHub</a>
              </Button>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Need a new operator account?{' '}
              <Link className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100" to="/auth/register">
                Create one here
              </Link>
              .
            </p>
          </form>
        </section>
      </div>
    </PublicPageShell>
  );
}
