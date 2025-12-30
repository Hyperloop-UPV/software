import { Button } from "@workspace/ui";
import { AlertTriangle } from "@workspace/ui/icons";
import { useState } from "react";
import { useStore } from "../store/store";

export const Error = () => {
  const error = useStore((s) => s.error);
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-3 text-center">
      {/* Error Icon */}
      <AlertTriangle className="text-destructive h-12 w-12" />

      {/* Typography */}
      <div className="space-y-2 px-6">
        <h3 className="text-foreground text-2xl font-semibold tracking-tight">
          {error?.name || "Error"}
        </h3>
        <p className="text-muted-foreground max-w-[420px] text-sm leading-relaxed">
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>

        {/* Expandable stack trace for debugging */}
        {error?.stack && (
          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs"
          >
            {showDetails ? "Hide" : "Show"} Details
          </Button>
        )}
      </div>

      {/* Stack trace - only if showing */}
      {showDetails && error?.stack && (
        <pre className="bg-muted text-muted-foreground scrollbar-thin max-h-40 w-full max-w-[640px] overflow-auto rounded border p-3 text-left font-mono text-xs leading-tight">
          {error.stack}
        </pre>
      )}
    </div>
  );
};
