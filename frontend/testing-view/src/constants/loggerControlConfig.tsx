import { AlertCircle, Loader2, Play, Square } from "@workspace/ui/icons";

export const LOGGER_CONTROL_CONFIG = {
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
    color: "bg-amber-600",
    text: "Error",
    icon: <AlertCircle size={14} />,
    className: "text-amber-600",
  },
};
