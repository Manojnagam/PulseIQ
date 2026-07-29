import * as React from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1.5 text-xs text-muted-foreground", className)} {...props}>
      <a
        href="#"
        className="flex items-center hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
        aria-label="Home"
      >
        <Home className="h-3.5 w-3.5" />
      </a>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          {item.href && !item.active ? (
            <a
              href={item.href}
              className="hover:text-foreground font-medium transition-colors p-1 rounded-md hover:bg-muted"
            >
              {item.label}
            </a>
          ) : (
            <span className={cn("font-semibold text-foreground px-1", item.active && "text-pulseGreen-600 dark:text-pulseGreen-400")}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
