import {
  ArrowUpRight,
  Bot,
  Command,
  House,
  LayoutGrid,
  Search,
  Settings2,
  Sparkles,
  UserRoundCog,
} from "lucide-react";

import type {
  ActivityItem,
  AgentProfile,
  Destination,
  WorkspaceSection,
} from "../../workspace-data";
import { getSectionFromCategory } from "../../workspace-data";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../ui/command";

type CommandCenterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinations: Destination[];
  agents: AgentProfile[];
  activities: ActivityItem[];
  onNavigate: (section: WorkspaceSection) => void;
  onOpenAgent: (agentId: string) => void;
  onLaunchDestination: (destination: Destination) => void;
};

const pageItems: Array<{
  id: WorkspaceSection;
  label: string;
  hint: string;
  icon: typeof House;
}> = [
  { id: "home", label: "Home", hint: "Overview and quick actions", icon: House },
  { id: "library", label: "Venues", hint: "Explore city venues", icon: LayoutGrid },
  { id: "agents", label: "Agents", hint: "Manage your workspace agents", icon: UserRoundCog },
  { id: "settings", label: "Settings", hint: "Appearance and account", icon: Settings2 },
];

export function CommandCenterDialog({
  open,
  onOpenChange,
  destinations,
  agents,
  activities,
  onNavigate,
  onOpenAgent,
  onLaunchDestination,
}: CommandCenterDialogProps) {
  const recentDestinations = destinations
    .filter((destination) => destination.isRecent)
    .slice(0, 5);
  const recentActivities = activities.slice(0, 4);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search workspace"
      description="Find destinations, agents, recent sessions, and settings."
    >
      <CommandInput placeholder="Search destinations, agents, and sessions..." />
      <CommandList>
        <CommandEmpty>No workspace item matches your search.</CommandEmpty>

        <CommandGroup heading="Pages">
          {pageItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  onNavigate(item.id);
                  onOpenChange(false);
                }}
              >
                <Icon />
                <div className="flex flex-col gap-0.5">
                  <span>{item.label}</span>
                  <span className="text-xs text-zinc-500">{item.hint}</span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Destinations">
          {recentDestinations.map((destination) => (
            <CommandItem
              key={destination.id}
              onSelect={() => {
                void onLaunchDestination(destination);
                onOpenChange(false);
              }}
            >
              <destination.icon />
              <div className="flex flex-col gap-0.5">
                <span>{destination.name}</span>
                <span className="text-xs text-zinc-500">{destination.description}</span>
              </div>
              <CommandShortcut>
                {destination.shell === "standalone" ? "NEW TAB" : "OPEN"}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Agents">
          {agents.slice(0, 4).map((agent) => (
            <CommandItem
              key={agent.id}
              onSelect={() => {
                onOpenAgent(agent.id);
                onOpenChange(false);
              }}
            >
              <Bot />
              <div className="flex flex-col gap-0.5">
                <span>{agent.name}</span>
                <span className="text-xs text-zinc-500">{agent.role}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Recent">
          {recentActivities.map((activity) => (
            <CommandItem
              key={activity.id}
              onSelect={() => {
                onNavigate(getSectionFromCategory(activity.category));
                onOpenChange(false);
              }}
            >
              {activity.category === "launch" ? <ArrowUpRight /> : activity.category === "agent" ? <Bot /> : activity.category === "system" ? <Sparkles /> : <Search />}
              <div className="flex flex-col gap-0.5">
                <span>{activity.title}</span>
                <span className="text-xs text-zinc-500">{activity.summary}</span>
              </div>
              <CommandShortcut>{activity.timeLabel}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800">
        <span className="flex items-center gap-1.5">
          <Command className="size-3.5" />
          Quick workspace launcher
        </span>
        <span>Enter to open</span>
      </div>
    </CommandDialog>
  );
}
