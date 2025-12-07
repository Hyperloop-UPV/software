import { useRef, useEffect } from "react";
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui";
import { PacketsTab } from "./PacketsTab";
import { CommandsTab } from "./CommandsTab";
import { MessagesList } from "./MessagesList";
import type { Packet } from "../../mocks/data";
import type { Command } from "../../mocks/commands";
import { X } from "@workspace/ui/icons";

interface RightSidebarProps {
  visibleCommands: Command[];
  totalCommands: number;
  visiblePackets: Packet[];
  totalPackets: number;
  onClose: () => void;
  onOpenPacketsFilter: () => void;
  onOpenCommandsFilter: () => void;
  isVisible: boolean;
}

export const RightSidebar = ({
  visibleCommands,
  totalCommands,
  visiblePackets,
  totalPackets,
  onClose,
  onOpenPacketsFilter,
  onOpenCommandsFilter,
  isVisible,
}: RightSidebarProps) => {
  return (
    <div className="bg-background flex h-full flex-col border-l outline-none">
      {/* Tabs */}
      <Tabs
        defaultValue="commands"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="flex w-full gap-2 rounded-none">
          <TabsTrigger value="packets">Packets</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="flex h-6 w-6"
          >
            <X className="h-3 w-3" />
          </Button>
        </TabsList>

        <TabsContent
          value="packets"
          className="mt-0 flex-1 overflow-y-auto p-4"
        >
          <PacketsTab
            visiblePackets={visiblePackets}
            totalPackets={totalPackets}
            onOpenFilter={onOpenPacketsFilter}
          />
        </TabsContent>

        <TabsContent
          value="commands"
          className="mt-0 flex-1 overflow-y-auto p-4"
        >
          <CommandsTab
            visibleCommands={visibleCommands}
            totalCommands={totalCommands}
            onOpenFilter={onOpenCommandsFilter}
          />
        </TabsContent>
      </Tabs>

      {/* Messages */}
      <MessagesList />
    </div>
  );
};
