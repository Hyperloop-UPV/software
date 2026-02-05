import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { Activity } from "react";
import { useStore } from "../../../../store/store";
import MessagesSection from "./sections/MessagesSection";
import { NoneSelectedSection } from "./sections/NoneSelectedSection";
import TabsSection from "./sections/TabsSection";

interface RightSidebarContentProps {}

export const RightSidebarContent = ({}: RightSidebarContentProps) => {
  const isTabsVisible = useStore((s) => s.isTabsVisible);
  const isMessagesVisible = useStore((s) => s.isMessagesVisible);
  const isHorizontal = useStore((s) => s.isHorizontal);
  const isSplit = useStore((s) => s.isSplit);
  const bothVisible = useStore((s) => s.getBothVisible());
  const noneVisible = useStore((s) => s.getNoneVisible());

  if (noneVisible) {
    return <NoneSelectedSection />;
  }

  if (bothVisible) {
    return (
      <ResizablePanelGroup
        orientation={isHorizontal ? "horizontal" : "vertical"}
        defaultLayout={{ tabs: 80, messages: 20 }}
      >
        <ResizablePanel id="tabs" minSize="20%">
          <Activity mode={isTabsVisible ? "visible" : "hidden"}>
            <TabsSection isSplit={isSplit} />
          </Activity>
        </ResizablePanel>
        {isMessagesVisible && <ResizableHandle withHandle />}

        <ResizablePanel id="messages" minSize="15%">
          <Activity mode={isMessagesVisible ? "visible" : "hidden"}>
            <MessagesSection />
          </Activity>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <>
      <Activity mode={isTabsVisible ? "visible" : "hidden"}>
        <div className="flex-1 overflow-hidden">
          <TabsSection isSplit={isSplit} />
        </div>
      </Activity>

      <Activity mode={isMessagesVisible ? "visible" : "hidden"}>
        <div className="flex-1 overflow-hidden">
          <MessagesSection />
        </div>
      </Activity>
    </>
  );
};
