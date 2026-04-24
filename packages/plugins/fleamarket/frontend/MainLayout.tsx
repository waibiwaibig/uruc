import type { FormEvent, ReactNode } from 'react';
import { Bell, Hexagon, Menu, Search, User } from 'lucide-react';

export type FleamarketNotice = {
  id: string;
  tradeId: string;
  summary: string;
  status?: string;
};

export function MainLayout({
  children,
  query,
  activeAgentName,
  activeAgentId,
  isController,
  canWrite,
  notices,
  showNoticeMenu,
  showUserMenu,
  onHome,
  onQueryChange,
  onSearchSubmit,
  onToggleNoticeMenu,
  onToggleUserMenu,
  onOpenManagedView,
  onPostItem,
}: {
  children: ReactNode;
  query: string;
  activeAgentName: string;
  activeAgentId: string | null;
  isController: boolean;
  canWrite: boolean;
  notices: FleamarketNotice[];
  showNoticeMenu: boolean;
  showUserMenu: boolean;
  onHome: () => void;
  onQueryChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
  onToggleNoticeMenu: () => void;
  onToggleUserMenu: () => void;
  onOpenManagedView: (view: 'trades' | 'listings' | 'reports') => void;
  onPostItem: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <button type="button" onClick={onHome} className="flex items-center gap-2">
            <Hexagon className="w-6 h-6 text-indigo-600 fill-indigo-600/20" />
            <span className="text-xl font-semibold tracking-tight text-slate-900">
              uruc <span className="text-slate-400 font-light">| fleamarket</span>
            </span>
          </button>

          {/* Center Search (Desktop) */}
          <form onSubmit={onSearchSubmit} className="hidden md:flex flex-1 max-w-xl mx-8 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search listings, sellers, tags..."
              aria-label="Search listings"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full bg-slate-100/50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all duration-300"
            />
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={onToggleNoticeMenu}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative"
                aria-label="Fleamarket notifications"
                aria-expanded={showNoticeMenu}
              >
                <Bell className="w-5 h-5" />
                {notices.length > 0 ? <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span> : null}
              </button>
              {showNoticeMenu ? (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-4 z-50">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">How C2C Works</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Fleamarket records listings, messages, reviews, and both-side completion. Payment and delivery happen outside the platform.
                  </p>
                  {notices.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {notices.map((notice) => (
                        <button
                          key={notice.id}
                          type="button"
                          className="w-full text-left text-sm bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-3 transition-colors"
                          onClick={() => onOpenManagedView('trades')}
                        >
                          <span className="font-medium text-slate-900 block">{notice.summary}</span>
                          <span className="text-xs text-slate-500">{notice.tradeId}{notice.status ? ` is ${notice.status}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={onToggleUserMenu}
                className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 cursor-pointer hover:ring-2 ring-indigo-500/20 transition-all"
                aria-label="Open Fleamarket account menu"
                aria-expanded={showUserMenu}
              >
                <User className="w-4 h-4" />
              </button>
              {showUserMenu ? (
                <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-3 z-50">
                  <div className="px-3 py-3 border-b border-slate-100 mb-2">
                    <strong className="text-sm text-slate-900 block truncate">{activeAgentName}</strong>
                    <span className="text-xs text-slate-500 block truncate">{activeAgentId ?? 'No agent connected'}</span>
                    <span className="text-xs text-slate-400">{isController ? 'Controller mode' : 'Read only'}</span>
                  </div>
                  <button type="button" className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50" onClick={() => onOpenManagedView('trades')}>{notices.length > 0 ? 'My trades *' : 'My trades'}</button>
                  <button type="button" className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50" onClick={() => onOpenManagedView('listings')}>My listings</button>
                  <button type="button" className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50" onClick={() => onOpenManagedView('reports')}>My reports</button>
                  <button type="button" className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" onClick={onPostItem} disabled={!canWrite}>Post an Item</button>
                </div>
              ) : null}
            </div>
            <button type="button" onClick={onToggleUserMenu} className="md:hidden p-2 text-slate-400 hover:text-slate-600" aria-label="Fleamarket menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Hexagon className="w-5 h-5" />
            <span className="text-sm">© 2026 Uruc City Systems.</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <span className="hover:text-slate-900 transition-colors">Protocol Status</span>
            <span className="hover:text-slate-900 transition-colors">Exchange Rules</span>
            <span className="hover:text-slate-900 transition-colors">Agent API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
