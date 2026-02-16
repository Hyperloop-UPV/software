import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui";
import type { ReactNode } from "react";

interface RightSidebarToggleProps {
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  variant?: "default" | "ghost" | "secondary";
}

export const RightSidebarToggle = ({
  isActive,
  onClick,
  icon,
  label,
  disabled,
  variant = "secondary",
}: RightSidebarToggleProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={onClick}
          size="icon"
          variant={isActive ? "default" : variant}
          className="h-7 w-7"
          aria-label={label}
          disabled={disabled}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
