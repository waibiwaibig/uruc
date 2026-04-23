import { Bell, BookOpen, Command, Menu, Moon, Search, Sun } from "lucide-react";
import { AccountControls, type SessionUser } from "./AccountControls";
import { Button } from "../ui/Button";

type TopBarProps = {
  toggleTheme: () => void;
  isDark: boolean;
  onMenuClick: () => void;
  onOpenTokens: () => void;
  onOpenCommand: () => void;
  onOpenSettings: () => void;
  session: SessionUser | null;
  onSignOut: () => void;
};

export function TopBar({
  toggleTheme,
  isDark,
  onMenuClick,
  onOpenTokens,
  onOpenCommand,
  onOpenSettings,
  session,
  onSignOut,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/35 bg-white/55 px-4 shadow-[0_1px_0_rgba(255,255,255,0.55),0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-950/45 dark:shadow-[0_1px_0_rgba(255,255,255,0.08),0_18px_42px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-2 lg:hidden">
        <Button variant="ghost" size="icon" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

      <div className="hidden w-full max-w-sm items-center lg:flex">
        <button
          type="button"
          onClick={onOpenCommand}
          className="relative flex h-11 w-full items-center rounded-xl border border-white/45 bg-white/35 pr-12 pl-10 text-left text-sm text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] backdrop-blur-xl transition-colors hover:border-white/60 hover:bg-white/50 hover:text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          <Search className="absolute left-3.5 h-4 w-4" />
          <span>Search destinations, agents, and sessions...</span>
          <div className="pointer-events-none absolute top-3 right-2.5 flex h-5 select-none items-center gap-1 rounded border border-white/50 bg-white/65 px-1.5 font-mono text-[10px] font-medium text-zinc-500 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-zinc-400">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenTokens}
          className="hidden h-8 border-white/45 bg-white/30 text-xs text-zinc-600 shadow-sm backdrop-blur-xl hover:bg-white/55 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10 sm:flex"
        >
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          View Guide
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:inline-flex"
        >
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
        <AccountControls
          session={session}
          onSignOut={onSignOut}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </header>
  );
}
