import { cn } from "@workspace/ui/lib";
import React, { useState } from "react";
import { useDarkMode } from "@workspace/ui/hooks";
import Footer from "./Footer";
import AppSidebar from "./AppSidebar";
import {
  Separator,
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
    <SidebarProvider className="h-full" defaultOpen={false}>
      <div
        className={cn(
          "bg-background flex h-full w-full",
          isDarkMode ? "dark" : "",
        )}
      >
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
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
          <main className="flex flex-1 flex-col items-center justify-center overflow-auto">
            {children}
          </main>
          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
