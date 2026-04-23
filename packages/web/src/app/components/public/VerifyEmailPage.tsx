import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthApi } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { PublicPageShell } from './PublicPageShell';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const email = searchParams.get('email') ?? '';
  const nextPath = searchParams.get('next');

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!email) {
      setError('Missing verification email.');
      return;
    }
    setLoading(true);
    try {
      const result = await AuthApi.verifyEmail(email, code.trim());
      login(result.user);
      navigate(nextPath && nextPath.startsWith('/') ? nextPath : '/workspace', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to verify email.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError('');
    setSuccess('');
    if (!email) {
      setError('Missing verification email.');
      return;
    }
    setResending(true);
    try {
      await AuthApi.resendCode(email);
      setSuccess('A fresh verification code has been sent if the address is eligible.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <PublicPageShell
      eyebrow="Verification"
      title="Confirm your email address"
      description="This route keeps the existing server-side verification flow but moves it into the new auth route family."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-[32px] border border-zinc-200 bg-white/85 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Verification target
          </h2>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Email</p>
            <p className="mt-3 text-lg font-medium">{email || 'No email in query string'}</p>
          </div>
        </section>

        <section className="rounded-[32px] border border-zinc-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
          <form className="space-y-5" onSubmit={onVerify}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Verification code
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Finish account activation</h2>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                {success}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="verification-code">Code</Label>
              <Input
                id="verification-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={6}
                placeholder="123456"
                required
              />
            </div>

            <Button className="w-full rounded-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify email'}
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-full" disabled={resending} onClick={onResend}>
              {resending ? 'Resending…' : 'Resend code'}
            </Button>
          </form>
        </section>
      </div>
    </PublicPageShell>
  );
}
