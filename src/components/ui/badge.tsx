import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-pulseGreen-100 text-pulseGreen-700 dark:bg-pulseGreen-950/60 dark:text-pulseGreen-300 dark:border dark:border-pulseGreen-800/40",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-zinc-800 dark:text-zinc-300",
        destructive:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/40",
        outline: "text-foreground border border-border dark:border-zinc-800",
        sky: "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:border dark:border-sky-800/40",
        indigo: "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
