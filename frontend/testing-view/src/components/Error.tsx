import { Button } from "@workspace/ui";
import { RefreshCw, Terminal } from "@workspace/ui/icons";
import { useState } from "react";
import errorGif from "../assets/error.gif";
import { useStore } from "../store/store";

interface ErrorProps {
  /** Optional error to display. Can be null or undefined. In this case component will show default error message */
  error?: Error | null;
  /** Optional component stack trace to display. Can be null or undefined. In this case component will not show anything */
  componentStack?: string | null;
}

/**
 * Renders error page with the given error and component stack
 *
 * Displays an error message, optional component stack trace,\
 * and provides actions to reload the application or inspect the stack.
 */
export const Error = ({ error: propError, componentStack }: ErrorProps) => {
  const storeError = useStore((s) => s.error);
  const error = propError || storeError;
  const [showDetails, setShowDetails] = useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center p-6">
      <div className="flex max-w-[700px] flex-col items-center space-y-7">
        {/* Icon Container */}
        <div className="relative">
          <div className="bg-destructive/10 absolute -inset-4 animate-pulse rounded-full blur-2xl" />
          <div className="border-destructive/20 bg-destructive/5 border-5 relative flex h-60 w-60 items-center justify-center overflow-hidden rounded-full shadow-[0_0_40px_-12px_rgba(239,68,68,0.3)]">
            <img
              src={errorGif}
              alt="Panicking anime girl"
              className="h-full w-full object-cover opacity-80"
            />
          </div>
        </div>

        {/* Title & Error Identity */}
        <div className="space-y-5 text-center">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            Ooopsiie! We've got an error!
          </h1>
          <div className="space-y-2">
            <h2 className="text-xl font-medium">{error?.name}</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {error?.message ||
                "Something went wrong and the monkeys are confused. We might need a human for this one."}
            </p>
          </div>
        </div>

        {/* Component Path */}
        {componentStack && (
          <div className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 w-full rounded-xl border p-4 shadow-sm">
            <div className="text-primary mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
              Fault Location
            </div>
            <pre className="text-foreground/80 overflow-hidden text-ellipsis text-left font-mono text-[11px] leading-tight">
              {componentStack.trim().split("\n").slice(0, 3).join("\n")}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleReload}
            className="shadow-primary/20 gap-2 px-8 font-semibold shadow-lg"
            variant="default"
          >
            <RefreshCw className="h-4 w-4" />
            Reload App
          </Button>

          {error?.stack && (
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="outline"
              className="border-border/60 bg-background/50 gap-2 px-6 backdrop-blur-sm"
            >
              <Terminal className="text-muted-foreground h-4 w-4" />
              {showDetails ? "Hide" : "Show"} Trace
            </Button>
          )}
        </div>

        {/* Deep Stack Trace (Collapsible) */}
        {showDetails && error?.stack && (
          <div className="animate-in fade-in zoom-in-95 w-full duration-300">
            <div className="bg-muted/30 relative rounded-xl border p-5 shadow-inner backdrop-blur-md">
              <pre className="scrollbar-thin text-muted-foreground/90 selection:bg-destructive/30 max-h-[200px] overflow-auto text-left font-mono text-[11px] leading-relaxed">
                {error.stack}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
