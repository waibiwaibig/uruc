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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/85 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
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
          className="relative flex h-11 w-full items-center rounded-xl border border-zinc-200 bg-zinc-50/80 pr-12 pl-10 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
        >
          <Search className="absolute left-3.5 h-4 w-4" />
          <span>Search destinations, agents, and sessions...</span>
          <div className="pointer-events-none absolute top-3 right-2.5 flex h-5 select-none items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
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
          className="hidden h-8 border-zinc-200 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:flex"
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
