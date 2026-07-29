import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchBarProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  placeholder?: string;
}

export function SearchBar({ placeholder = "Search or type Cmd + K...", className, ...props }: SearchBarProps) {
  return (
    <button
      className={cn(
        "flex h-10 w-full max-w-md items-center justify-between rounded-xl border border-input bg-background/80 px-3.5 text-xs text-muted-foreground transition-all hover:border-pulseGreen-500/50 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-900/80 dark:border-zinc-800",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground/70" />
        <span>{placeholder}</span>
      </div>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground dark:bg-zinc-800 dark:border-zinc-700">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
