import { logger } from "@workspace/core";
import { useEffect } from "react";
import { useStore } from "../store/store";

export function useErrorHandler() {
  const setError = useStore((s) => s.setError);
  const setAppMode = useStore((s) => s.setAppMode);

  useEffect(() => {
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      logger.testingView.error("Uncaught error:", event.error);
      setError(event.error);
      setAppMode("error");
    };

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.testingView.error("Unhandled rejection:", event.reason);
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      setError(error);
      setAppMode("error");
    };

    // Add listeners
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, [setError, setAppMode]);

  // Return a function to manually report errors
  const reportError = (error: Error, ErrorInfo?: React.ErrorInfo) => {
    logger.testingView.error(
      `Error${ErrorInfo ? ` in ${ErrorInfo}` : ""}:`,
      error,
    );
    setError(error);
    setAppMode("error");
  };

  return { reportError };
}
