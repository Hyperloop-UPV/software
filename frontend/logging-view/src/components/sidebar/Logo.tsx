import { SidebarMenuButton } from "@hyperloopupv/frontend-kit/components";
import { Link } from "react-router";
import logo from "@hyperloopupv/frontend-kit/outreach/main/logo_icon.svg";

const Logo = () => (
  <Link to="/">
    <SidebarMenuButton
      size="lg"
      tooltip="Hyperloop UPV — Logging View"
      className="text-base font-bold"
    >
      <span className="size-8 shrink-0 overflow-hidden">
        <img src={logo} alt="Hyperloop UPV" className="size-full scale-[2.045] dark:invert" />
      </span>
      <span>Logging View</span>
    </SidebarMenuButton>
  </Link>
);

export default Logo;
