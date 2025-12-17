import { cn } from "@workspace/ui/lib";
import React from "react";
import Footer from "./Footer";
import AppSidebar from "./AppSidebar";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components";
import Header from "./Header";
import { useDarkModeStore } from "@workspace/ui/store";
import { useColorSchemeStore } from "../store/useColorSchemeStore";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const isDarkMode = useDarkModeStore((s) => s.isDarkMode);
  const colorScheme = useColorSchemeStore((s) => s.colorScheme);

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
          <AppSidebar />
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
