import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui";
import { BOARD_NAMES } from "../../../../../constants/boards";
import { useStore } from "../../../../../store/store";
import type { CommandCatalogItem } from "../../../../../types/data/commandCatalogItem";
import type { TelemetryCatalogItem } from "../../../../../types/data/telemetryCatalogItem";
import type { SidebarTab } from "../../../types/sidebar";
import { CommandItem } from "../tabs/commands/CommandItem";
import { Tab } from "../tabs/Tab";
import { TelemetryItem } from "../tabs/telemetry/TelemetryItem";

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
        <ResizablePanelGroup
          orientation="horizontal"
          className="flex-1"
          defaultLayout={{ telemetry: 50, commands: 50 }}
        >
          <ResizablePanel id="telemetry" minSize="30%">
            <div className="flex h-full flex-1 flex-col overflow-y-auto px-4">
              <Tab
                title="Telemetry"
                scope="telemetry"
                categories={BOARD_NAMES}
                ItemComponent={(props) => (
                  <TelemetryItem item={props.item as TelemetryCatalogItem} />
                )}
                virtualized
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id="commands" minSize="30%">
            <div className="flex h-full flex-1 flex-col overflow-y-auto px-4">
              <Tab
                title="Commands"
                scope="commands"
                categories={BOARD_NAMES}
                ItemComponent={(props) => (
                  <CommandItem item={props.item as CommandCatalogItem} />
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
        <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
        <TabsTrigger value="commands">Commands</TabsTrigger>
      </TabsList>

      <TabsContent
        value="telemetry"
        className="mt-0 flex h-full flex-1 flex-col overflow-y-auto px-4"
      >
        <Tab
          title="Telemetry"
          scope="telemetry"
          categories={BOARD_NAMES}
          ItemComponent={(props) => (
            <TelemetryItem item={props.item as TelemetryCatalogItem} />
          )}
          virtualized
        />
      </TabsContent>

      <TabsContent
        value="commands"
        className="mt-0 flex h-full flex-1 flex-col overflow-y-auto px-4"
      >
        <Tab
          title="Commands"
          scope="commands"
          categories={BOARD_NAMES}
          ItemComponent={(props) => (
            <CommandItem item={props.item as CommandCatalogItem} />
          )}
        />
      </TabsContent>
    </Tabs>
  );
};

export default TabsSection;
