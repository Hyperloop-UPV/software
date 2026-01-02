import { useStore } from "../store/store";
import { Error } from "./Error";
import { Loading } from "./Loading";

interface AppModeRouterProps {
  children: React.ReactNode;
}

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
