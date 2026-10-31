import { logger, socketService } from "@hyperloop-upv/frontend-kit/core";
import { useTopic } from "@hyperloop-upv/frontend-kit/hooks";
import { useEffect, useState } from "react";
import type { LoggerStatus } from "../types/logger";

/** Time to wait for a `logger/response` before flagging an error (ms). */
const LOGGER_RESPONSE_TIMEOUT = 2000;

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
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  const log = (enable: boolean) => {
    if (sharedTimeout) clearTimeout(sharedTimeout);

    updateStatus("loading");

    socketService.post("logger/enable", enable);

    sharedTimeout = setTimeout(() => {
      updateStatus("error");
      sharedTimeout = null;
    }, LOGGER_RESPONSE_TIMEOUT);
  };

  useTopic<boolean>("logger/response", (isLogging) => {
    if (sharedTimeout) {
      clearTimeout(sharedTimeout);
      sharedTimeout = null;
    }
    updateStatus(isLogging ? "recording" : "standby");
  });

  // Unlike testing-view, competition-view has no variable filter UI, so no
  // `logger/variables` is posted and the backend logs every variable.
  const startLogging = () => {
    if (sharedStatus === "recording" || sharedStatus === "loading") return;
    logger.competitionView.log("Starting logger...");
    log(true);
  };

  const stopLogging = () => {
    if (sharedStatus !== "recording") return;
    logger.competitionView.log("Stopping logger...");
    log(false);
  };

  const toggleLogging = () =>
    sharedStatus === "recording" ? stopLogging() : startLogging();

  return { status, startLogging, stopLogging, toggleLogging };
}
