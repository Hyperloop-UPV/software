import { cn } from "@workspace/ui/lib";
import React from "react";
import Footer from "./Footer";
import AppSidebar from "./AppSidebar";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components";
import Header from "../components/Header/Header";
import { useStore } from "../store/store";

interface AppLayoutProps {
  children: React.ReactNode;
  backendConnected: boolean;
}

export const AppLayout = ({ children, backendConnected }: AppLayoutProps) => {
  const colorScheme = useStore((s) => s.colorScheme);
  const isDarkMode = useStore((s) => s.isDarkMode);

  return (
    <div className="h-full w-full [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="h-full w-full" defaultOpen={false}>
        <div
          className={cn(
            "bg-background flex h-full w-full",
            isDarkMode ? "dark" : "",
            colorScheme,
          )}
        >
          <AppSidebar backendConnected={backendConnected} />
          <SidebarInset className="flex h-full flex-col">
            <Header />
            <div className="flex-1 overflow-auto">{children}</div>
            <Footer />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
};
