// Main sidebar shell. Content is divided into three groups:
//   1. FolderPickerGroup  — open a log session folder.
//   2. SeriesSelectionBar — bulk-add checked measurements to a plot (only when something's checked).
//   3. SeriesGroup        — select which measurements to plot (visible once a session is loaded).
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@workspace/ui/components";
import { useStore } from "../../store/store";
import FolderPickerGroup from "./FolderPickerGroup";
import OrdersTimelineControl from "./OrdersTimelineControl";
import SeriesGroup from "./SeriesGroup";
import SeriesSelectionBar from "./SeriesSelectionBar";
import SidebarToggleHandle from "./SidebarToggleHandle";
import ThemeToggleItem from "./ThemeToggleItem";

const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  const hasLoadedSession = useStore((s) => s.folderName !== null);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Fixed — always visible regardless of scroll position */}
      <SidebarHeader className="p-0">
        <FolderPickerGroup />
        <SeriesSelectionBar />
        <SidebarSeparator />
      </SidebarHeader>

      {/* Scrollable area for series selection */}
      <SidebarContent className="overflow-x-hidden overflow-y-auto">
        <SeriesGroup />
      </SidebarContent>

      <SidebarFooter>
        {hasLoadedSession && (
          <>
            <OrdersTimelineControl />
            <SidebarSeparator className="my-2" />
          </>
        )}
        <ThemeToggleItem />
      </SidebarFooter>

      <SidebarToggleHandle />
    </Sidebar>
  );
};

export default AppSidebar;
