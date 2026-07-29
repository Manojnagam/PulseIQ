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
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: any;
  badge?: string;
}

const allNavItems: NavItemConfig[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-5 w-5" />, path: "/dashboard" },
  { id: "customers", label: "Customers", icon: <Users className="h-5 w-5" />, path: "/customers", permission: "customers:read" },
  { id: "attendance", label: "Check-ins", icon: <CalendarCheck className="h-5 w-5" />, path: "/attendance", permission: "attendance:log" },
  { id: "body", label: "Body Composition", icon: <Activity className="h-5 w-5" />, path: "/body-composition", permission: "body:log" },
  { id: "finance", label: "Finance & Revenue", icon: <DollarSign className="h-5 w-5" />, path: "/finance", permission: "finance:read" },
  { id: "inventory", label: "Inventory", icon: <Package className="h-5 w-5" />, path: "/inventory", permission: "inventory:manage" },
  { id: "coaches", label: "Coaches & Staff", icon: <Award className="h-5 w-5" />, path: "/staff", permission: "users:invite" },
  { id: "ai-diet", label: "AI Diet Plans", icon: <Sparkles className="h-5 w-5" />, path: "/ai-diet", permission: "ai_diet:generate", badge: "AI" },
  { id: "organization", label: "Organisation & Branches", icon: <Building2 className="h-5 w-5" />, path: "/settings/organization", permission: "org:manage" },
];

export interface DynamicSidebarProps {
  activeTab: string;
  onTabChange: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DynamicSidebar({
  activeTab,
  onTabChange,
  collapsed = false,
  onToggleCollapse,
}: DynamicSidebarProps) {
  const { user, activeMembership, memberships, switchActiveMembership, hasPermission } = useAuth();

  // Filter Nav Items dynamically based on User's Granted Permissions
  const filteredNavItems = React.useMemo(() => {
    return allNavItems.filter((item) => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [hasPermission]);

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
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {user?.isPlatformAdmin ? "Super Admin" : activeMembership?.roleName || "Staff"}
                </span>
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

        {/* Tenant Organisation Switcher Dropdown */}
        {!collapsed && activeMembership && (
          <div className="px-3 py-3 border-b border-border/40 dark:border-zinc-800/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/60 dark:bg-zinc-900 border border-border/60 text-xs font-medium text-foreground hover:border-pulseGreen-500/50 transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 className="h-4 w-4 text-pulseGreen-500 shrink-0" />
                    <div className="flex flex-col text-left truncate">
                      <span className="font-semibold truncate">{activeMembership.organisationName}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{activeMembership.branchName || "All Branches"}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="font-bold text-xs">Switch Organisation / Branch</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => switchActiveMembership(m.id)} className="flex items-center justify-between text-xs cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">{m.organisationName}</span>
                      <span className="text-[10px] text-muted-foreground">{m.roleName} ({m.branchName || "Global"})</span>
                    </div>
                    {m.id === activeMembership.id && <ShieldCheck className="h-4 w-4 text-pulseGreen-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Dynamic Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = activeTab === item.path || activeTab === item.id;

            const buttonEl = (
              <button
                key={item.id}
                onClick={() => onTabChange(item.path)}
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

        {/* Footer Account & Settings */}
        <div className="p-3 border-t border-border/60 dark:border-zinc-800/80 space-y-1">
          <button
            onClick={() => onTabChange("/settings/account")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors dark:hover:bg-zinc-900",
              activeTab === "/settings/account" && "bg-muted text-foreground font-semibold"
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Account & Profile</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
