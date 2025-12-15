import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui";
import { PacketsTab } from "../Packets/PacketsTab";
import { ChevronUp, X } from "@workspace/ui/icons";
import { CommandsTab } from "../Commands/CommandsTab";
import { useTabsStore } from "../../../store/useTabsStore";
import type { SidebarTab } from "../../../types/SidebarTab";

const TabsSection = ({
  onCollapse,
  onClose,
}: {
  onCollapse: () => void;
  onClose: () => void;
}) => {
  const activeTab = useTabsStore((s) => s.getActiveTab());
  const setActiveTab = useTabsStore((s) => s.setActiveTab);

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
