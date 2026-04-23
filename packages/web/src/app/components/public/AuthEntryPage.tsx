import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../../context/AuthContext';
import { AuthApi } from '../../../lib/api';
import { localizeCoreError } from '../../../lib/error-text';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../ui/utils';
import { PublicPageShell } from './PublicPageShell';

type AuthMode = 'signin' | 'register';
type StatusTone = 'neutral' | 'success' | 'error';

function statusClassName(tone: StatusTone) {
  if (tone === 'error') return 'text-red-700 dark:text-red-300';
  if (tone === 'success') return 'text-emerald-700 dark:text-emerald-300';
  return 'text-zinc-500 dark:text-zinc-400';
}

export function AuthEntryPage({ defaultMode }: { defaultMode: AuthMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/workspace';
  const params = new URLSearchParams(location.search);
  const redirectError = params.get('error') ?? '';
  const redirectCode = params.get('code') ?? undefined;
  const emailFromQuery = params.get('email')?.trim() ?? '';

  const [mode, setMode] = useState<AuthMode>(defaultMode);

  const [signInUsername, setSignInUsername] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInStatus, setSignInStatus] = useState(
    redirectCode || redirectError ? localizeCoreError(redirectCode, redirectError || undefined) : '',
  );

  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState(emailFromQuery);
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const [sendCodeCooldown, setSendCodeCooldown] = useState(0);
  const [codeTargetEmail, setCodeTargetEmail] = useState(emailFromQuery);
  const [emailStatus, setEmailStatus] = useState('');
  const [emailStatusTone, setEmailStatusTone] = useState<StatusTone>('neutral');
  const [registerStatus, setRegisterStatus] = useState('');
  const [registerStatusTone, setRegisterStatusTone] = useState<StatusTone>('neutral');
  const [registerLoading, setRegisterLoading] = useState(false);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    if (!emailFromQuery) return;
    setRegisterEmail(emailFromQuery);
    setCodeTargetEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (sendCodeCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSendCodeCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCodeCooldown]);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignInLoading(true);
    setSignInStatus('');
    try {
      const result = await AuthApi.login(signInUsername.trim(), signInPassword);
      login(result.user);
      navigate(redirectTo, { replace: true });
    } catch (nextError) {
      setSignInStatus(nextError instanceof Error ? nextError.message : 'Unable to sign in.');
    } finally {
      setSignInLoading(false);
    }
  };

  const onSendCode = async () => {
    const nextEmail = registerEmail.trim();
    setEmailStatus('');
    setRegisterStatus('');
    setRegisterStatusTone('neutral');
    setSendCodeLoading(true);
    try {
      await AuthApi.sendRegistrationCode(nextEmail);
      setCodeTargetEmail(nextEmail);
      setSendCodeCooldown(60);
      setEmailStatus('Code sent');
      setEmailStatusTone('success');
    } catch (nextError) {
      setEmailStatus(nextError instanceof Error ? nextError.message : 'Unable to send code.');
      setEmailStatusTone('error');
    } finally {
      setSendCodeLoading(false);
    }
  };

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterStatus('');
    setRegisterStatusTone('neutral');

    if (registerPassword !== registerConfirmPassword) {
      setRegisterStatus('Passwords do not match.');
      setRegisterStatusTone('error');
      return;
    }

    const nextEmail = registerEmail.trim();
    if (!verificationCode.trim()) {
      setRegisterStatus('Enter the verification code.');
      setRegisterStatusTone('error');
      return;
    }

    if (!codeTargetEmail || codeTargetEmail !== nextEmail) {
      setRegisterStatus('Send a code to this email first.');
      setRegisterStatusTone('error');
      return;
    }

    setRegisterLoading(true);
    try {
      const result = await AuthApi.register(
        registerUsername.trim(),
        nextEmail,
        registerPassword,
        verificationCode.trim(),
      );
      login(result.user);
      navigate(redirectTo, { replace: true });
    } catch (nextError) {
      setRegisterStatus(nextError instanceof Error ? nextError.message : 'Unable to create account.');
      setRegisterStatusTone('error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const codeMatchesCurrentEmail = registerEmail.trim() !== '' && codeTargetEmail === registerEmail.trim();
  const sendCodeLabel = sendCodeLoading
    ? 'Sending…'
    : codeMatchesCurrentEmail
      ? sendCodeCooldown > 0
        ? `Resend in ${sendCodeCooldown}s`
        : 'Resend code'
      : 'Send code';

  return (
    <PublicPageShell
      title="sign in to Uruc"
      description="Use your operator account to access the live workspace."
      headerAlign="center"
      headerWidthClassName="max-w-4xl"
      descriptionClassName="max-w-none whitespace-nowrap text-center leading-6"
    >
      <section className="mx-auto w-full max-w-[480px] rounded-[32px] border border-zinc-200 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
        <Tabs value={mode} onValueChange={(nextMode) => setMode(nextMode as AuthMode)} className="flex flex-col gap-5">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-full bg-zinc-100/80 p-1 dark:bg-zinc-900/80">
            <TabsTrigger
              value="signin"
              className="rounded-full px-4 py-2.5 text-sm transition-all data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-950"
            >
              Sign in
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="rounded-full px-4 py-2.5 text-sm transition-all data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-950"
            >
              Create account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-2 animate-in fade-in zoom-in-95 duration-300">
            <form className="grid gap-4" onSubmit={onSignIn}>
              <div className="grid gap-1.5">
                <Label htmlFor="login-username">Username or email</Label>
                <Input
                  id="login-username"
                  value={signInUsername}
                  onChange={(event) => setSignInUsername(event.target.value)}
                  placeholder="admin or admin@example.com"
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="rounded-xl"
                  required
                />
              </div>

              {signInStatus && (
                <div className={cn('text-sm font-medium animate-in slide-in-from-top-1', statusClassName('error'))}>
                  {signInStatus}
                </div>
              )}

              <Button className="mt-2 w-full rounded-full font-medium" disabled={signInLoading}>
                {signInLoading ? 'Signing in…' : 'Sign in'}
              </Button>

              <div className="flex items-center gap-3 py-1 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800"></div>
                <span className="font-medium tracking-wider">Or continue with</span>
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800"></div>
              </div>

              <div className="grid gap-3">
                <Button asChild variant="outline" className="rounded-full font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <a href="/api/auth/oauth/google">Continue with Google</a>
                </Button>
                <Button asChild variant="outline" className="rounded-full font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <a href="/api/auth/oauth/github">Continue with GitHub</a>
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-2 animate-in fade-in zoom-in-95 duration-300">
            <form className="grid gap-4" onSubmit={onRegister}>
              <div className="grid gap-1.5">
                <Label htmlFor="register-username">Username</Label>
                <Input
                  id="register-username"
                  value={registerUsername}
                  onChange={(event) => setRegisterUsername(event.target.value)}
                  className="rounded-xl"
                  placeholder="Choose a username"
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="register-email">Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="register-email"
                    type="email"
                    className="flex-1 rounded-xl"
                    value={registerEmail}
                    onChange={(event) => {
                      setRegisterEmail(event.target.value);
                      setEmailStatus('');
                    }}
                    placeholder="Enter your email"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 rounded-xl px-4 font-medium"
                    disabled={sendCodeLoading || (codeMatchesCurrentEmail && sendCodeCooldown > 0)}
                    onClick={onSendCode}
                  >
                    {sendCodeLabel}
                  </Button>
                </div>
                {emailStatus && (
                  <p className={cn('text-xs font-medium animate-in fade-in', statusClassName(emailStatusTone))}>
                    {emailStatus}
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="verification-code">Verification code</Label>
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(event) => {
                    setVerificationCode(event.target.value);
                    setRegisterStatus('');
                  }}
                  maxLength={6}
                  className="rounded-xl text-center tracking-widest"
                  placeholder="123456"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    className="rounded-xl"
                    placeholder="Create a password"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="register-password-confirm">Confirm password</Label>
                  <Input
                    id="register-password-confirm"
                    type="password"
                    value={registerConfirmPassword}
                    onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                    className="rounded-xl"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>

              {registerStatus && (
                <div className={cn('text-sm font-medium animate-in slide-in-from-top-1', statusClassName(registerStatusTone))}>
                  {registerStatus}
                </div>
              )}

              <Button className="mt-2 w-full rounded-full font-medium" disabled={registerLoading}>
                {registerLoading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </section>
    </PublicPageShell>
  );
}
