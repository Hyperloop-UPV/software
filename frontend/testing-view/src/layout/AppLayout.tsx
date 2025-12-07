import { cn } from "@workspace/ui/lib";
import React, { useState } from "react";
import { useDarkMode } from "@workspace/ui/hooks";
import Footer from "./Footer";
import AppSidebar from "./AppSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components";
import { useLocation } from "react-router";
import TabSwitcher from "../components/TabSwitcher";
import { useTabStore } from "@workspace/ui/store";

interface AppLayoutProps {
  children: React.ReactNode;
  pageName: string;
}

export const AppLayout = ({ children, pageName }: AppLayoutProps) => {
  const { isDarkMode } = useDarkMode();
  const location = useLocation();
  const isTestingPage = location.pathname === "/";

  return (
    <div className="h-full w-full [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="h-full w-full" defaultOpen={false}>
        <div
          className={cn(
            "bg-background flex h-full w-full",
            isDarkMode ? "dark" : "",
          )}
        >
          <AppSidebar />
          <SidebarInset className="flex h-full flex-col">
            <header className="h-(--header-height) flex shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <h1 className="text-xl font-bold">{pageName}</h1>
              {isTestingPage && (
                <div className="ml-auto flex items-center gap-2">
                  <Separator
                    orientation="vertical"
                    className="data-[orientation=vertical]:h-4"
                  />
                  <TabSwitcher />
                </div>
              )}
            </header>
            <div className="flex-1 overflow-auto">{children}</div>
            <Footer />
          </SidebarInset>
        </div>
      </SidebarProvider>

      <Dialog open={false}>
        <DialogContent className="w-fit min-w-fit">
          <DialogTitle>Filter Packets</DialogTitle>
        </DialogContent>
      </Dialog>
    </div>
  );
};
