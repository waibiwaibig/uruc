import { Terminal, PanelLeftClose } from "lucide-react";

import type { CityPulse, WorkspaceSection, Destination } from "../../workspace-data";
import { workspaceSections } from "../../workspace-data";
import { Badge } from "../ui/Badge";
import { cn } from "../../utils/cn";

type SidebarProps = {
  className?: string;
  isMobileOpen?: boolean;
  activeSection: WorkspaceSection;
  onNavigate: (section: WorkspaceSection) => void;
  cityPulse: CityPulse;
  alertCount: number;
  pinnedDestinations?: Destination[];
  onLaunchDestination?: (destination: Destination) => void;
  onClose?: () => void;
};

export function Sidebar({
  className,
  activeSection,
  onNavigate,
  cityPulse,
  alertCount,
  pinnedDestinations,
  onLaunchDestination,
  onClose,
}: SidebarProps) {
  return (
    <div
      className={cn(
        'flex h-full w-64 flex-col border-r border-zinc-200/50 bg-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-black/40',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3 border-b border-zinc-200/50 px-4 dark:border-white/10">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm">
          <Terminal size={14} className="stroke-[2.5]" />
        </div>
        <span className="flex-1 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">Uruc Workspace</span>
        
        {onClose && (
          <button 
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-colors"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {workspaceSections.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeSection;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/80 text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-zinc-600 hover:bg-white/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200",
              )}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "home" && alertCount > 0 ? (
                <Badge variant="warning" className="px-2 py-0 text-[10px]">
                  {alertCount}
                </Badge>
              ) : null}
            </button>
          );
        })}

        {pinnedDestinations && pinnedDestinations.length > 0 && (
          <>
            <div className="mx-3 my-3 border-t border-zinc-200/50 dark:border-white/10" />
            <div className="px-3 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Linked Venues
              </span>
            </div>
            {pinnedDestinations.map((dest) => {
              const Icon = dest.icon;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => onLaunchDestination?.(dest)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-zinc-600 hover:bg-white/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                  title={dest.pluginName}
                >
                  <Icon size={16} />
                  <span className="flex-1 text-left truncate">{dest.name}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="border-t border-zinc-200/50 p-4 dark:border-white/10 mt-auto shrink-0">
        <div className="rounded-xl border border-zinc-200/50 bg-white/50 p-4 shadow-sm dark:border-white/5 dark:bg-white/5 relative overflow-hidden">
          
          {/* Cyber Deco Background */}
          <div className="absolute top-[-20%] right-[-10%] opacity-10 pointer-events-none select-none text-zinc-900 dark:text-white">
            <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" />
              <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-200/50 pb-2 dark:border-white/10 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              City Pulse
            </span>
            <span className="font-mono text-[10px] font-bold text-zinc-900 dark:text-zinc-300">
              CYCLE 4092
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs relative z-10">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">Active Agents</span>
            <span className="font-mono font-bold text-zinc-950 dark:text-zinc-100">{cityPulse.activeSessions} / 12</span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs relative z-10">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">City Load</span>
            <span className="font-mono font-bold text-zinc-950 dark:text-zinc-100">72%</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200/50 dark:bg-white/10 relative z-10">
            <div className="h-full w-[72%] bg-zinc-900 dark:bg-zinc-300" />
          </div>

          {alertCount > 0 ? (
            <div className="mt-4 flex items-center justify-between rounded-md bg-red-500/10 px-2 py-1.5 border border-red-500/20 relative z-10">
              <span className="text-[9px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                Auth Pending
              </span>
              <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">{alertCount}</span>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-1.5 border border-emerald-500/20 relative z-10">
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                All Clear
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
