import { SidebarMenuButton } from "@workspace/ui/components";
import { Link } from "react-router";

const Logo = () => (
  <Link to="/">
    <SidebarMenuButton
      size="lg"
      tooltip="Hyperloop UPV — Competition View"
      className="text-base font-bold"
    >
      <span className="text-primary text-xl font-black">H</span>
      <span>Competition View</span>
    </SidebarMenuButton>
  </Link>
);

export default Logo;
