import { logger } from "@workspace/core";
import useErrorSubscription from "@workspace/ui/hooks/webSocket/useErrorSubscription";
import { useEffect } from "react";
import { useStore } from "../store/store";

/**
 * This hook listens for global errors and unhandled promises rejections
 * and sets the app mode to "error" in global store's app slice.
 * @returns a function to manually report errors
 * * Note: returned function is supposed to be used in the ErrorBoundary component
 */
export function useErrorHandler() {
  const setError = useStore((s) => s.setError);

  useErrorSubscription((err) => {
    const isRestarting = useStore.getState().isRestarting;

    if (err instanceof CloseEvent && err.code == 1006 && isRestarting) {
      logger.testingView.warn("Restarting app...");
      return;
    }

    setError(err);
  });

  useEffect(() => {
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      logger.testingView.error("Uncaught error:", event.error);
      setError(event.error);
    };

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.testingView.error("Unhandled rejection:", event.reason);
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      setError(error);
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
  }, [setError]);

  /**
   * This functions prints the error and the error info in console using logger
   * and sets the error in global store's app slice.
   * It is designed to be used in the ErrorBoundary component.
   */
  const reportError = (error: Error, ErrorInfo?: React.ErrorInfo) => {
    logger.testingView.error(
      `Error${ErrorInfo ? ` in ${ErrorInfo}` : ""}:`,
      error,
    );
    setError(error);
  };

  return { reportError };
}
