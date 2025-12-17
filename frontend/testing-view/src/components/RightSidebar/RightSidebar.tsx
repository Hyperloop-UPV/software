import { useState } from "react";
import {
  Button,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  TooltipTrigger,
  Tooltip,
  TooltipProvider,
  TooltipContent,
} from "@workspace/ui";
import {
  X,
  ChevronDown,
  LayoutGrid,
  Layout,
  Columns,
} from "@workspace/ui/icons";
import MessagesSection from "./Sections/MessagesSection";
import TabsSection from "./Sections/TabsSection";

interface RightSidebarProps {
  onClose: () => void;
}

export const RightSidebar = ({ onClose }: RightSidebarProps) => {
  const [isTabsVisible, setIsTabsVisible] = useState(true);
  const [isMessagesVisible, setIsMessagesVisible] = useState(true);

  const bothVisible = isTabsVisible && isMessagesVisible;
  const noneVisible = !isTabsVisible && !isMessagesVisible;

  const [isHorizontal, setLayout] = useState(true);
  const [isSplit, setIsSplit] = useState(false);

  const toggleLayout = () => setLayout((prev) => !prev);
  const toggleSplit = () => setIsSplit((prev) => !prev);

  return (
    <div className="bg-background flex h-full flex-col border-l">
      {/* Layout Toggle Button - Header */}
      <div className="flex items-center justify-end border-b p-1">
        <TooltipProvider>
          {/* Split Columns Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleSplit}
                variant={isSplit ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                aria-label={isSplit ? "Merge tabs" : "Split tabs into columns"}
              >
                <Columns className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isSplit ? "Merge tabs" : "Split tabs into columns"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleLayout}
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={
                  isHorizontal
                    ? "Switch to vertical layout"
                    : "Switch to horizontal layout"
                }
              >
                {isHorizontal ? (
                  <Layout className="h-4 w-4" />
                ) : (
                  <LayoutGrid className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isHorizontal ? "Vertical layout" : "Horizontal layout"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {bothVisible ? (
        // Both visible - use resizable panels
        <ResizablePanelGroup
          direction={isHorizontal ? "horizontal" : "vertical"}
        >
          <ResizablePanel defaultSize={60} minSize={20}>
            <TabsSection
              onCollapse={() => setIsTabsVisible(false)}
              onClose={onClose}
              isSplit={isSplit}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={40} minSize={15}>
            <MessagesSection onCollapse={() => setIsMessagesVisible(false)} />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        // At least one is collapsed - use fixed layout
        <>
          {isTabsVisible ? (
            <TabsSection
              onCollapse={() => setIsTabsVisible(false)}
              onClose={onClose}
              isSplit={isSplit}
            />
          ) : (
            <CollapsedHeader
              title="Commands / Packets"
              onExpand={() => setIsTabsVisible(true)}
              onClose={noneVisible ? onClose : undefined}
            />
          )}

          {isMessagesVisible ? (
            <MessagesSection onCollapse={() => setIsMessagesVisible(false)} />
          ) : (
            <CollapsedHeader
              title="Messages"
              onExpand={() => setIsMessagesVisible(true)}
            />
          )}
        </>
      )}
    </div>
  );
};

// Collapsed header component
const CollapsedHeader = ({
  title,
  onExpand,
  onClose,
}: {
  title: string;
  onExpand: () => void;
  onClose?: () => void;
}) => (
  <div className="flex items-center border-b p-2">
    <Button onClick={onExpand} variant="ghost" size="sm">
      <ChevronDown className="text-foreground h-4 w-4" />
    </Button>
    <span className="text-foreground text-sm font-semibold">{title}</span>
    {onClose && (
      <Button onClick={onClose} variant="ghost" size="icon" className="ml-auto">
        <X className="text-foreground h-3 w-3" />
      </Button>
    )}
  </div>
);
