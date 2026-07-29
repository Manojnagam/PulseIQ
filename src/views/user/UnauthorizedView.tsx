import * as React from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldAlert } from "lucide-react";

export function UnauthorizedView() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <EmptyState
        icon={<ShieldAlert className="h-12 w-12 text-red-500" />}
        title="403 — Access Forbidden"
        description="Your current role or membership does not have permission to view this resource. Contact your Organisation Owner or Centre Manager for upgraded permissions."
        primaryActionLabel="Return to Dashboard"
        onPrimaryAction={() => window.location.href = "/dashboard"}
      />
    </div>
  );
}
