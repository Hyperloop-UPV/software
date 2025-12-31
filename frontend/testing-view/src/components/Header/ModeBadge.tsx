import { cn } from "@workspace/ui/lib";
import { useStore } from "../../store/store";
import type { AppMode } from "../../types/app/mode";

const modeConfig: Record<AppMode, { label: string; className: string }> = {
  loading: {
    label: "Loading",
    className: "bg-blue-300/15 text-blue-500 border-blue-500/30",
  },
  "mock-active": {
    label: "Mock Active",
    className: "bg-green-300/15 text-green-500 border-green-500/30",
  },
  active: {
    label: "Active",
    className: "bg-green-300/15 text-green-500 border-green-500/30",
  },
  mock: {
    label: "Mock",
    className: "bg-yellow-300/15 text-yellow-500 border-yellow-500/30",
  },
  error: {
    label: "Error",
    className: "bg-red-300/15 text-red-500 border-red-500/30",
  },
};

export const ModeBadge = () => {
  const appMode = useStore((s) => s.appMode);
  const config = modeConfig[appMode];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {appMode === "loading" && (
        <span className="mr-1 h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {config.label}
    </div>
  );
};
