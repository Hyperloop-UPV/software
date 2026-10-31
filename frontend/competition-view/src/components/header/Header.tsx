import { Separator, SidebarTrigger } from "@hyperloop-upv/frontend-kit/components";
import { useLocation } from "react-router";
import { BOARDS } from "../../constants/measurements";
import { PAGES } from "../../constants/pages";
import useConnections from "../../hooks/useConnections";
import ConnectionBadge from "./ConnectionBadge";
import DashboardStatusBar from "./DashboardStatusBar";
import HvalIndicator from "./HvalIndicator";
import OrdersSheet from "./OrdersSheet";

interface HeaderProps {
  backendConnected: boolean;
}

const Header = ({ backendConnected }: HeaderProps) => {
  const location = useLocation();
  const page = PAGES[location.pathname as keyof typeof PAGES];
  const pageTitle = page?.title ?? "Competition View";

  const connections = useConnections();
  const vcuConnected = connections[BOARDS.VCU]?.isConnected ?? false;

  return (
    <header className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="text-foreground -ml-1" />
        <Separator orientation="vertical" className="text-foreground mx-1 data-[orientation=vertical]:h-5" />
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-xl font-bold leading-tight">{pageTitle}</h1>
          <p className="text-muted-foreground truncate text-xs font-medium leading-tight">Hyperloop UPV</p>
        </div>
        <HvalIndicator />
      </div>

      <DashboardStatusBar />

      <div className="flex items-center gap-2 justify-self-end">
        <ConnectionBadge label="Backend" connected={backendConnected} />
        <ConnectionBadge label="Vehicle" connected={vcuConnected} />
        <OrdersSheet />
      </div>
    </header>
  );
};

export default Header;
