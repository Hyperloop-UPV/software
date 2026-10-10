import { DndContext } from "@dnd-kit/core";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components";
import { useEffect, type ReactNode } from "react";
import Header from "../components/header/Header";
import PlotAddedToast from "../components/PlotAddedToast";
import SessionStatusToast from "../components/SessionStatusToast";
import AppSidebar from "../components/sidebar/AppSidebar";
import SignalDragOverlay from "../components/simple/SignalDragOverlay";
import { useSignalDnd } from "../components/simple/hooks/useSignalDnd";
import { useStore } from "../store/store";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const isDarkMode = useStore((s) => s.isDarkMode);
  const { sensors, activeIds, handleDragStart, handleDragEnd } = useSignalDnd();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="h-full w-full [--header-height:calc(--spacing(14))]">
      <SidebarProvider
          className="h-full w-full"
          defaultOpen={true}
          style={{ "--sidebar-width": "20vw" } as React.CSSProperties}
        >
        {/* AppSidebar (drag source) and the routed page content (drop
            targets, e.g. Plot Studio) are siblings here — the natural
            common ancestor for the sidebar→plot signal drag-and-drop. */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="bg-background flex h-full w-full overflow-x-hidden">
            <AppSidebar />
            <SidebarInset className="flex h-full min-w-0 flex-col">
              <Header />
              <div className="flex-1 overflow-auto">{children}</div>
            </SidebarInset>
          </div>
          <SignalDragOverlay activeIds={activeIds} />
        </DndContext>
        <SessionStatusToast />
        <PlotAddedToast />
      </SidebarProvider>
    </div>
  );
};

export default AppLayout;
