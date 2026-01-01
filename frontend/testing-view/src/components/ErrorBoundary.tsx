import { logger } from "@workspace/core";
import React, { Component, type ReactNode } from "react";
import { Error } from "./Error";

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack?: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: error.stack };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.testingView.error(
      "React Error Boundary caught error:",
      error,
      errorInfo,
    );

    this.setState({ componentStack: errorInfo.componentStack });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Error
          error={this.state.error}
          componentStack={this.state.componentStack}
        />
      );
    }

    return this.props.children;
  }
}
