import { ExternalLink, MonitorUp, PlugZap, X } from "lucide-react";

import type { Destination } from "../../workspace-data";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";

type DestinationLaunchDialogProps = {
  destination: Destination | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rememberChoice: boolean;
  onRememberChoiceChange: (rememberChoice: boolean) => void;
  onOpenHere: (destination: Destination) => void;
  onOpenInNewTab: (destination: Destination) => void;
};

export function DestinationLaunchDialog({
  destination,
  open,
  onOpenChange,
  rememberChoice,
  onRememberChoiceChange,
  onOpenHere,
  onOpenInNewTab,
}: DestinationLaunchDialogProps) {
  if (!destination) {
    return null;
  }

  const defaultTarget = destination.shell === "standalone" ? "New tab" : "Current tab";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <destination.icon className="size-5 text-zinc-700 dark:text-zinc-200" />
            </div>
            <div className="space-y-1">
              <span>{destination.name}</span>
              <div className="flex flex-wrap items-center gap-2 text-xs font-normal">
                <Badge variant="secondary">{destination.kind}</Badge>
                <Badge variant={destination.shell === "standalone" ? "warning" : "outline"}>
                  {defaultTarget}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="pt-2">
            Choose how this venue should open before leaving the current surface.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-950 dark:text-zinc-50">Default launch behavior</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {destination.shell === "standalone"
                  ? "This destination prefers its own browser tab. The real host would hand control to the plugin's standalone surface."
                  : "This destination opens in the active workspace tab. The real host would swap in the plugin's app surface here."}
              </p>
            </div>
            <PlugZap className="hidden size-5 text-zinc-400 sm:block" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Plugin</p>
              <p className="mt-1 font-medium">{destination.pluginName}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Route</p>
              <p className="mt-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">{destination.path}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <Checkbox
            id="remember-launch-choice"
            checked={rememberChoice}
            onCheckedChange={(checked) => onRememberChoiceChange(Boolean(checked))}
          />
          <div className="grid gap-1">
            <Label htmlFor="remember-launch-choice" className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Today only
            </Label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Remember this venue&apos;s launch choice until the local day resets.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenHere(destination)}
            className="sm:col-span-1"
          >
            <MonitorUp />
            Open here
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenInNewTab(destination)}
            className="sm:col-span-1"
          >
            <ExternalLink />
            New tab
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} className="sm:col-span-1">
            <X />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
