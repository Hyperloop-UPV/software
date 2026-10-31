import { SidebarMenuButton } from "@hyperloop-upv/frontend-kit/components";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { LOGGER_CONTROL_CONFIG } from "../../constants/loggerControlConfig";
import { useLogger } from "../../hooks/useLogger";

interface LoggerItemProps {
  disabled: boolean;
}

const LoggerItem = ({ disabled }: LoggerItemProps) => {
  const { status, toggleLogging } = useLogger();
  const config = LOGGER_CONTROL_CONFIG[status];
  const label = `Logger: ${config.text}`;

  return (
    <SidebarMenuButton
      tooltip={label}
      onClick={toggleLogging}
      disabled={disabled || status === "loading"}
      className={cn("transition-colors", config.className)}
    >
      {config.icon}
      <span className="flex items-center gap-2">
        {label}
        <span className="relative flex size-2 items-center justify-center">
          {status === "recording" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          )}
          <span
            className={cn(
              "relative inline-flex size-2 rounded-full",
              config.color,
            )}
          ></span>
        </span>
      </span>
    </SidebarMenuButton>
  );
};

export default LoggerItem;
