import * as React from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Navbar } from "@/components/ui/navbar";
import { CommandPalette } from "@/components/ui/command-palette";
import { ToastProvider } from "@/components/ui/toast";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

export interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  activeCenterName?: string;
}

export function AppLayout({ children, activeTab, onTabChange, activeCenterName = "PulseIQ Main Center" }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    return document.documentElement.classList.contains("dark");
  });

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <div className="flex flex-1">
          {/* Collapsible Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeCenterName={activeCenterName}
          />

          {/* Main Layout Container */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Top Navigation Bar */}
            <Navbar
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              darkMode={darkMode}
              onToggleDarkMode={toggleDarkMode}
              onOpenNotifications={() => setNotificationsOpen(true)}
            />

            {/* Main Content Area */}
            <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in-50 duration-200">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-border/60 py-4 px-8 text-center text-xs text-muted-foreground dark:border-zinc-800/80">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
                <span>© {new Date().getFullYear()} PulseIQ Wellness Systems. All rights reserved.</span>
                <div className="flex items-center gap-4">
                  <span className="hover:text-foreground cursor-pointer">System Status</span>
                  <span className="hover:text-foreground cursor-pointer">API Docs</span>
                  <span className="hover:text-foreground cursor-pointer">Support</span>
                </div>
              </div>
            </footer>
          </div>
        </div>

        {/* Global Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onSelectAction={(actionId) => onTabChange(actionId)}
        />

        {/* Notifications Drawer */}
        <Drawer open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DrawerContent side="right">
            <DrawerHeader>
              <div className="flex items-center justify-between">
                <DrawerTitle>Notifications</DrawerTitle>
                <Badge variant="default">3 New</Badge>
              </div>
              <DrawerDescription>Recent alerts and system notifications for your center.</DrawerDescription>
            </DrawerHeader>
            <div className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Pack Expiry Alert</span>
                  <span className="text-muted-foreground text-[10px]">10m ago</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">3 customer packs are expiring in the next 7 days.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Low Inventory Warning</span>
                  <span className="text-muted-foreground text-[10px]">1h ago</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Formula 1 Shake Stock is below re-order threshold (5 items left).</p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Groq AI Diet Ready</span>
                  <span className="text-muted-foreground text-[10px]">3h ago</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">7-day personalized diet plan generated for Ramesh Kumar.</p>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </ToastProvider>
  );
}
