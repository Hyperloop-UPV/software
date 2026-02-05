import { AlertCircle, Loader2, Play, Square } from "@workspace/ui/icons";
import type { LoggerStatus } from "../types/common/logger";

interface LoggerControlOption {
  color: string;
  text: string;
  icon: React.ReactNode;
  className: string;
}

/** Appearance configuration for the logger control state. */
export const LOGGER_CONTROL_CONFIG: Record<LoggerStatus, LoggerControlOption> =
  {
    standby: {
      color: "bg-slate-300",
      text: "Standby",
      icon: <Play size={14} fill="currentColor" />,
      className: "text-green-500",
    },
    recording: {
      color: "bg-red-500",
      text: "Recording",
      icon: <Square size={14} fill="currentColor" />,
      className: "text-red-500",
    },
    loading: {
      color: "bg-amber-400",
      text: "Loading...",
      icon: <Loader2 size={14} className="animate-spin" />,
      className: "text-amber-500",
    },
    error: {
      color: "bg-amber-800",
      text: "Time out",
      icon: <AlertCircle size={14} />,
      className: "text-amber-800",
    },
  };
