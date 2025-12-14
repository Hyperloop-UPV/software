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

  // Both collapsed - show both headers
  if (!isTabsVisible && !isMessagesVisible) {
    return (
      <div className="bg-background flex h-full flex-col border-l">
        <CollapsedHeader
          title="Commands / Packets"
          onExpand={() => setIsTabsVisible(true)}
          onClose={onClose}
        />
        <CollapsedHeader
          title="Messages"
          onExpand={() => setIsMessagesVisible(true)}
        />
      </div>
    );
  }

  // Only tabs visible
  if (isTabsVisible && !isMessagesVisible) {
    return (
      <div className="bg-background flex h-full flex-col border-l">
        <TabsSection
          onCollapse={() => setIsTabsVisible(false)}
          onClose={onClose}
        />
        <CollapsedHeader
          title="Messages"
          onExpand={() => setIsMessagesVisible(true)}
        />
      </div>
    );
  }

  // Only messages visible
  if (!isTabsVisible && isMessagesVisible) {
    return (
      <div className="bg-background flex h-full flex-col border-l">
        <CollapsedHeader
          title="Commands / Packets"
          onExpand={() => setIsTabsVisible(true)}
          onClose={onClose}
        />
        <MessagesSection onCollapse={() => setIsMessagesVisible(false)} />
      </div>
    );
  }

  // Both visible - resizable
  return (
    <div className="bg-background flex h-full flex-col border-l">
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
