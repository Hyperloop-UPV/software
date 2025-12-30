import { Loader2 } from "@workspace/ui/icons";

export const Loading = () => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-5 text-center">
      {/* Spinner */}
      <Loader2 className="text-primary h-12 w-12 animate-spin" />

      {/* Typography */}
      <div className="space-y-2 px-6">
        <h3 className="text-foreground text-2xl font-semibold tracking-tight">
          Loading...
        </h3>
        <p className="text-muted-foreground max-w-[320px] text-sm leading-relaxed">
          Connecting to backend and fetching data structures
        </p>
      </div>
    </div>
  );
};
