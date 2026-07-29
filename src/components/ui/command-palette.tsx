import * as React from "react";
import { Command } from "cmdk";
import { Search, User, Calendar, Activity, DollarSign, Package, Settings, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction?: (action: string) => void;
}

export function CommandPalette({ open, onOpenChange, onSelectAction }: CommandPaletteProps) {
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = (value: string) => {
    onOpenChange(false);
    if (onSelectAction) onSelectAction(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-xl shadow-2xl border border-border dark:border-zinc-800">
        <Command className="w-full bg-background dark:bg-zinc-900">
          <div className="flex items-center border-b border-border px-3.5 dark:border-zinc-800">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
            <Command.Input
              placeholder="Type a command or search customers, attendance, diet..."
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
              <Command.Item
                onSelect={() => handleSelect("dashboard")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <Activity className="h-4 w-4 text-pulseGreen-500" />
                Overview Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("customers")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <User className="h-4 w-4 text-pulseBlue-500" />
                Customer Directory
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("attendance")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <Calendar className="h-4 w-4 text-amber-500" />
                Daily Check-ins
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Management" className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mt-2">
              <Command.Item
                onSelect={() => handleSelect("finance")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Finance & Revenue
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("inventory")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <Package className="h-4 w-4 text-indigo-500" />
                Inventory Stock
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("ai-diet")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <Sparkles className="h-4 w-4 text-sky-500" />
                Groq AI Diet Generator
              </Command.Item>
            </Command.Group>

            <Command.Group heading="System" className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mt-2">
              <Command.Item
                onSelect={() => handleSelect("settings")}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent cursor-pointer dark:hover:bg-zinc-800"
              >
                <Settings className="h-4 w-4 text-zinc-500" />
                Center Settings & Security
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
