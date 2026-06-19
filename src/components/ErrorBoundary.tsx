import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
}

function ErrorFallback({ error }: ErrorFallbackProps) {
  const { t } = useTranslation();

  const handleReload = () => {
    window.location.reload();
  };

  const handleReport = () => {
    const subject = encodeURIComponent("[SmoothScroll] UI Error Report");
    const body = encodeURIComponent(
      `Error: ${error?.message ?? "Unknown error"}\n` +
        `Stack: ${error?.stack ?? "No stack trace"}\n` +
        `URL: ${window.location.href}\n` +
        `User Agent: ${navigator.userAgent}\n`
    );
    window.open(`mailto:support@smoothscroll.app?subject=${subject}&body=${body}`);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg">
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-destructive">
              {t("error_boundary.title", "Something went wrong")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "error_boundary.description",
                "An unexpected error occurred. The app will attempt to continue."
              )}
            </p>
          </div>

          {error && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                {t("error_boundary.show_details", "Show technical details")}
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleReload}>
              {t("error_boundary.reload", "Reload")}
            </Button>
            <Button variant="outline" onClick={handleReport}>
              {t("error_boundary.report", "Report")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
