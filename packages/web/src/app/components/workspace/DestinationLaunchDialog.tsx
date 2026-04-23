import { ExternalLink, MonitorUp, X } from "lucide-react";

import type { Destination } from "../../workspace-data";
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
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose how this venue should open before leaving the current surface.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <Checkbox
            id="remember-launch-choice"
            checked={rememberChoice}
            onCheckedChange={(checked) => onRememberChoiceChange(Boolean(checked))}
          />
          <Label htmlFor="remember-launch-choice" className="cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Today only
          </Label>
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
