import { cn } from "@workspace/ui/lib/utils";
import React from "react";

interface CustomComponentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CustomComponent = ({ className, ...props }: CustomComponentProps) => {
  return (
    <div
      className={cn("text-2xl font-bold text-red-500", className)}
      {...props}
    >
      CustomComponent
    </div>
  );
};

export default CustomComponent;
