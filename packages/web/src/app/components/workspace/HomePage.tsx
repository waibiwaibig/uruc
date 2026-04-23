import { ArrowRight, BookOpen, Bot, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

import { useWorkspaceSurface } from '../../context/WorkspaceSurfaceContext';
import { summarizeAgentStatuses } from '../../workspace-data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

import cityCoreBg from '../../../assets/city-core.png';
import agentsBg from '../../../assets/agents-bg.png';
import glassBg from '../../../assets/glass-bg.png';

export function HomePage() {
  const {
    destinations,
    agents,
    navigateToSection,
    openDestination,
  } = useWorkspaceSurface();

  const continueDestination = destinations.find((destination) => destination.isRecent) ?? destinations[0] ?? null;
  const primaryAgent = agents.find((agent) => agent.isPrimary) ?? agents[0] ?? null;
  const agentCounts = summarizeAgentStatuses(agents);
  const totalAgents = agents.length;
  const isAgentActive = agentCounts.busy > 0 || agentCounts.ready > 0;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col items-center">
      <div className="z-10 grid h-full w-full max-w-7xl flex-1 grid-cols-1 grid-rows-4 gap-6 p-4 pt-8 md:grid-cols-2 md:grid-rows-2 md:gap-8 md:p-8 md:pt-16">
        <Dialog>
          <DialogTrigger asChild>
            <motion.button
              className="group relative flex h-full w-full flex-col items-start overflow-hidden rounded-[32px] border border-zinc-200 bg-white p-8 text-left shadow-2xl transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              whileHover={{ scale: 0.995 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30 transition-transform duration-1000 group-hover:scale-105 invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen"
                style={{ backgroundImage: `url(${glassBg})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-white via-white/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 dark:to-transparent" />

              <h2 className="z-10 text-xl font-medium tracking-tight text-zinc-900 drop-shadow-sm dark:text-white dark:drop-shadow-md">Tutorial</h2>

              <div className="z-10 mt-6 flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-zinc-400 dark:text-zinc-500">1.</span>
                  <span>go to agent center and let agent connect with city</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-zinc-400 dark:text-zinc-500">2.</span>
                  <span>chat with your agent in social</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-zinc-400 dark:text-zinc-500">3.</span>
                  <span>enjoy playing</span>
                </div>
              </div>

              <div className="z-10 mt-auto flex w-full items-center justify-between">
                <div className="flex size-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 backdrop-blur-md transition-colors group-hover:border-zinc-300 group-hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800">
                  <BookOpen className="size-6 text-zinc-500 dark:text-zinc-300" />
                </div>
                <ArrowRight className="size-5 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-white" />
              </div>
            </motion.button>
          </DialogTrigger>
          <DialogContent className="border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
            <DialogHeader>
              <DialogTitle className="text-zinc-900 dark:text-white">Welcome to Uruc</DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                Follow the basic onboarding to get started with your digital city.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">
              <p>This is a placeholder tutorial module.</p>
              <p>In the final implementation, you can place interactive videos, long-form guides, or an embedded onboarding widget here! For now, just remember to configure your initial Agent profile in the Agent Center.</p>
            </div>
          </DialogContent>
        </Dialog>

        <motion.button
          onClick={() => navigateToSection('agents')}
          className="group relative flex h-full w-full flex-col items-start overflow-hidden rounded-[32px] border border-zinc-200 bg-white p-8 text-left shadow-2xl transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          whileHover={{ scale: 0.995 }}
          whileTap={{ scale: 0.98 }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.25] transition-transform duration-1000 group-hover:scale-105 invert mix-blend-multiply dark:opacity-40 dark:invert-0 dark:mix-blend-screen"
            style={{ backgroundImage: `url(${agentsBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent dark:from-zinc-950 dark:via-zinc-950/60 dark:to-transparent" />

          <h2 className="z-10 text-xl font-medium tracking-tight text-zinc-900 drop-shadow-sm dark:text-white dark:drop-shadow-md">My Agents</h2>

          <div className="z-10 mt-auto flex w-full flex-col items-start gap-8">
            {primaryAgent ? (
              <h3 className="line-clamp-2 text-4xl font-semibold tracking-tight text-zinc-900 drop-shadow-sm dark:text-white dark:drop-shadow-lg lg:text-5xl">
                {primaryAgent.name}
              </h3>
            ) : null}

            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 backdrop-blur-md transition-colors group-hover:border-zinc-300 group-hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-800">
                  <Bot className="size-6 text-zinc-500 dark:text-zinc-300" />
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: Math.max(1, Math.min(3, totalAgents)) }).map((_, index) => (
                    <motion.div
                      key={index}
                      className="size-2.5 rounded-full bg-zinc-900/80 shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:bg-white/90 dark:shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                      animate={{ opacity: isAgentActive ? [0.2, 1, 0.2] : 0.2 }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.4 }}
                    />
                  ))}
                </div>
              </div>
              <ArrowRight className="size-5 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-zinc-900 dark:text-zinc-500 dark:group-hover:text-white" />
            </div>
          </div>
        </motion.button>

        <div className="group relative flex h-full w-full flex-col items-start overflow-hidden rounded-[32px] bg-white p-8 shadow-2xl dark:bg-zinc-950">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60 transition-transform duration-1000 group-hover:scale-105 invert mix-blend-multiply dark:opacity-70 dark:invert-0 dark:mix-blend-luminosity"
            style={{ backgroundImage: `url(${cityCoreBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-zinc-950 dark:via-zinc-950/40 dark:to-transparent" />

          <h2 className="z-10 text-xl font-medium tracking-tight text-zinc-500 drop-shadow-sm dark:text-zinc-300 dark:drop-shadow-md">Continue</h2>

          <div className="z-10 mt-auto flex flex-col items-start gap-8">
            <h3 className="line-clamp-2 text-4xl font-semibold tracking-tight text-zinc-900 drop-shadow-sm dark:text-white dark:drop-shadow-lg lg:text-6xl">
              {continueDestination?.name || 'Venues'}
            </h3>

            <div className="flex items-center gap-4">
              <motion.button
                onClick={() => (continueDestination ? openDestination(continueDestination) : navigateToSection('library'))}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex size-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-xl transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 md:size-16"
              >
                <Play className="size-6 fill-current md:size-7" />
              </motion.button>

              <button
                onClick={() => (continueDestination ? openDestination(continueDestination, 'new-tab') : navigateToSection('library'))}
                className="flex size-12 items-center justify-center rounded-full border border-zinc-900/20 bg-white/40 text-zinc-900 backdrop-blur-md transition-colors hover:bg-white/60 dark:border-white/20 dark:bg-black/40 dark:text-white dark:hover:bg-black/60 md:size-14"
              >
                <Sparkles className="size-4 md:size-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-dashed border-zinc-300 bg-zinc-50/50 p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-950/50">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.15] transition-transform duration-1000 group-hover:scale-105 invert mix-blend-multiply dark:opacity-10 dark:invert-0 dark:mix-blend-screen"
            style={{ backgroundImage: `url(${glassBg})`, transform: 'scaleX(-1)' }}
          />
          <h2 className="z-10 text-xl font-medium tracking-tight text-zinc-500">Reserved</h2>

          <div
            className="absolute inset-0 z-0 opacity-10 mix-blend-multiply dark:mix-blend-screen"
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}
          />
        </div>
      </div>
    </div>
  );
}
