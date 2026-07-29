import * as React from "react";
import { Bell, Sun, Moon, User, Check, Shield } from "lucide-react";
import { SearchBar } from "@/components/ui/search-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface NavbarProps {
  onOpenCommandPalette: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  supervisorName?: string;
}

export function Navbar({
  onOpenCommandPalette,
  darkMode,
  onToggleDarkMode,
  onOpenNotifications,
  unreadCount = 3,
  supervisorName = "Supervisor",
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-md dark:bg-zinc-950/80 dark:border-zinc-800/80">
      {/* Search Command Trigger */}
      <div className="flex-1 max-w-md">
        <SearchBar onClick={onOpenCommandPalette} />
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-3">
        {/* Dark Mode Toggle */}
        <Button variant="ghost" size="icon" onClick={onToggleDarkMode} aria-label="Toggle Theme">
          {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-zinc-600" />}
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={onOpenNotifications} aria-label="Notifications">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-pulseGreen-500 ring-2 ring-background" />
            )}
          </Button>
        </div>

        <div className="h-5 w-px bg-border dark:bg-zinc-800" />

        {/* User Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-0.5">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-pulseGreen-100 text-pulseGreen-700 font-bold dark:bg-pulseGreen-950 dark:text-pulseGreen-300">
                  {supervisorName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-foreground leading-tight">{supervisorName}</span>
                <span className="text-[10px] text-muted-foreground">Manager Access</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-bold">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Profile & PIN
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" /> Center Permissions
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-red-600 dark:text-red-400">
              Lock Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
