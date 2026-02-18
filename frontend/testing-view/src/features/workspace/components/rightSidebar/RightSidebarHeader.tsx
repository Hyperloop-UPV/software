import { Button } from "@workspace/ui";
import {
  Activity,
  MessageSquare,
  PanelBottom,
  PanelRight,
  Terminal,
  X,
} from "@workspace/ui/icons";
import { useStore } from "../../../../store/store";
import { RightSidebarToggle } from "./RightSidebarToggle";

interface RightSidebarHeaderProps {
  onClose: () => void;
}

export const RightSidebarHeader = ({ onClose }: RightSidebarHeaderProps) => {
  const isTelemetryVisible = useStore((s) => s.isTelemetryVisible);
  const isCommandsVisible = useStore((s) => s.isCommandsVisible);
  const isMessagesVisible = useStore((s) => s.isMessagesVisible);
  const isHorizontal = useStore((s) => s.isHorizontal);
  const toggleTelemetry = useStore((s) => s.toggleTelemetry);
  const toggleCommands = useStore((s) => s.toggleCommands);
  const toggleMessages = useStore((s) => s.toggleMessages);
  const toggleLayout = useStore((s) => s.toggleLayout);

  return (
    <div className="flex items-center justify-between border-b p-1.5">
      <div className="flex items-center gap-1">
        {/* Telemetry Toggle */}
        <RightSidebarToggle
          isActive={isTelemetryVisible}
          onClick={toggleTelemetry}
          icon={<Activity className="h-4 w-4" />}
          label={isTelemetryVisible ? "Hide Telemetry" : "Show Telemetry"}
        />

        {/* Commands Toggle */}
        <RightSidebarToggle
          isActive={isCommandsVisible}
          onClick={toggleCommands}
          icon={<Terminal className="h-4 w-4" />}
          label={isCommandsVisible ? "Hide Commands" : "Show Commands"}
        />

        {/* Messages Toggle */}
        <RightSidebarToggle
          isActive={isMessagesVisible}
          onClick={toggleMessages}
          icon={<MessageSquare className="h-4 w-4" />}
          label={isMessagesVisible ? "Hide Messages" : "Show Messages"}
        />
      </div>

      <div className="flex items-center gap-1">
        <RightSidebarToggle
          isActive={isHorizontal}
          onClick={toggleLayout}
          icon={
            isHorizontal ? (
              <PanelRight className="h-4 w-4" />
            ) : (
              <PanelBottom className="h-4 w-4" />
            )
          }
          label={
            isHorizontal ? "Move messages to bottom" : "Move messages to right"
          }
          disabled={!isCommandsVisible || !isMessagesVisible}
        />

        <Button
          onClick={onClose}
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
