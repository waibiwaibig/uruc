import { Link } from 'react-router-dom';
import { LogOut, Settings2, ShieldCheck } from 'lucide-react';

import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export type SessionUser = {
  name: string;
  email?: string;
  initials: string;
};

type AccountControlsProps = {
  session: SessionUser | null;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onClaimControl: () => Promise<void> | void;
  className?: string;
};

export function AccountControls({
  session,
  onSignOut,
  onOpenSettings,
  onClaimControl,
  className,
}: AccountControlsProps) {
  if (!session) {
    return (
      <div className={cn("ml-2 flex items-center gap-2", className)}>
        <Button asChild variant="ghost" size="sm" className="h-9 rounded-full px-4">
          <Link to="/auth/register">Create account</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9 rounded-full px-4">
          <Link to="/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "ml-2 size-9 rounded-full border border-zinc-200 p-0 shadow-none transition-[background-color,border-color,box-shadow] hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-zinc-300 data-[state=open]:bg-zinc-50 data-[state=open]:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:shadow-none dark:data-[state=open]:border-zinc-700 dark:data-[state=open]:bg-zinc-900 dark:data-[state=open]:shadow-none",
            className,
          )}
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              {session.initials}
            </AvatarFallback>
          </Avatar>
          <span className="sr-only">Open account menu</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 rounded-xl border-zinc-200 bg-white/95 p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <DropdownMenuLabel className="flex flex-col gap-1 px-2 py-2">
          <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {session.name}
          </span>
          {session.email ? (
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              {session.email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void onClaimControl();
            }}
          >
            <ShieldCheck />
            Claim control
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onOpenSettings();
            }}
          >
            <Settings2 />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            onSignOut();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
