import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui";
import PacketsTab from "../Packets/PacketsTab";
import { ChevronUp, X } from "@workspace/ui/icons";
import { CommandsTab } from "../Commands/CommandsTab";
import { useTabsStore } from "../../../store/useTabsStore";
import type { SidebarTab } from "../../../types/SidebarTab";

interface TabsSectionProps {
  onCollapse: () => void;
  onClose: () => void;
  isSplit: boolean;
}

const TabsSection = ({ onCollapse, onClose, isSplit }: TabsSectionProps) => {
  const activeTab = useTabsStore((s) => s.getActiveTab());
  const setActiveTab = useTabsStore((s) => s.setActiveTab);

  if (isSplit) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header with collapse/close buttons */}
        <div className="flex items-center border-b">
          <Button onClick={onCollapse} variant="ghost" size="sm">
            <ChevronUp className="text-foreground h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <span className="text-foreground text-sm font-medium">
              Packets & Commands
            </span>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="ml-auto"
          >
            <X className="text-foreground h-3 w-3" />
          </Button>
        </div>

        {/* Split view - both tabs side by side */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="border-b p-2">
                <span className="text-foreground text-sm font-semibold">
                  Packets
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <PacketsTab />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="border-b p-2">
                <span className="text-foreground text-sm font-semibold">
                  Commands
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <CommandsTab />
              </div>
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
      className="flex h-full flex-col"
    >
      <TabsList className="flex w-full rounded-none">
        <Button onClick={onCollapse} variant="ghost" size="sm">
          <ChevronUp className="text-foreground h-4 w-4" />
        </Button>
        <TabsTrigger value="packets">Packets</TabsTrigger>
        <TabsTrigger value="commands">Commands</TabsTrigger>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="ml-auto"
        >
          <X className="text-foreground h-3 w-3" />
        </Button>
      </TabsList>

      <TabsContent value="packets" className="mt-0 flex-1 overflow-y-auto p-4">
        <PacketsTab />
      </TabsContent>

      <TabsContent value="commands" className="mt-0 flex-1 overflow-y-auto p-4">
        <CommandsTab />
      </TabsContent>
    </Tabs>
  );
};

export default TabsSection;
