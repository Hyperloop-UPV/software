import { SidebarMenuButton } from "@workspace/ui/components";
import { Link } from "react-router";
import logo from "../../assets/logo.svg";

const Logo = () => (
  <Link to="/">
    <SidebarMenuButton
      size="lg"
      tooltip="Hyperloop UPV — Competition View"
      className="text-base font-bold"
    >
      <img src={logo} alt="Hyperloop UPV" className="max-h-8 max-w-8 dark:invert" />
      <span>Competition View</span>
    </SidebarMenuButton>
  </Link>
);

export default Logo;
