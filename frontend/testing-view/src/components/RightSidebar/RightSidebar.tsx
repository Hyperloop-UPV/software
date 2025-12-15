import { useState } from "react";
import {
  Button,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@workspace/ui";
import { X, ChevronDown } from "@workspace/ui/icons";
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

  return (
    <div className="bg-background flex h-full flex-col border-l">
      {bothVisible ? (
        // Both visible - use resizable panels
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={60} minSize={20}>
            <TabsSection
              onCollapse={() => setIsTabsVisible(false)}
              onClose={onClose}
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
