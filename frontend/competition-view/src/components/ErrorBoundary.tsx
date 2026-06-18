import { Button, Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components";
import { AlertTriangle } from "@workspace/ui/icons";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Heading shown in the fallback card. Defaults to "Something went wrong". */
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches render-time errors in its subtree and
 * displays a recoverable fallback card instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary title="Charts failed to load">
 *     <Charts />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5 shrink-0" />
              {this.props.title ?? "Something went wrong"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {this.state.error && (
              <pre className="bg-muted text-muted-foreground max-h-32 overflow-auto rounded-lg p-3 text-xs leading-relaxed">
                {this.state.error.message}
              </pre>
            )}
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
