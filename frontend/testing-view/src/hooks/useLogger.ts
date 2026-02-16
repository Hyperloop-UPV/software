import { socketService } from "@workspace/core";
import { useTopic } from "@workspace/ui/hooks";
import { useRef, useState } from "react";
import { config } from "../../config";
import type { LoggerStatus } from "../types/common/logger";

export function useLogger() {
  const [status, setStatus] = useState<LoggerStatus>("standby");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const log = (enable: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setStatus("loading");

    socketService.post("logger/enable", enable);

    timeoutRef.current = setTimeout(() => {
      setStatus("error");
      timeoutRef.current = null;
    }, config.LOGGER_RESPONSE_TIMEOUT);
  };

  useTopic<boolean>("logger/response", (isLogging) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus(isLogging ? "recording" : "standby");
  });

  const startLogging = (vars: string[]) => {
    socketService.post("logger/variables", vars);
    log(true);
  };

  const stopLogging = () => log(false);

  return { status, startLogging, stopLogging };
}
