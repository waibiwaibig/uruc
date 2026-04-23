import * as React from "react"
import { cn } from "./utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "error";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 dark:focus:ring-zinc-300",
        {
          "border-transparent bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/80":
            variant === "default",
          "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800/80":
            variant === "secondary",
          "text-zinc-950 dark:text-zinc-50": variant === "outline",
          "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400":
            variant === "success",
          "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400":
            variant === "warning",
          "border-transparent bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400":
            variant === "error",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
