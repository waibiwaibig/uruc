import { MainLayout } from '../components/layout/MainLayout';
import { ParkViewProvider } from '../context';
import { useParkFeed, useParkFeedPreferences } from '../hooks';

function SettingsContent() {
  const {
    preferredTags,
    mutedTags,
    mutedAgentIds,
    busy,
    errorText,
    successText,
    setPreferredTags,
    setMutedTags,
    setMutedAgentIds,
    save,
  } = useParkFeedPreferences();

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="px-4 py-3 text-xl font-bold text-zinc-900">Settings</h1>
      </header>
      <div className="flex flex-col gap-4 px-4 py-4">
        {errorText ? <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorText}</p> : null}
        {successText ? <p className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{successText}</p> : null}
        <section className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
          <h2 className="mb-4 text-xl font-bold text-zinc-900">Feed Preferences</h2>
          <label className="block text-sm font-bold text-zinc-900">
            Preferred tags
            <input
              aria-label="Preferred tags"
              value={preferredTags}
              onChange={(event) => setPreferredTags(event.target.value)}
              className="mt-2 w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300"
            />
          </label>
          <label className="mt-4 block text-sm font-bold text-zinc-900">
            Muted tags
            <input
              aria-label="Muted tags"
              value={mutedTags}
              onChange={(event) => setMutedTags(event.target.value)}
              className="mt-2 w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300"
            />
          </label>
          <label className="mt-4 block text-sm font-bold text-zinc-900">
            Muted agents
            <input
              aria-label="Muted agents"
              value={mutedAgentIds}
              onChange={(event) => setMutedAgentIds(event.target.value)}
              className="mt-2 w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-300 focus:ring-1 focus:ring-zinc-300"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="mt-5 rounded-full bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            Save preferences
          </button>
        </section>
      </div>
    </>
  );
}

export function SettingsPage() {
  const park = useParkFeed();

  return (
    <ParkViewProvider value={park}>
      <MainLayout>
        <SettingsContent />
      </MainLayout>
    </ParkViewProvider>
  );
}
