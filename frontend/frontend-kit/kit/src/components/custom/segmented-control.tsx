// Generic segmented control (tab-style toggle) shared across all views.
// Renders a sliding indicator that animates to the active option.
// All options are rendered at equal width; pass icon for icon+label segments.
//
// Layout note: no horizontal padding on the container — the indicator is sized
// as a percentage of the container so that translateX(100%) moves it by exactly
// one segment width. Adding horizontal padding would break that alignment because
// translateX % is relative to the element's own width, not the parent.
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface Option<T extends string> {
  label: string;
  value: T;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) => {
  const activeIndex = options.findIndex((o) => o.value === value);
  const segmentWidth = 100 / options.length;

  return (
    // Outer div provides the background and visual side padding.
    // The indicator lives in the inner div (no horizontal padding) so that
    // width/translateX percentages stay correct — they reference that inner width.
    <div
      role="group"
      className={cn("bg-muted rounded-lg px-1 py-0.5", className)}
    >
      <div className="relative flex items-center">
        {/* Sliding background indicator — vertical inset only */}
        <div
          aria-hidden
          className="bg-background absolute top-0.5 bottom-0.5 rounded-md shadow-sm transition-transform duration-200 ease-in-out"
          style={{
            width: `${segmentWidth}%`,
            transform: `translateX(${100 * activeIndex}%)`,
          }}
        />

        {options.map((option) => {
          const active = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => !active && onChange(option.value)}
              aria-pressed={active}
              style={{ width: `${segmentWidth}%` }}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150",
                active
                  ? "text-foreground cursor-default"
                  : "text-muted-foreground hover:text-foreground cursor-pointer",
              )}
            >
              {Icon && <Icon className="size-3.5 shrink-0" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { SegmentedControl };
