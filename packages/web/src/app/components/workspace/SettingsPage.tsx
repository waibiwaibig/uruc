import { useEffect, useState } from 'react';
import { Bell, Languages, LogOut, MoonStar, Shield, SunMedium } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import i18n, { getCurrentLocale, setLocale } from '../../../i18n';
import type { AppLocale } from '../../../lib/storage';
import { useWorkspaceSurface } from '../../context/WorkspaceSurfaceContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { TokenTable } from '../dashboard/TokenTable';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

type SettingsPageProps = {
  isDark: boolean;
  toggleTheme: () => void;
};

export function SettingsPage({
  isDark,
  toggleTheme,
}: SettingsPageProps) {
  const { user, logout } = useAuth();
  const { preferences, updatePreference } = useWorkspaceSurface();
  const [isTokenTableOpen, setIsTokenTableOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<AppLocale>(() => getCurrentLocale());

  useEffect(() => {
    const syncLocale = () => setCurrentLocale(getCurrentLocale());
    i18n.on('languageChanged', syncLocale);
    return () => {
      i18n.off('languageChanged', syncLocale);
    };
  }, []);

  const changeLocale = (nextLocale: AppLocale) => {
    if (nextLocale === currentLocale) return;
    void setLocale(nextLocale);
  };

  const session = user
    ? {
      name: user.username,
      email: user.email ?? '',
    }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6 xl:p-8">
      <TokenTable isOpen={isTokenTableOpen} onClose={() => setIsTokenTableOpen(false)} />

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Personal preferences, appearance, tokens, notifications, and sign-out live here.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <CardHeader className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <CardTitle className="text-base font-medium">Account</CardTitle>
              <CardDescription>Workspace account and current session identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="font-medium">{session?.name ?? 'Guest'}</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{session?.email ?? 'No active session'}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="success">Session ready</Badge>
                  <Badge variant="outline">User workspace</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <CardHeader className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <CardTitle className="text-base font-medium">Appearance</CardTitle>
              <CardDescription>Light and dark themes share the same layout and hierarchy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isDark) {
                      toggleTheme();
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    !isDark
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50'
                  }`}
                >
                  <SunMedium className="size-5" />
                  <div className="mt-4 font-medium">Light</div>
                  <p className={`mt-2 text-sm leading-6 ${!isDark ? 'text-zinc-200' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Bright workspace surface for daytime use.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDark) {
                      toggleTheme();
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    isDark
                      ? 'border-zinc-100 bg-zinc-100 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-100'
                      : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50'
                  }`}
                >
                  <MoonStar className="size-5" />
                  <div className="mt-4 font-medium">Dark</div>
                  <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-zinc-600' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    Calm operator console for lower-light environments.
                  </p>
                </button>
              </div>

              <Separator />

              <div
                id="workspace-language-settings"
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Languages className="size-4 text-zinc-500" />
                    Language
                  </div>
                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    Controls host and plugin interface text across the workspace.
                  </p>
                </div>
                <div
                  className="inline-flex w-fit rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  role="group"
                  aria-label="Workspace language"
                >
                  <button
                    type="button"
                    onClick={() => changeLocale('en')}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      currentLocale === 'en'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => changeLocale('zh-CN')}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      currentLocale === 'zh-CN'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                    }`}
                  >
                    中文
                  </button>
                </div>
              </div>

              <Separator />

              <PreferenceRow
                label="Reduced motion"
                description="Tone down subtle motion and hover emphasis."
                checked={preferences.reducedMotion}
                onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
              />
              <PreferenceRow
                label="Compact library density"
                description="Show denser rows in the library list."
                checked={preferences.compactLibrary}
                onCheckedChange={(checked) => updatePreference('compactLibrary', checked)}
              />
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <CardHeader className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <CardTitle className="text-base font-medium">Access / Tokens</CardTitle>
              <CardDescription>Reference tokens stay available from here and from the top bar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <PreferenceRow
                label="Quick launch recent destination"
                description="Use the most recent destination for the primary continue action on Home."
                checked={preferences.quickLaunchRecent}
                onCheckedChange={(checked) => updatePreference('quickLaunchRecent', checked)}
              />
              <Button variant="outline" onClick={() => setIsTokenTableOpen(true)}>
                Open token reference
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <CardHeader className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <CardTitle className="text-base font-medium">Notifications</CardTitle>
              <CardDescription>Keep alerts useful without making the workspace noisy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <PreferenceRow
                label="Quiet notifications"
                description="Reduce low-priority alerts while agents are working."
                checked={preferences.quietNotifications}
                onCheckedChange={(checked) => updatePreference('quietNotifications', checked)}
              />
              <PreferenceRow
                label="Desktop alerts"
                description="Send system notices through the browser when appropriate."
                checked={preferences.desktopAlerts}
                onCheckedChange={(checked) => updatePreference('desktopAlerts', checked)}
              />
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <CardHeader className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <CardTitle className="text-base font-medium">Security</CardTitle>
              <CardDescription>High-level user safeguards, not city administration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <PreferenceRow
                label="Session lock"
                description="Require a quick re-check before revealing sensitive workspace controls."
                checked={preferences.securityLock}
                onCheckedChange={(checked) => updatePreference('securityLock', checked)}
              />
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="size-4 text-zinc-500" />
                  Security posture
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  User-level settings stay here. Runtime internals and admin-only city controls remain out of this surface.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <CardHeader className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <CardTitle className="text-base font-medium">Sign out</CardTitle>
              <CardDescription>End the current workspace session without leaving the design surface.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <Button variant="outline" onClick={logout}>
                <LogOut />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Bell className="size-4 text-zinc-500" />
          {label}
        </div>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
