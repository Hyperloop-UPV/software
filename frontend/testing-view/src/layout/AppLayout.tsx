import { SidebarInset, SidebarProvider } from "@workspace/ui/components";
import React, { useEffect } from "react";
import Footer from "../components/Footer";
import Header from "../components/Header/Header";
import AppSidebar from "../components/LeftSidebar/AppSidebar";
import { SettingsDialog } from "../components/Settings/SettingsDialog";
import { useStore } from "../store/store";

interface AppLayoutProps {
  children: React.ReactNode;
  backendConnected: boolean;
}

export const AppLayout = ({ children, backendConnected }: AppLayoutProps) => {
  const colorScheme = useStore((s) => s.colorScheme);
  const isDarkMode = useStore((s) => s.isDarkMode);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Sync color scheme to the root html element
  useEffect(() => {
    const root = window.document.documentElement;
    // Remove old schemes if you have more than one
    root.classList.remove("default", "pink");
    root.classList.add(colorScheme);
  }, [colorScheme]);

  return (
    <div className="h-full w-full [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="h-full w-full" defaultOpen={false}>
        <div className="bg-background flex h-full w-full">
          <AppSidebar backendConnected={backendConnected} />
          <SidebarInset className="flex h-full flex-col">
            <Header />
            <div className="flex-1 overflow-auto">{children}</div>
            <Footer />
          </SidebarInset>
        </div>
      </SidebarProvider>
      <SettingsDialog />
    </div>
  );
};
