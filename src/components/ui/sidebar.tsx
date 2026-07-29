import * as React from "react";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Activity,
  DollarSign,
  Package,
  Award,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: "customers", label: "Customers", icon: <Users className="h-5 w-5" />, badge: "Active" },
  { id: "attendance", label: "Check-ins", icon: <CalendarCheck className="h-5 w-5" /> },
  { id: "body", label: "Body Composition", icon: <Activity className="h-5 w-5" /> },
  { id: "finance", label: "Finance & Revenue", icon: <DollarSign className="h-5 w-5" /> },
  { id: "inventory", label: "Inventory", icon: <Package className="h-5 w-5" /> },
  { id: "coaches", label: "Coaches", icon: <Award className="h-5 w-5" /> },
  { id: "ai-diet", label: "AI Diet Plans", icon: <Sparkles className="h-5 w-5" />, badge: "AI" },
];

export interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  activeCenterName?: string;
}

export function Sidebar({
  activeTab,
  onTabChange,
  collapsed = false,
  onToggleCollapse,
  activeCenterName = "Main Wellness Center",
}: SidebarProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          "relative flex flex-col border-r border-border bg-card/80 backdrop-blur-md transition-all duration-300 dark:bg-zinc-950/80 dark:border-zinc-800/80 h-screen sticky top-0 z-30 select-none",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/60 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pulseGreen-500 text-white font-extrabold shadow-md">
              P
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-extrabold text-lg leading-tight tracking-tight text-foreground">PulseIQ</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Supervisor</span>
              </div>
            )}
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Center Switcher Badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-border/40 dark:border-zinc-800/50">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 dark:bg-zinc-900 border border-border/60 text-xs font-medium text-foreground">
              <Building2 className="h-4 w-4 text-pulseGreen-500 shrink-0" />
              <span className="truncate">{activeCenterName}</span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            const buttonEl = (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative",
                  isActive
                    ? "bg-pulseGreen-500 text-white shadow-sm dark:bg-pulseGreen-600"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-zinc-900"
                )}
              >
                <span className={cn("shrink-0", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")}>
                  {item.icon}
                </span>
                {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <Badge variant={isActive ? "secondary" : "default"} className="ml-auto text-[10px] px-1.5 py-0">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return buttonEl;
          })}
        </div>

        {/* Footer Navigation (Settings & Logout) */}
        <div className="p-3 border-t border-border/60 dark:border-zinc-800/80 space-y-1">
          <button
            onClick={() => onTabChange("settings")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors dark:hover:bg-zinc-900",
              activeTab === "settings" && "bg-muted text-foreground font-semibold"
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
