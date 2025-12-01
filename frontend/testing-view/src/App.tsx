import { Badge, Button, CustomComponent, Spinner } from "@workspace/ui";
import { connect } from "@workspace/core";
import { useDarkMode } from "@workspace/ui/hooks";
import { cn } from "@workspace/ui/lib";
import { useCallback, useEffect } from "react";

function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const connectToWebSocket = useCallback(() => {
    console.time("connect to websocket");
    connect();
    console.timeEnd("connect to websocket");
  }, [connect]);

  useEffect(() => {
    connectToWebSocket();
  }, [connectToWebSocket]);

  return (
    <div
      className={cn(
        "bg-background flex h-full w-full flex-col items-center justify-center",
        isDarkMode ? "dark" : "",
      )}
    >
      <h1 className="text-foreground mb-4 text-4xl font-bold">
        It finally works!
      </h1>
      <Button className="my-4" size="lg" onClick={toggleDarkMode}>
        {isDarkMode ? "Enable Light Mode" : "Enable Dark Mode"}
      </Button>
      <CustomComponent className="my-3 mb-5" />
      <Badge variant="destructive" className="px-3 py-1 text-sm">
        <Spinner className="mr-1" />
        <span>I can&apos;t believe it&apos;s finally working</span>
        <Spinner className="ml-1" />
      </Badge>
    </div>
  );
}

export default App;
