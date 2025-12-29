import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui";
import {
  Columns,
  List,
  MessageSquare,
  PanelBottom,
  PanelRight,
  X,
} from "@workspace/ui/icons";
import { useStore } from "../../store/store";

interface RightSidebarHeaderProps {
  onClose: () => void;
}

export const RightSidebarHeader = ({ onClose }: RightSidebarHeaderProps) => {
  const isTabsVisible = useStore((s) => s.isTabsVisible);
  const isMessagesVisible = useStore((s) => s.isMessagesVisible);
  const isHorizontal = useStore((s) => s.isHorizontal);
  const isSplit = useStore((s) => s.isSplit);
  const bothVisible = useStore((s) => s.getBothVisible());
  const toggleTabs = useStore((s) => s.toggleTabs);
  const toggleMessages = useStore((s) => s.toggleMessages);
  const toggleLayout = useStore((s) => s.toggleLayout);
  const toggleSplit = useStore((s) => s.toggleSplit);

  return (
    <div className="flex items-center justify-between border-b p-1.5">
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleTabs}
                size="icon"
                variant={isTabsVisible ? "default" : "ghost"}
                className="h-7 w-7"
                aria-label={
                  isTabsVisible
                    ? "Hide Commands / Packets"
                    : "Show Commands / Packets"
                }
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>
                {isTabsVisible
                  ? "Hide Commands / Packets"
                  : "Show Commands / Packets"}
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleMessages}
                size="icon"
                variant={isMessagesVisible ? "default" : "secondary"}
                className="h-7 w-7"
                aria-label={
                  isMessagesVisible ? "Hide Messages" : "Show Messages"
                }
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isMessagesVisible ? "Hide Messages" : "Show Messages"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleSplit}
                size="icon"
                variant={isSplit ? "default" : "secondary"}
                className="h-7 w-7"
                aria-label={isSplit ? "Merge tabs" : "Split tabs into columns"}
                disabled={!isTabsVisible}
              >
                <Columns className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isSplit ? "Merge tabs" : "Split tabs into columns"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleLayout}
                variant="secondary"
                size="icon"
                className="h-7 w-7"
                aria-label={
                  isHorizontal
                    ? "Switch to messages on the bottom"
                    : "Switch to messages on the right"
                }
                disabled={!bothVisible}
              >
                {isHorizontal ? (
                  <PanelRight className="h-4 w-4" />
                ) : (
                  <PanelBottom className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>
                {isHorizontal
                  ? "Move messages to the bottom"
                  : "Move messages to the right"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
