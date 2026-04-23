import { useMemo, useState } from "react";
import { PanelLeftClose, Plus, Terminal } from "lucide-react";

import type { CityPulse, WorkspaceSection, Destination } from "../../workspace-data";
import { workspaceSections } from "../../workspace-data";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";

type SidebarProps = {
  className?: string;
  isMobileOpen?: boolean;
  activeSection: WorkspaceSection;
  onNavigate: (section: WorkspaceSection) => void;
  cityPulse: CityPulse;
  alertCount: number;
  linkedDestinations?: Destination[];
  availableDestinations?: Destination[];
  onRequestLaunchDestination?: (destination: Destination) => Promise<void> | void;
  onToggleLinkedDestination?: (destinationId: string) => void;
  onClose?: () => void;
};

export function Sidebar({
  className,
  activeSection,
  onNavigate,
  cityPulse,
  alertCount,
  linkedDestinations,
  availableDestinations,
  onRequestLaunchDestination,
  onToggleLinkedDestination,
  onClose,
}: SidebarProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const linkedDestinationIds = useMemo(
    () => new Set((linkedDestinations ?? []).map((destination) => destination.id)),
    [linkedDestinations],
  );
  const selectableDestinations = useMemo(
    () => [...(availableDestinations ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [availableDestinations],
  );

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
            </button>
          );
        })}

        <>
          <div className="mx-3 my-3 border-t border-zinc-200/50 dark:border-white/10" />
          <div className="mb-1 flex items-center justify-between px-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Linked Venues
            </span>
            {onToggleLinkedDestination ? (
              <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    aria-label="Manage linked venues"
                  >
                    <Plus size={14} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="right"
                  className="w-[280px] rounded-2xl border-zinc-200 bg-white/95 p-0 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95"
                >
                  <div className="border-b border-zinc-200/70 px-4 py-3 dark:border-white/10">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Linked Venues</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Choose which venue shortcuts stay in the sidebar.</p>
                  </div>
                  <ScrollArea className="max-h-72">
                    <div className="grid gap-1 p-2">
                      {selectableDestinations.map((destination) => (
                        <button
                          key={destination.id}
                          type="button"
                          onClick={() => onToggleLinkedDestination(destination.id)}
                          className="flex items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-100/80 dark:hover:bg-white/5"
                        >
                          <Checkbox
                            checked={linkedDestinationIds.has(destination.id)}
                            className="mt-0.5"
                            aria-label={destination.name}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{destination.name}</p>
                            <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{destination.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          {linkedDestinations && linkedDestinations.length > 0 ? (
            linkedDestinations.map((dest) => {
              const Icon = dest.icon;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => {
                    void onRequestLaunchDestination?.(dest);
                  }}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-white/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                  title={dest.pluginName}
                >
                  <Icon size={16} />
                  <span className="flex-1 truncate text-left">{dest.name}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Add the venues you want as persistent shortcuts here.
            </div>
          )}
        </>
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
