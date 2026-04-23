import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthApi } from '../../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { PublicPageShell } from './PublicPageShell';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await AuthApi.register(username.trim(), email.trim(), password);
      navigate(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicPageShell
      eyebrow="Registration"
      title="Create a workspace account"
      description="Registration still uses the existing backend validation and email verification flow; only the frontend surface has changed."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="rounded-[32px] border border-zinc-200 bg-white/85 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Account setup
          </h2>
          <div className="mt-6 grid gap-4">
            {[
              'Usernames and email addresses are validated by the existing auth service.',
              'Successful registration redirects into email verification before protected routes open.',
              'No backend contract changed in this migration; only the route surface moved to `/auth/*`.',
            ].map((item) => (
              <article
                key={item}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
              >
                {item}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-zinc-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                New operator
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Create account</h2>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="register-username">Username</Label>
              <Input id="register-username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password-confirm">Confirm password</Label>
                <Input
                  id="register-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            <Button className="w-full rounded-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Already registered?{' '}
              <Link className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100" to="/auth/login">
                Sign in
              </Link>
              .
            </p>
          </form>
        </section>
      </div>
    </PublicPageShell>
  );
}
