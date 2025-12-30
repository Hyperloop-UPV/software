import { logger } from "@workspace/core";
import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.testingView.error(
      "React Error Boundary caught error:",
      error,
      errorInfo,
    );

    // Call the onError prop if provided
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Let the AppModeRouter handle the error display
      return this.props.children;
    }

    return this.props.children;
  }
}
