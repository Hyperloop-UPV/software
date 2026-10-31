// Sidebar toggle handle — click to open/close the sidebar.
import { useSidebar } from "@hyperloop-upv/frontend-kit/components";
import { ChevronLeft, ChevronRight } from "@hyperloop-upv/frontend-kit/icons";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { useState } from "react";

const SidebarToggleHandle = () => {
  const { toggleSidebar, state } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const isOpen = state === "expanded";

  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      data-sidebar="toggle-handle"
      tabIndex={-1}
      onClick={toggleSidebar}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-6 -translate-x-1/2 sm:flex",
        "group-data-[side=left]:-right-6 group-data-[side=right]:left-0",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-3",
        "flex-col items-center justify-center",
        "cursor-pointer border-0 bg-transparent p-0 outline-none",
      )}
    >
      {/* Vertical line */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-all duration-150",
          hovered ? "w-0.5 bg-primary/50" : "w-px bg-border",
        )}
      />

      {/* Icon badge.
          OPEN  → single ‹  : tells the user "click to close"
          CLOSED → ‹ ›       : the badge sits on the viewport edge so only its
                               right half is visible; the user sees only ›,
                               which reads as "click to open". The ‹ on the
                               left is hidden behind the screen boundary. */}
      <div
        className={cn(
          "relative z-10 flex items-center rounded-md p-1",
          "border bg-sidebar shadow-md transition-colors duration-150",
          hovered ? "border-primary/40" : "border-border/60",
        )}
      >
        <ChevronLeft
          className={cn(
            "size-6 transition-colors duration-150",
            hovered ? "text-primary/70" : "text-muted-foreground/40",
          )}
        />
        {!isOpen && (
          <ChevronRight
            className={cn(
              "-ml-3 size-6 transition-colors duration-150",
              hovered ? "text-primary/70" : "text-muted-foreground/40",
            )}
          />
        )}
      </div>
    </button>
  );
};

export default SidebarToggleHandle;
