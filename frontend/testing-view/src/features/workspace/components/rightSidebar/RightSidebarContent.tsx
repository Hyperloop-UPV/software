import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui";
import { useStore } from "../../../../store/store";
import { CommandsSection } from "./sections/CommandsSection";
import MessagesSection from "./sections/MessagesSection";
import { NoneSelectedSection } from "./sections/NoneSelectedSection";
import { TelemetrySection } from "./sections/TelemetrySection";

interface RightSidebarContentProps {}

export const RightSidebarContent = ({}: RightSidebarContentProps) => {
  const isTelemetryVisible = useStore((s) => s.isTelemetryVisible);
  const isCommandsVisible = useStore((s) => s.isCommandsVisible);
  const isMessagesVisible = useStore((s) => s.isMessagesVisible);
  const isHorizontal = useStore((s) => s.isHorizontal);
  const noneVisible = useStore((s) => s.getNoneVisible());

  const showCommandsMessages = isCommandsVisible || isMessagesVisible;

  if (noneVisible) {
    return <NoneSelectedSection />;
  }

  return (
    <ResizablePanelGroup orientation={"horizontal"}>
      {/* 1. Permanent Telemetry Column (Full Height) */}
      {isTelemetryVisible && (
        <>
          <ResizablePanel
            id="telemetry"
            minSize="20%"
            defaultSize={isHorizontal ? 40 : 50}
          >
            <div className="flex h-full flex-col overflow-hidden px-4">
              <TelemetrySection />
            </div>
          </ResizablePanel>
          {showCommandsMessages && <ResizableHandle withHandle />}
        </>
      )}

      {/* 2. Right Column (Commands & Messages) */}
      {showCommandsMessages && (
        <ResizablePanel
          id="right-column"
          minSize="20%"
          defaultSize={isHorizontal ? 60 : 50}
        >
          {
            <ResizablePanelGroup
              orientation={isHorizontal ? "horizontal" : "vertical"}
            >
              {isCommandsVisible && (
                <ResizablePanel
                  id="commands"
                  defaultSize={isHorizontal ? 50 : 70}
                >
                  <div className="flex h-full flex-col overflow-hidden border-r px-4">
                    <CommandsSection />
                  </div>
                </ResizablePanel>
              )}

              {isCommandsVisible && isMessagesVisible && (
                <ResizableHandle withHandle />
              )}

              {isMessagesVisible && (
                <ResizablePanel
                  id="messages"
                  defaultSize={isHorizontal ? 50 : 30}
                >
                  <MessagesSection />
                </ResizablePanel>
              )}
            </ResizablePanelGroup>
          }
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  );
};
