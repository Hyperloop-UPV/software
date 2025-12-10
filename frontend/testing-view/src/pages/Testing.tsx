import {
  Badge,
  Button,
  Spinner,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@workspace/ui";
import { connect } from "@workspace/core";
import { useCallback, useEffect, useState } from "react";
import { useTabStore } from "../store/useTabStore";
import { MOCK_PACKETS } from "../mocks/packets";

import { RightSidebar } from "../components/RightSidebar/RightSidebar";
import { PacketsFilterDialog } from "../components/RightSidebar/Packets/PacketsFilterDialog";
import { CommandsFilterDialog } from "../components/RightSidebar/Commands/CommandsFilterDialog";

export const Testing = () => {
  const { activeTab } = useTabStore();
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  if (!activeTab) {
    return <p>No active tab</p>;
  }

  return (
    <>
      <CommandsFilterDialog />

      <PacketsFilterDialog />

      {/* Main Layout */}
      <div className="relative h-full w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            defaultSize={isSidebarVisible ? 60 : 100}
            minSize={30}
          >
            <div className="relative flex h-full flex-col items-center justify-center">
              <h2 className="text-foreground text-2xl font-bold">
                {activeTab.name}
              </h2>
              <Badge variant="destructive" className="py-xs px-sm text-sm">
                <Spinner className="mr-xs" />
                <span>{activeTab.description}</span>
                <Spinner className="ml-xs" />
              </Badge>

              {!isSidebarVisible && (
                <Button
                  onClick={() => setIsSidebarVisible(true)}
                  className="absolute right-4 top-4"
                  variant="outline"
                  size="icon"
                >
                  <span className="text-lg">→</span>
                </Button>
              )}
            </div>
          </ResizablePanel>

          {isSidebarVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={15} maxSize={70}>
                <RightSidebar onClose={() => setIsSidebarVisible(false)} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </>
  );
};
