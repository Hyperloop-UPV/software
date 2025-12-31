import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { Activity } from "react";
import { useStore } from "../../../store/store";
import MessagesSection from "./Sections/MessagesSection";
import { NoneSelectedSection } from "./Sections/NoneSelectedSection";
import TabsSection from "./Sections/TabsSection";

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
      <ResizablePanelGroup direction={isHorizontal ? "horizontal" : "vertical"}>
        <Activity mode={isTabsVisible ? "visible" : "hidden"}>
          <ResizablePanel defaultSize={60} minSize={20}>
            <TabsSection isSplit={isSplit} />
          </ResizablePanel>
          {isMessagesVisible && <ResizableHandle withHandle />}
        </Activity>

        <Activity mode={isMessagesVisible ? "visible" : "hidden"}>
          <ResizablePanel defaultSize={40} minSize={15}>
            <MessagesSection />
          </ResizablePanel>
        </Activity>
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
