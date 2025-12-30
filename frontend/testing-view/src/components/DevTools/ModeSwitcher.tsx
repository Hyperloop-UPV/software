import { Button } from "@workspace/ui";
import type { AppMode } from "../../store/slices/appSlice";
import { useStore } from "../../store/store";

const MODES: { value: AppMode | null; label: string }[] = [
  { value: null, label: "Auto" },
  { value: "loading", label: "Loading" },
  { value: "active", label: "Active" },
  { value: "mock", label: "Mock" },
  { value: "error", label: "Error" },
];

export const ModeSwitcher = () => {
  const modeOverride = useStore((s) => s.modeOverride);
  const setModeOverride = useStore((s) => s.setModeOverride);
  const currentMode = useStore((s) => s.appMode);

  // Only show in development
  if (!import.meta.env.DEV && !import.meta.env.VITE_FORCE_DEV) return null;

  return (
    <div className="bg-background fixed bottom-3 left-14 z-50 flex flex-col gap-2 rounded-lg border p-3 shadow-lg">
      <div className="text-muted-foreground text-xs font-semibold">
        Dev Mode Switcher
      </div>
      <div className="text-xs">
        Current: <span className="font-mono font-bold">{currentMode}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {MODES.map((mode) => (
          <Button
            key={mode.label}
            size="sm"
            variant={modeOverride === mode.value ? "default" : "outline"}
            onClick={() => setModeOverride(mode.value)}
            className="h-7 text-xs"
          >
            {mode.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
