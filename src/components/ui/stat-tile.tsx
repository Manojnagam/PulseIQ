import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtext?: string;
  colorVariant?: "green" | "blue" | "emerald" | "amber" | "indigo";
}

export function StatTile({ label, value, subtext, colorVariant = "green", className, ...props }: StatTileProps) {
  const borderColors = {
    green: "border-l-pulseGreen-500",
    blue: "border-l-pulseBlue-500",
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    indigo: "border-l-indigo-500",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-xs border-l-4 dark:bg-zinc-900/60 dark:border-zinc-800",
        borderColors[colorVariant],
        className
      )}
      {...props}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-foreground">{value}</p>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}
