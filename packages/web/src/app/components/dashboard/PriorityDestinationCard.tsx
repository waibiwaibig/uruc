import { ArrowUpRight, MoreHorizontal, Pin, PinOff } from "lucide-react";

import type { Destination } from "../../workspace-data";
import { getDestinationStatusVariant } from "../../workspace-data";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type PriorityDestinationCardProps = {
  destination: Destination;
  onOpen: (destination: Destination) => void;
  onOpenInNewTab: (destination: Destination) => void;
  onToggleLinked: (destinationId: string) => void;
};

export function PriorityDestinationCard({
  destination,
  onOpen,
  onOpenInNewTab,
  onToggleLinked,
}: PriorityDestinationCardProps) {
  return (
    <article className="relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] hover:border-zinc-400 hover:shadow-md focus-within:border-zinc-400 focus-within:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-600 dark:focus-within:border-zinc-600">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <destination.icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getDestinationStatusVariant(destination.status)} className="capitalize">
            {destination.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-full">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Destination actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => onOpen(destination)}>
                <ArrowUpRight />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpenInNewTab(destination)}>
                <ArrowUpRight />
                Open in new tab
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onToggleLinked(destination.id)}>
                {destination.isLinked ? <PinOff /> : <Pin />}
                {destination.isLinked ? "Remove from Linked Venues" : "Add to Linked Venues"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">{destination.name}</h3>
      <p className="mb-3 flex-1 text-sm text-zinc-500 dark:text-zinc-400">{destination.description}</p>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-mono">{destination.pluginName}</span>
        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <span>{destination.shell === "standalone" ? "New tab" : "Current tab"}</span>
      </div>

      <Button
        variant="secondary"
        className="w-full justify-between border border-transparent bg-zinc-50 text-zinc-950 shadow-none hover:bg-zinc-900 hover:text-white focus-visible:bg-zinc-900 focus-visible:text-white dark:bg-zinc-800/60 dark:text-zinc-50 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 dark:focus-visible:bg-zinc-100 dark:focus-visible:text-zinc-900"
        onClick={() => onOpen(destination)}
      >
        Open
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    </article>
  );
}
