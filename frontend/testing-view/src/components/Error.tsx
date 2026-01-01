import { Button } from "@workspace/ui";
import { AlertTriangle, RefreshCw, Terminal } from "@workspace/ui/icons";
import { useState } from "react";
import { useStore } from "../store/store";

interface ErrorProps {
  error?: Error | null;
  componentStack?: string | null;
}

export const Error = ({ error: propError, componentStack }: ErrorProps) => {
  const storeError = useStore((s) => s.error);
  const error = propError || storeError;
  const [showDetails, setShowDetails] = useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center p-6">
      <div className="flex max-w-[500px] flex-col items-center space-y-6">
        {/* Animated Icon Container */}
        <div className="relative">
          {/* Subtle pulse background */}
          <div className="bg-destructive/10 absolute -inset-4 animate-pulse rounded-full blur-2xl" />
          <div className="border-destructive/20 bg-destructive/5 relative flex h-24 w-24 items-center justify-center rounded-full border-2 shadow-[0_0_40px_-12px_rgba(239,68,68,0.3)]">
            <AlertTriangle className="text-destructive h-12 w-12" />
          </div>
        </div>

        {/* Typography Section */}
        <div className="space-y-3 text-center">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {error?.name || "System Interrupted"}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {error?.message ||
              "An unexpected runtime error occurred. The application state may be unstable."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleReload}
            className="shadow-primary/20 h-11 gap-2 font-semibold shadow-lg"
            variant="default"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Application
          </Button>

          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="outline"
            className="border-border/60 bg-background/50 h-11 gap-2 px-6 backdrop-blur-sm"
          >
            <Terminal className="text-muted-foreground h-4 w-4" />
            {showDetails ? "Hide" : "Show"} Debug Info
          </Button>
        </div>

        {/* Technical Details (Collapsible) */}
        {showDetails && (
          <div className="animate-in fade-in slide-in-from-top-4 w-full space-y-4 duration-500">
            {/* Component Stack Section */}
            {componentStack && (
              <div className="border-primary/20 bg-primary/5 overflow-auto rounded-xl border p-4 shadow-sm">
                <div className="text-primary mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                  Component Location
                </div>
                <pre className="text-foreground/80 text-left font-mono text-[11px] leading-tight">
                  {/* Clean up the stack string to make it look nicer */}
                  {componentStack.trim().split("\n").slice(0, 3).join("\n")}
                </pre>
              </div>
            )}

            {/* Stack Trace Section */}
            {error?.stack && (
              <div className="bg-muted/30 group relative rounded-xl border p-4 shadow-inner backdrop-blur-md">
                <div className="text-primary mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                  Stack Trace
                </div>
                <pre className="scrollbar-thin text-muted-foreground/90 selection:bg-destructive/30 max-h-[250px] overflow-auto text-left font-mono text-[11px] leading-relaxed">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtle footer decoration */}
      <div className="text-muted-foreground/70 pointer-events-none fixed bottom-8 text-[10px] font-bold uppercase tracking-[0.4em]">
        Testing View | Core Diagnostic System
      </div>
    </div>
  );
};
