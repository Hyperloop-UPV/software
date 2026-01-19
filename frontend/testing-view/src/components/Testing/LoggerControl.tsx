import { Button, Separator } from "@workspace/ui";
import { Settings2 } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { LOGGER_CONTROL_CONFIG } from "../../constants/loggerControlConfig";
import { useLogger } from "../../hooks/useLogger";
import { useStore } from "../../store/store";
import type { TelemetryCatalogItem } from "../../types/data/telemetryCatalogItem";

interface LoggerControlProps {
  disabled: boolean;
}

export const LoggerControl = ({ disabled }: LoggerControlProps) => {
  const { status, startLogging, stopLogging } = useLogger();
  const openFilterDialog = useStore((s) => s.openFilterDialog);
  const getFilteredItems = useStore((s) => s.getFilteredItems);

  const handleToggle = () => {
    if (status === "loading") return;

    if (status === "recording") {
      stopLogging();
    } else {
      const selectedPackets = getFilteredItems(
        "logs",
      ) as TelemetryCatalogItem[];
      const variableNames = selectedPackets.flatMap((p) =>
        p.measurements.map((m) => m.name),
      );
      startLogging(variableNames);
    }
  };

  const config = LOGGER_CONTROL_CONFIG[status];

  return (
    <div className="bg-background flex items-center gap-1 rounded-lg border p-1 shadow-sm">
      {/* Status Indicator & Title */}
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="relative flex size-2 items-center justify-center">
          {status === "recording" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          )}
          <span
            className={cn(
              "relative inline-flex size-2 rounded-full",
              config.color,
            )}
          ></span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-[10px] font-bold uppercase leading-none tracking-wider">
            Logger
          </span>
          <span className="text-xs font-medium leading-tight">
            {config.text}
          </span>
        </div>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Control Buttons */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 transition-colors", config.className)}
          onClick={handleToggle}
          title={config.text}
          disabled={disabled || status === "loading"}
        >
          {config.icon}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          onClick={() => openFilterDialog("logs")}
          title="Configure Logger Variables"
          disabled={disabled || status === "loading" || status === "recording"}
        >
          <Settings2 size={14} />
        </Button>
      </div>
    </div>
  );
};
