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
import { PacketsFilterDialog } from "../components/RightSidebar/PacketsFilterDialog";
import { CommandsFilterDialog } from "../components/RightSidebar/CommandsFilterDialog";
import { getAllCommands, MOCK_COMMANDS } from "../mocks/commands";
import type { BoardName } from "../types/BoardName";
import type { Packet } from "../types/Packet";

export const Testing = () => {
  const { activeTab } = useTabStore();
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Filter states
  const [visibleCommandIds, setVisibleCommandIds] = useState<string[]>(
    getAllCommands().map((cmd) => cmd.id),
  );
  const [visiblePacketIds, setVisiblePacketIds] = useState<string[]>([]);

  // Dialog states
  const [isPacketsDialogOpen, setIsPacketsDialogOpen] = useState(false);
  const [isCommandsDialogOpen, setIsCommandsDialogOpen] = useState(false);

  const toggleCommand = (cmdId: string) => {
    setVisibleCommandIds((prev) =>
      prev.includes(cmdId)
        ? prev.filter((id) => id !== cmdId)
        : [...prev, cmdId],
    );
  };

  const togglePacket = (pktId: string) => {
    setVisiblePacketIds((prev) =>
      prev.includes(pktId)
        ? prev.filter((id) => id !== pktId)
        : [...prev, pktId],
    );
  };

  const visibleCommands = getAllCommands().filter((cmd) =>
    visibleCommandIds.includes(cmd.id),
  );
  const visiblePackets = [] as Packet[];

  if (!activeTab) {
    return <p>No active tab</p>;
  }

  return (
    <>
      {/* Dialogs */}
      <PacketsFilterDialog
        open={isPacketsDialogOpen}
        onOpenChange={setIsPacketsDialogOpen}
        visiblePacketIds={visiblePacketIds}
        onTogglePacket={togglePacket}
        onClearAll={() => setVisiblePacketIds([])}
        onSelectAll={() => setVisiblePacketIds([])}
      />

      <CommandsFilterDialog
        open={isCommandsDialogOpen}
        onOpenChange={setIsCommandsDialogOpen}
        visibleCommandIds={visibleCommandIds}
        onToggleCommand={toggleCommand}
        onClearAll={() => setVisibleCommandIds([])}
        onSelectAll={() =>
          setVisibleCommandIds(getAllCommands().map((c) => c.id))
        }
      />

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
                <RightSidebar
                  visibleCommands={visibleCommands}
                  totalCommands={getAllCommands().length}
                  visiblePackets={visiblePackets}
                  totalPackets={0}
                  onClose={() => setIsSidebarVisible(false)}
                  onOpenPacketsFilter={() => setIsPacketsDialogOpen(true)}
                  onOpenCommandsFilter={() => setIsCommandsDialogOpen(true)}
                  isVisible={isSidebarVisible}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </>
  );
};
