import {
  Badge,
  Button,
  Spinner,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@workspace/ui";
import { useState } from "react";
import { useWorkspacesStore } from "../store/useWorkspacesStore";

import { RightSidebar } from "../components/RightSidebar/RightSidebar";
import { PacketsFilterDialog } from "../components/RightSidebar/Packets/PacketsFilterDialog";
import { CommandsFilterDialog } from "../components/RightSidebar/Commands/CommandsFilterDialog";
import { ChevronLeft } from "@workspace/ui/icons";

export const Testing = () => {
  const { activeWorkspace } = useWorkspacesStore();
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  if (!activeWorkspace) {
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
                {activeWorkspace.name}
              </h2>
              <Badge className="py-xs px-sm text-sm">
                <Spinner className="mr-xs" />
                <span>{activeWorkspace.description}</span>
                <Spinner className="ml-xs" />
              </Badge>

              {!isSidebarVisible && (
                <Button
                  onClick={() => setIsSidebarVisible(true)}
                  className="text-foreground absolute right-4 top-4"
                  variant="outline"
                  size="icon"
                >
                  <span className="text-lg">
                    <ChevronLeft className="text-foreground h-4 w-4" />
                  </span>
                </Button>
              )}
            </div>
          </ResizablePanel>

          {isSidebarVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={20} maxSize={70}>
                <RightSidebar onClose={() => setIsSidebarVisible(false)} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </>
  );
};
