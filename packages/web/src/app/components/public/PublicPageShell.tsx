import type { ReactNode } from 'react';

import cityBg from '../../../assets/city-bg.png';
import cityLightBg from '../../../assets/city-light-bg.png';

export function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-zinc-950 dark:bg-[#09090B] dark:text-zinc-50">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-10 mix-blend-multiply dark:opacity-20 dark:mix-blend-luminosity"
          style={{ backgroundImage: `url(${cityLightBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div
          className="absolute inset-0 hidden opacity-20 dark:block dark:mix-blend-luminosity"
          style={{ backgroundImage: `url(${cityBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-4 py-12 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
