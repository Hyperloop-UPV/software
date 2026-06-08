import { SidebarInset, SidebarProvider } from "@workspace/ui/components";
import { useEffect, type ReactNode } from "react";
import Header from "../components/header/Header";
import AppSidebar from "../components/sidebar/AppSidebar";
import { useStore } from "../store/store";

interface AppLayoutProps {
  children: ReactNode;
  backendConnected: boolean;
  onShowShortcuts: () => void;
}

const AppLayout = ({ children, backendConnected, onShowShortcuts }: AppLayoutProps) => {
  const isDarkMode = useStore((s) => s.isDarkMode);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="h-full w-full [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="h-full w-full" defaultOpen={false}>
        <div className="bg-background flex h-full w-full">
          <AppSidebar backendConnected={backendConnected} />
          <SidebarInset className="flex h-full flex-col">
            <Header backendConnected={backendConnected} onShowShortcuts={onShowShortcuts} />
            <div className="flex-1 overflow-auto">{children}</div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default AppLayout;
