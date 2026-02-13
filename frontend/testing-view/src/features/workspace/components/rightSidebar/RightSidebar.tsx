import { RightSidebarHeader } from "./RightSidebarHeader";
import { RightSidebarContent } from "./RightSidebarContent";

interface RightSidebarProps {
  onClose: () => void;
}

export const RightSidebar = ({ onClose }: RightSidebarProps) => {
  return (
    <div className="bg-background flex h-full flex-col border-l">
      <RightSidebarHeader onClose={onClose} />
      <RightSidebarContent />
    </div>
  );
};
