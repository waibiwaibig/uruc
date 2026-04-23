import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Settings2 } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { AuthApi } from '../../../lib/api';
import { Button } from '../ui/Button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export type SessionUser = {
  name: string;
  email?: string;
  initials: string;
};

type AccountControlsProps = {
  session: SessionUser | null;
  onSignOut: () => void;
  onOpenSettings: () => void;
};

function toUsernameSeed(name: string, email: string) {
  const input = (name.trim() || email.split('@')[0] || 'uruc-user')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return input || 'uruc-user';
}

async function registerWithDerivedUsername(name: string, email: string, password: string) {
  const base = toUsernameSeed(name, email);
  const localPart = toUsernameSeed(email.split('@')[0] ?? '', email);
  const candidates = Array.from(new Set([
    base,
    `${base}-${localPart}`.slice(0, 32),
    `${base}-${Date.now().toString(36).slice(-6)}`.slice(0, 32),
  ]));

  let lastError: unknown = null;

  for (const username of candidates) {
    try {
      return await AuthApi.register(username, email, password);
    } catch (error) {
      const code = error instanceof Error ? ((error as Error & { code?: string }).code ?? '') : '';
      if (code === 'USERNAME_TAKEN') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to create account.');
}

export function AccountControls({
  session,
  onSignOut,
  onOpenSettings,
}: AccountControlsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [authView, setAuthView] = useState<'signin' | 'create'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedAuthView = searchParams.get('auth');
  const nextPath = searchParams.get('next');

  const clearAuthIntent = () => {
    if (!requestedAuthView && !nextPath) {
      return;
    }
    const next = new URLSearchParams(location.search);
    next.delete('auth');
    next.delete('next');
    const query = next.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true });
  };

  useEffect(() => {
    if (session) {
      return;
    }
    if (requestedAuthView === 'signin' || requestedAuthView === 'create') {
      setAuthView(requestedAuthView);
      setIsSignInOpen(true);
    }
  }, [requestedAuthView, session]);

  function resetDialogState() {
    setLoading(false);
    setError('');
    setAuthView('signin');
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsSignInOpen(nextOpen);
    if (!nextOpen) {
      resetDialogState();
      clearAuthIntent();
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '').trim();

    if (!email || !password) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await AuthApi.login(email, password);
      login(result.user);
      setIsSignInOpen(false);
      resetDialogState();
      event.currentTarget.reset();
      navigate(nextPath && nextPath.startsWith('/') ? nextPath : '/workspace', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to sign in.');
      setLoading(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '').trim();
    const confirmPassword = String(formData.get('confirmPassword') ?? '').trim();

    if (!email || !password || !confirmPassword || password !== confirmPassword) {
      setError(password !== confirmPassword ? 'Passwords do not match.' : 'Please complete the form.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await registerWithDerivedUsername(name, email, password);
      setIsSignInOpen(false);
      resetDialogState();
      event.currentTarget.reset();
      const params = new URLSearchParams({ email });
      if (nextPath && nextPath.startsWith('/')) {
        params.set('next', nextPath);
      }
      navigate(`/auth/verify-email?${params.toString()}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create account.');
      setLoading(false);
    }
  }

  return (
    <>
      {session ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 size-9 rounded-full border border-zinc-200 p-0 shadow-none transition-[background-color,border-color,box-shadow] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-zinc-300 data-[state=open]:bg-zinc-50 data-[state=open]:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:shadow-none dark:data-[state=open]:border-zinc-700 dark:data-[state=open]:bg-zinc-900 dark:data-[state=open]:shadow-none"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {session.initials}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Open account menu</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-64 rounded-xl border-zinc-200 bg-white/95 p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950/95"
          >
            <DropdownMenuLabel className="flex flex-col gap-1 px-2 py-2">
              <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {session.name}
              </span>
              {session.email ? (
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {session.email}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onOpenSettings();
                }}
              >
                <Settings2 />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                onSignOut();
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="ml-2 h-9 rounded-full border-zinc-200 px-4 text-sm dark:border-zinc-800"
          onClick={() => setIsSignInOpen(true)}
        >
          Sign in
        </Button>
      )}

      <Dialog open={isSignInOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>
              {authView === 'signin' ? 'Sign in' : 'Create account'}
            </DialogTitle>
            <DialogDescription>
              {authView === 'signin'
                ? 'Enter your account details to open your Uruc workspace.'
                : 'Create a new workspace account to access the Uruc launchpad.'}
            </DialogDescription>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </DialogHeader>

          <Tabs
            value={authView}
            onValueChange={(value) => {
              setAuthView(value as 'signin' | 'create');
              setError('');
            }}
            className="gap-4"
          >
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="create">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="flex flex-col gap-4" onSubmit={(event) => void handleSignIn(event)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="operator@uruc.local"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter password"
                    required
                  />
                </div>

                <DialogFooter className="mt-2">
                  <Button type="button" variant="ghost" disabled={loading} onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="create">
              <form className="flex flex-col gap-4" onSubmit={(event) => void handleCreateAccount(event)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="create-name">Display name</Label>
                  <Input
                    id="create-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Uruc Operator"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="operator@uruc.local"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="create-password">Password</Label>
                    <Input
                      id="create-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Create password"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="create-confirm-password">Confirm</Label>
                    <Input
                      id="create-confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      required
                    />
                  </div>
                </div>

                <DialogFooter className="mt-2">
                  <Button type="button" variant="ghost" disabled={loading} onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating…' : 'Create account'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
