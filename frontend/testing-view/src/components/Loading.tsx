import loadingGif from "../assets/loading-monkey.gif";

export const Loading = () => {
  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center p-6">
      <div className="flex max-w-[500px] flex-col items-center space-y-6">
        {/* Animated Icon Container */}
        <div className="relative">
          {/* Subtle pulse background glow */}
          <div className="bg-primary/10 absolute -inset-4 animate-pulse rounded-full blur-2xl" />

          <div className="border-primary/20 bg-primary/5 border-5 relative flex h-60 w-60 items-center justify-center overflow-hidden rounded-full shadow-[0_0_40px_-12px_rgba(var(--primary),0.3)]">
            {/* The Monkey GIF */}
            <img
              src={loadingGif}
              alt="Loading Monkey"
              className="h-full w-full object-cover opacity-80"
            />

            {/* Subtle "Scanning" overlay to make it look technical */}
            <div className="from-primary/10 to-primary/10 bg-linear-to-b pointer-events-none absolute inset-0 via-transparent" />
          </div>
        </div>

        {/* Typography Section */}
        <div className="space-y-3 text-center">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            System Initializing
          </h1>
          <p className="text-muted-foreground max-w-[400px] text-lg leading-relaxed">
            Our highly trained monkeys are synchronizing ethernet cables and the
            telemetry websocket channels...
          </p>
        </div>

        {/* Minimal Progress Indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className="bg-primary/20 relative h-[2px] w-32 overflow-hidden">
            <div className="bg-primary/40 absolute inset-0 animate-pulse duration-100" />
          </div>
          <span className="text-primary/40 animate-pulse text-[10px] font-bold uppercase tracking-[0.2em] duration-100">
            Fetching Catalog
          </span>
        </div>
      </div>
    </div>
  );
};
