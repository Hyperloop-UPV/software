import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui";
import type { SidebarTab } from "../../../types/SidebarTab";
import { useStore } from "../../../store/store";
import { BOARD_NAMES } from "../../../constants/boards";
import { Tab } from "../Tabs/Tab";
import { CommandItem } from "../Tabs/Commands/CommandItem";
import { PacketItem } from "../Tabs/Packets/PacketItem";
import type { Packet } from "../../../types/Packet";
import type { Command } from "../../../types/Command";

interface TabsSectionProps {
  isSplit: boolean;
}

const TabsSection = ({ isSplit }: TabsSectionProps) => {
  const activeTab = useStore((s) => s.getActiveTab());
  const setActiveTab = useStore((s) => s.setActiveTab);

  if (isSplit) {
    return (
      <div className="flex h-full flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center border-b">
          <div className="flex-1 p-2 text-center">
            <span className="text-foreground text-sm font-semibold">
              Packets & Commands
            </span>
          </div>
        </div>

        {/* Split view - both tabs side by side */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-1 flex-col overflow-y-auto p-4">
              <Tab
                title="Packets"
                scope="packets"
                categories={BOARD_NAMES}
                ItemComponent={(props) => (
                  <PacketItem item={props.item as Packet} />
                )}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-1 flex-col overflow-y-auto p-4">
              <Tab
                title="Commands"
                scope="commands"
                categories={BOARD_NAMES}
                ItemComponent={(props) => (
                  <CommandItem item={props.item as Command} />
                )}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as SidebarTab)}
      className="flex h-full flex-1 flex-col overflow-y-auto"
    >
      <TabsList className="flex w-full rounded-none">
        <TabsTrigger value="packets">Packets</TabsTrigger>
        <TabsTrigger value="commands">Commands</TabsTrigger>
      </TabsList>

      <TabsContent
        value="packets"
        className="mt-0 flex h-full flex-1 flex-col overflow-y-auto p-4"
      >
        <Tab
          title="Packets"
          scope="packets"
          categories={BOARD_NAMES}
          ItemComponent={(props) => <PacketItem item={props.item as Packet} />}
        />
      </TabsContent>

      <TabsContent value="commands" className="mt-0 flex-1 overflow-y-auto p-4">
        <Tab
          title="Commands"
          scope="commands"
          categories={BOARD_NAMES}
          ItemComponent={(props) => (
            <CommandItem item={props.item as Command} />
          )}
        />
      </TabsContent>
    </Tabs>
  );
};

export default TabsSection;
