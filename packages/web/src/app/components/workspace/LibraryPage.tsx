import { useEffect, useMemo, useState } from 'react';
import { Crown, MessageSquare, Play, Search, Sparkles, Square, Store } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { useAgents } from '../../../context/AgentsContext';
import { useAgentRuntime } from '../../../context/AgentRuntimeContext';
import { useWorkspaceSurface } from '../../context/WorkspaceSurfaceContext';
import { DESTINATION_KIND_ORDER, dedupeDestinations, type Destination } from '../../workspace-data';
import { Input } from '../ui/input';

import cityBg from '../../../assets/city-bg.png';
import slideSocial from '../../../assets/slide-social.png';
import slideMarket from '../../../assets/slide-market.png';
import slideChess from '../../../assets/slide-chess.png';

const CAROUSEL_SLIDES = [
  {
    id: 'brand',
    image: cityBg,
    icon: Sparkles,
    text: 'Welcome to Uruc: Your connected digital metropolis',
    button: 'Explore map',
  },
  {
    id: 'social',
    image: slideSocial,
    icon: MessageSquare,
    text: 'Connect and coordinate across the city in real-time',
    button: 'Open Social',
  },
  {
    id: 'market',
    image: slideMarket,
    icon: Store,
    text: 'Trade digital assets and services at the Flea Market',
    button: 'Start Trading',
  },
  {
    id: 'chess',
    image: slideChess,
    icon: Crown,
    text: 'Challenge grandmasters in the International Chess Pavilion',
    button: 'Play Match',
  },
];

