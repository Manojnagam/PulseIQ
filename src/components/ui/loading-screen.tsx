import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingScreen({ message = "Loading PulseIQ..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md dark:bg-zinc-950/80">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-pulseGreen-500 text-white shadow-xl animate-bounce">
          <Activity className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight text-foreground">{message}</h3>
          <p className="text-xs text-muted-foreground">Preparing your workspace...</p>
        </div>
        <div className="w-48 space-y-2 pt-2">
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
