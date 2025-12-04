import { cn } from "@workspace/ui/lib/utils";
import React from "react";

interface CustomComponentProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 *
 * @param className - The class name to apply to the component.
 * @param props - The props to apply to the component.
 * @returns
 */
const CustomComponent = ({ className, ...props }: CustomComponentProps) => {
  return (
    <div
      className={cn("text-primary text-2xl font-bold", className)}
      {...props}
    >
      This is a custom component. I made it myself.
    </div>
  );
};

export { CustomComponent };