export function LibraryPage() {
  const [search, setSearch] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [localErrorText, setLocalErrorText] = useState('');
  const { shadowAgent } = useAgents();
  const runtime = useAgentRuntime();
  const {
    destinations,
    launchError,
    requestDestinationLaunch,
    clearLaunchError,
    recordActivity,
  } = useWorkspaceSurface();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % CAROUSEL_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const uniqueDestinations = useMemo(() => dedupeDestinations(destinations), [destinations]);

  const filteredDestinations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return uniqueDestinations;
    }

    return uniqueDestinations.filter((destination) =>
      [
        destination.name,
        destination.description,
        destination.pluginName,
        destination.kind,
        destination.locationId ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [search, uniqueDestinations]);

  const grouped = useMemo(() => {
    const groups: Record<string, Destination[]> = {};
    filteredDestinations.forEach((destination) => {
      if (!groups[destination.kind]) {
        groups[destination.kind] = [];
      }
      groups[destination.kind].push(destination);
    });
    return DESTINATION_KIND_ORDER
      .filter((kind) => groups[kind]?.length)
      .map((kind) => [kind, [...groups[kind]].sort((left, right) => left.name.localeCompare(right.name))] as const);
  }, [filteredDestinations]);

  const ensureConnected = async () => {
    if (!shadowAgent) {
      throw new Error('No shadow agent is configured yet.');
    }
    if (!runtime.isConnected) {
      await runtime.connect();
    }
    await runtime.refreshSessionState();
    await runtime.refreshLocations();
  };

  const launchDestination = async (destination: Destination) => {
    try {
      setLocalErrorText('');
      clearLaunchError();
      await requestDestinationLaunch(destination);
    } catch (error) {
      if (error instanceof Error && error.message === 'Launch cancelled') {
        return;
      }
      setLocalErrorText(error instanceof Error ? error.message : `Unable to open ${destination.name}.`);
    }
  };

  const stopDestination = async (destination: Destination) => {
    if (!destination.locationId || runtime.currentLocation !== destination.locationId) {
      return;
    }

    setLocalErrorText('');

    try {
      await runtime.leaveLocation();
      await runtime.refreshLocations();
      recordActivity({
        category: 'launch',
        title: `${destination.name} closed`,
        summary: 'The current runtime session exited the selected venue.',
        tone: 'neutral',
        destinationId: destination.id,
      });
    } catch (error) {
      setLocalErrorText(error instanceof Error ? error.message : `Unable to close ${destination.name}.`);
    }
  };

  const slideAction = async () => {
    if (CAROUSEL_SLIDES[activeSlide].id === 'brand') {
      try {
        setLocalErrorText('');
        clearLaunchError();
        await ensureConnected();
        if (!runtime.isController) {
          await runtime.claimControl();
        }
        if (!runtime.inCity) {
          await runtime.enterCity();
        }
        await runtime.refreshLocations();
        recordActivity({
          category: 'session',
          title: 'City session ready',
          summary: 'The runtime is connected and inside the city.',
          tone: 'success',
        });
      } catch (error) {
        setLocalErrorText(error instanceof Error ? error.message : 'Unable to enter the city.');
      }
      return;
    }

    const findBy = (pattern: RegExp) => uniqueDestinations.find((destination) => pattern.test(destination.name) || pattern.test(destination.pluginName));
    const nextDestination = CAROUSEL_SLIDES[activeSlide].id === 'social'
      ? findBy(/social/i)
      : CAROUSEL_SLIDES[activeSlide].id === 'market'
        ? findBy(/market|trade|store/i)
        : findBy(/chess/i);

    if (nextDestination) {
      await launchDestination(nextDestination);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col items-center">
      <div className="z-10 flex w-full max-w-5xl flex-col items-center gap-12 p-4 pt-12 md:p-8 md:pt-20">
        <div className="flex w-full flex-col items-center gap-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 lg:text-5xl">
            Explore City Venues
          </h1>

          <div className="flex w-full max-w-3xl items-center justify-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 mt-[1px] size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search venues..."
                className="h-12 w-full rounded-full border-zinc-200 bg-white pl-11 pr-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex h-80 w-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-[40px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 0.8, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 bg-cover bg-center mix-blend-multiply invert dark:mix-blend-screen dark:invert-0 dark:opacity-60"
              style={{ backgroundImage: `url(${CAROUSEL_SLIDES[activeSlide].image})` }}
            />
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-zinc-950 dark:via-zinc-950/20 dark:to-transparent" />

          <div className="absolute right-6 z-20 flex flex-col gap-2">
            {CAROUSEL_SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveSlide(index)}
                className={`size-1.5 rounded-full transition-all ${
                  activeSlide === index
                    ? 'scale-125 bg-zinc-900 dark:bg-white/90'
                    : 'bg-zinc-300 hover:bg-zinc-400 dark:bg-white/20 dark:hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="mt-8 flex items-center gap-3 rounded-full border border-zinc-200 bg-white/60 px-6 py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/60 dark:shadow-lg">
                {(() => {
                  const Icon = CAROUSEL_SLIDES[activeSlide].icon;
                  return <Icon className="size-5 text-zinc-900 dark:text-white" />;
                })()}
                <span className="font-medium text-zinc-900 dark:text-white">{CAROUSEL_SLIDES[activeSlide].text}</span>
              </div>

              <button
                className="mt-8 rounded-full bg-zinc-900 px-8 py-3 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105 dark:bg-white dark:text-zinc-950"
                onClick={() => void slideAction()}
              >
                {CAROUSEL_SLIDES[activeSlide].button}
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {localErrorText || launchError || runtime.error ? (
          <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {localErrorText || launchError || runtime.error}
          </div>
        ) : null}

        <div className="z-10 flex w-full flex-col gap-12 pb-16">
          {grouped.map(([kind, items]) => (
            <div key={kind} className="flex flex-col gap-6">
              <h2 className="text-xl font-medium capitalize tracking-tight text-zinc-900 dark:text-zinc-100">
                {kind}
              </h2>
              <div className="grid gap-x-12 gap-y-2 md:grid-cols-2">
                {items.map((destination) => {
                  const isActiveLocation = destination.locationId ? runtime.currentLocation === destination.locationId : false;
                  return (
                    <div
                      key={destination.id}
                      className="group flex cursor-pointer items-center gap-4 border-b border-zinc-100 py-4 transition-colors dark:border-zinc-800/50"
                      onClick={() => void launchDestination(destination)}
                    >
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                        <destination.icon className="size-6 text-zinc-700 dark:text-zinc-200" />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <h3 className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                          {destination.name}
                        </h3>
                        <p className="line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {destination.description}
                        </p>
                      </div>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isActiveLocation) {
                            void stopDestination(destination);
                            return;
                          }
                          void launchDestination(destination);
                        }}
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                          isActiveLocation
                            ? 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {isActiveLocation ? <Square className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
