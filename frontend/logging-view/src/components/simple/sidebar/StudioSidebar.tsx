// VS Code-style studio panel: a persistent activity bar (icon strip) on the
// right edge; clicking an icon opens that section in a panel next to it,
// clicking the active icon again closes the panel.
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@hyperloop-upv/frontend-kit/components";
import { cn } from "@hyperloop-upv/frontend-kit/lib";
import { STUDIO_SECTIONS } from "./studioSections";

interface StudioSidebarProps {
  /** Id of the open section, or null when the panel is closed. */
  activeSection: string | null;
  /** Called with the clicked section id (parent handles toggle semantics). */
  onSelect: (id: string) => void;
}

export default function StudioSidebar({ activeSection, onSelect }: StudioSidebarProps) {
  const active = STUDIO_SECTIONS.find((s) => s.id === activeSection) ?? null;
  const ActiveIcon = active?.icon;
  const ActiveComponent = active?.Component;

  return (
    <div className="flex h-full shrink-0">
      {/* Panel — shows the single active section */}
      <div
        className={cn(
          "bg-sidebar overflow-hidden border-l transition-all duration-200",
          active ? "w-64" : "w-0",
        )}
      >
        {active && ActiveIcon && ActiveComponent && (
          // Fixed inner width so content doesn't reflow during the transition
          <div className="flex h-full w-64 flex-col">
            {/* Panel header — aligns with the main toolbar height */}
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <ActiveIcon className="text-primary size-3.5 shrink-0" />
              <span className="text-foreground truncate text-[11px] font-semibold uppercase tracking-widest">
                {active.title}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <ActiveComponent />
            </div>
          </div>
        )}
      </div>

      {/* Activity bar — always visible */}
      <div className="bg-sidebar flex w-12 shrink-0 flex-col items-center gap-1 border-l py-2">
        {STUDIO_SECTIONS.map(({ id, icon: Icon, title }) => {
          const isActive = id === activeSection;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelect(id)}
                  aria-label={title}
                  className={cn(
                    "relative",
                    isActive
                      ? "bg-primary/10 text-primary hover:text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {/* Active indicator on the panel-facing edge */}
                  {isActive && (
                    <span className="bg-primary absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full" />
                  )}
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{title}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
