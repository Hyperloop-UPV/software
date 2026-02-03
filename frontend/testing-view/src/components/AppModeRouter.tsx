import { useStore } from "../store/store";
import { Error } from "./Error";
import { Loading } from "./Loading";

interface AppModeRouterProps {
  children: React.ReactNode;
}

/**
 * This component works as a router
 * and renders the appropriate page based on the app mode.
 *
 * Note: If mode is not loading or error, it renders the children normally
 */
export const AppModeRouter = ({ children }: AppModeRouterProps) => {
  const appMode = useStore((s) => s.appMode);

  // For loading mode
  if (appMode === "loading") {
    return <Loading />;
  }

  // For error mode
  if (appMode === "error") {
    return <Error />;
  }

  // For active and mock modes, render children normally
  return <>{children}</>;
};
