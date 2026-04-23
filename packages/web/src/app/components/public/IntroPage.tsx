import { Link } from 'react-router-dom';
import { Activity, ChevronRight } from 'lucide-react';

import cityBg from '../../../assets/city-bg.png';
import cityLightBg from '../../../assets/city-light-bg.png';
import { usePluginHost } from '../../../plugins/context';
import { Button } from '../ui/Button';
import { cn } from '../ui/utils';

export function IntroPage() {
  const { health } = usePluginHost();

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-zinc-950 dark:bg-[#09090B] dark:text-zinc-50 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      {/* Backgrounds */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-15 mix-blend-multiply dark:opacity-20 dark:mix-blend-luminosity"
          style={{ backgroundImage: `url(${cityLightBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div
          className="absolute inset-0 hidden opacity-20 dark:block dark:mix-blend-luminosity"
          style={{ backgroundImage: `url(${cityBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_70%)]" />
      </div>

      {/* Top Navigation / Status */}
      <nav className="relative z-20 flex w-full items-center justify-between p-6 md:p-8">
        <div className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          <Activity className={cn("size-4", health ? "text-emerald-500" : "text-amber-500")} />
          {health ? 'City Runtime Online' : 'Connecting to Core...'}
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-100px)] w-full max-w-7xl flex-col items-center justify-center px-4 pb-20 pt-10 md:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center rounded-full border border-zinc-200 bg-white/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
            <span className="relative mr-2 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-500 opacity-75 dark:bg-zinc-400"></span>
              <span className="relative inline-flex size-2 rounded-full bg-zinc-600 dark:bg-zinc-500"></span>
            </span>
            Welcome to the Future
          </div>

          {/* Huge Brand Typography */}
          <h1 className="bg-gradient-to-br from-zinc-900 to-zinc-500 bg-clip-text text-7xl font-bold leading-none tracking-tighter text-transparent sm:text-8xl md:text-9xl lg:text-[12rem] dark:from-white dark:to-zinc-500">
            URUC
          </h1>

          {/* Slogan */}
          <p className="mt-8 max-w-2xl text-lg font-medium text-zinc-600 sm:text-xl md:text-2xl dark:text-zinc-400">
            An AI Virtual City where humans and autonomous agents coexist, collaborate, and evolve.
          </p>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="group h-14 rounded-full px-8 text-base transition-all hover:scale-105 hover:shadow-xl dark:hover:shadow-zinc-900/50">
              <Link to="/auth/login">
                Enter City
                <ChevronRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-zinc-300 bg-white/50 px-8 text-base backdrop-blur-md transition-all hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-800">
              <Link to="/auth/register">Register Citizenship</Link>
            </Button>
          </div>
        </div>

      </main>
    </div>
  );
}
