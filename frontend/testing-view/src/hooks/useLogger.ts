import { socketService } from "@workspace/core";
import { useTopic } from "@workspace/ui/hooks";
import { useEffect, useState } from "react";
import { config } from "../../config";
import { useStore } from "../store/store";
import type { BoardName } from "../types/data/board";
import type { LoggerStatus } from "../types/common/logger";
import type { TelemetryCatalogItem } from "../types/data/telemetryCatalogItem";

// Shared singleton state across all useLogger instances
let sharedStatus: LoggerStatus = "standby";
let sharedTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(status: LoggerStatus) => void>();

const updateStatus = (status: LoggerStatus) => {
  sharedStatus = status;
  listeners.forEach((l) => l(status));
};

export const getLoggerStatus = () => sharedStatus;

export function useLogger() {
  const [status, setStatus] = useState<LoggerStatus>(sharedStatus);

  useEffect(() => {
    listeners.add(setStatus);
    return () => { listeners.delete(setStatus); };
  }, []);

  const log = (enable: boolean) => {
    if (sharedTimeout) clearTimeout(sharedTimeout);

    updateStatus("loading");

    socketService.post("logger/enable", enable);

    sharedTimeout = setTimeout(() => {
      updateStatus("error");
      sharedTimeout = null;
    }, config.LOGGER_RESPONSE_TIMEOUT);
  };

  useTopic<boolean>("logger/response", (isLogging) => {
    if (sharedTimeout) {
      clearTimeout(sharedTimeout);
      sharedTimeout = null;
    }
    updateStatus(isLogging ? "recording" : "standby");
  });

  const getVariables = (): string[] => {
    const catalog = useStore.getState().getCatalog("logs");
    const filters = useStore.getState().getActiveFilters("logs");

    if (!catalog || !filters) return [];

    return Object.entries(catalog).flatMap(([boardName, items]) => {
      const selectedIds = filters[boardName as BoardName] || [];
      const selectedPackets = items.filter((item) =>
        selectedIds.includes(item.id),
      ) as TelemetryCatalogItem[];
      return selectedPackets.flatMap((p) =>
        p.measurements.map((m) => `${boardName}/${m.id}`),
      );
    });
  };

  const startLogging = () => {
    if (sharedStatus === "recording" || sharedStatus === "loading") return;
    const vars = getVariables();
    socketService.post("logger/variables", vars);
    log(true);
  };

  const stopLogging = () => {
    if (sharedStatus !== "recording") return;
    log(false);
  };

  const toggleLogging = () =>
    sharedStatus === "recording" ? stopLogging() : startLogging();

  return { status, startLogging, stopLogging, toggleLogging };
}
