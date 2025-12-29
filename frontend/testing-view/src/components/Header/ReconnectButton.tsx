import { Button } from "@workspace/ui";
import { useWebSocket } from "@workspace/ui/hooks";
import { RefreshCw } from "@workspace/ui/icons";
import { useStore } from "../../store/store";

export const ReconnectButton = () => {
  const appMode = useStore((s) => s.appMode);
  const { reconnect, status } = useWebSocket(); // Get status from hook

  const isConnecting = status === "connecting";

  if (appMode !== "mock" && appMode !== "error") {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={reconnect}
      disabled={isConnecting}
      className="h-7 gap-1.5 px-2 text-xs"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isConnecting ? "animate-spin" : ""}`}
      />
      {isConnecting ? "Connecting..." : "Reconnect"}
    </Button>
  );
};
