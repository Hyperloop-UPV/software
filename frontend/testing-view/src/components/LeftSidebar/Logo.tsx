import { SidebarMenuButton } from "@workspace/ui";
import { Link } from "react-router";
import logo from "../../assets/logo.svg";

const Logo = () => {
  return (
    <Link to="/">
      <SidebarMenuButton
        size="lg"
        tooltip="Hyperloop UPV H11"
        className="text-base font-bold"
      >
        <img src={logo} alt="Logo" className="max-h-8 max-w-8" />
        <span>Hyperloop UPV H11</span>
      </SidebarMenuButton>
    </Link>
  );
};

export default Logo;
