import { Badge, CustomComponent, Spinner } from "@workspace/ui";
import { connect } from "@workspace/core";
import { useCallback, useEffect } from "react";
import { useTabStore } from "@workspace/ui/store";

export const Testing = () => {
  const { activeTab } = useTabStore();

  const connectToWebSocket = useCallback(() => {
    console.time("[TEST] connect to websocket");
    connect();
    console.timeEnd("[TEST] connect to websocket");
  }, []);

  useEffect(() => {
    connectToWebSocket();
  }, [connectToWebSocket]);

  if (!activeTab) {
    return <p>No active tab</p>;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <h2 className="text-foreground text-2xl font-bold">{activeTab.name}</h2>
      <Badge variant="destructive" className="py-xs px-sm text-sm">
        <Spinner className="mr-xs" />
        <span>{activeTab.description}</span>
        <Spinner className="ml-xs" />
      </Badge>
    </div>
  );
};
