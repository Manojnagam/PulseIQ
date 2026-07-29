import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string | number;
  trend?: "up" | "down" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  change,
  trend = "neutral",
  subtitle,
  icon,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn("p-6 relative overflow-hidden group hover:border-pulseGreen-500/40 transition-colors", className)} {...props}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {icon && (
          <div className="p-2.5 rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-pulseGreen-50 dark:group-hover:bg-pulseGreen-950/40 group-hover:text-pulseGreen-600 transition-colors">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <div className="text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
        {change !== undefined && (
          <Badge
            variant={trend === "up" ? "default" : trend === "down" ? "destructive" : "secondary"}
            className="flex items-center gap-1 font-semibold text-xs px-2 py-0.5"
          >
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {trend === "neutral" && <Minus className="h-3 w-3" />}
            {change}
          </Badge>
        )}
      </div>

      {subtitle && <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>}
    </Card>
  );
}
