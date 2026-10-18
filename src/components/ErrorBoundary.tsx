import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md shadow-lg border-destructive/20">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl font-bold">Something went wrong</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                An unexpected error occurred while rendering this page.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error?.message && (
                <div className="rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground break-all max-h-32 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={this.handleReload} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" /> Reload Page
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={this.handleReset} className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Try Again
                  </Button>
                  <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                    <Home className="mr-2 h-4 w-4" /> Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
