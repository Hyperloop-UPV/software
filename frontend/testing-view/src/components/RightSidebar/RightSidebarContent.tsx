import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@workspace/ui";
import MessagesSection from "./Sections/MessagesSection";
import TabsSection from "./Sections/TabsSection";
import { NoneSelectedSection } from "./Sections/NoneSelectedSection";
import { useStore } from "../../store/store";

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
        {isTabsVisible && (
          <>
            <ResizablePanel defaultSize={60} minSize={20}>
              <TabsSection isSplit={isSplit} />
            </ResizablePanel>
            {isMessagesVisible && <ResizableHandle withHandle />}
          </>
        )}

        {isMessagesVisible && (
          <ResizablePanel defaultSize={40} minSize={15}>
            <MessagesSection />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    );
  }

  return (
    <>
      {isTabsVisible && (
        <div className="flex-1 overflow-hidden">
          <TabsSection isSplit={isSplit} />
        </div>
      )}

      {isMessagesVisible && (
        <div className="flex-1 overflow-hidden">
          <MessagesSection />
        </div>
      )}
    </>
  );
};
