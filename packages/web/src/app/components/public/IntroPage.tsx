import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { resolvePluginIcon } from '../../../plugins/icons';
import { usePluginHost } from '../../../plugins/context';
import { Button } from '../ui/Button';
import { PublicPageShell } from './PublicPageShell';

export function IntroPage() {
  const { t } = useTranslation();
  const { enabledIntroCards, health } = usePluginHost();
  const pluginMap = new Map((health?.plugins ?? []).map((plugin) => [plugin.name, plugin]));

  return (
    <PublicPageShell
      eyebrow="Uruc Public Gateway"
      title="A new workspace shell for the city runtime"
      description="The new web host keeps the visual direction from your redesign while taking over authentication, agent control, venues, and runtime-mounted plugin pages."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-[32px] border border-zinc-200 bg-white/85 p-8 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-full px-6">
              <Link to="/workspace?auth=signin">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link to="/workspace?auth=create">Create account</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Host state
              </h2>
              <p className="mt-3 text-2xl font-semibold">
                {health ? 'Online' : 'Waiting for server'}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                The intro page is already using the live plugin registry and backend health endpoint.
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Runtime plugins
              </h2>
              <p className="mt-3 text-2xl font-semibold">
                {enabledIntroCards.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Intro cards below are sourced from the live frontend plugin host instead of mock data.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-[32px] border border-zinc-200 bg-white/85 p-6 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            City highlights
          </h2>
          <div className="mt-5 grid gap-3">
            {enabledIntroCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-5 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                No plugin intro cards are active yet.
              </div>
            ) : (
              enabledIntroCards.map((card) => {
                const Icon = resolvePluginIcon(card.icon);
                const plugin = pluginMap.get(card.pluginId);
                return (
                  <article
                    key={`${card.pluginId}:${card.id}`}
                    className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                      <Icon className="size-5 text-zinc-700 dark:text-zinc-200" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{t(card.titleKey)}</h3>
                        <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          {plugin?.started ? 'Open' : 'Idle'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        {t(card.bodyKey)}
                      </p>
                      <p className="mt-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        {card.pluginId}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
