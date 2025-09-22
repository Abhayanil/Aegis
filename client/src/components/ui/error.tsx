'use client';

import * as React from "react"
import { AlertTriangleIcon, XIcon } from "./icons"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { cn } from "@/lib/utils"

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent 
          error={this.state.error!} 
          resetError={this.resetError} 
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangleIcon size={20} />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-400">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-400">
              Error details
            </summary>
            <pre className="mt-2 p-2 bg-slate-900 rounded text-xs text-red-400 overflow-auto">
              {error.message}
            </pre>
          </details>
          
          <div className="flex gap-2">
            <Button onClick={resetError} className="flex-1">
              Try again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              Reload page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ErrorAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  variant?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
}

const ErrorAlert = React.forwardRef<HTMLDivElement, ErrorAlertProps>(
  ({ 
    className, 
    title, 
    message, 
    variant = 'error', 
    dismissible = false,
    onDismiss,
    ...props 
  }, ref) => {
    const variantStyles = {
      error: 'border-red-500/20 bg-red-500/10 text-red-400',
      warning: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
      info: 'border-blue-500/20 bg-blue-500/10 text-blue-400'
    };

    const iconColor = {
      error: 'text-red-400',
      warning: 'text-amber-400',
      info: 'text-blue-400'
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border p-4",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          <AlertTriangleIcon size={20} className={cn("mt-0.5 flex-shrink-0", iconColor[variant])} />
          
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className="font-semibold mb-1">{title}</h4>
            )}
            <p className="text-sm leading-relaxed">{message}</p>
          </div>
          
          {dismissible && onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }
)
ErrorAlert.displayName = "ErrorAlert"

interface ErrorPageProps {
  title?: string;
  message?: string;
  statusCode?: number;
  showRetry?: boolean;
  onRetry?: () => void;
}

function ErrorPage({ 
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again later.",
  statusCode,
  showRetry = true,
  onRetry
}: ErrorPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangleIcon size={32} className="text-red-400" />
          </div>
          
          {statusCode && (
            <div className="text-6xl font-bold text-slate-600 mb-2">
              {statusCode}
            </div>
          )}
          
          <h1 className="text-2xl font-bold text-slate-50 mb-2">
            {title}
          </h1>
          
          <p className="text-slate-400 leading-relaxed">
            {message}
          </p>
        </div>
        
        <div className="space-y-3">
          {showRetry && (
            <Button 
              onClick={onRetry || (() => window.location.reload())}
              className="w-full"
            >
              Try again
            </Button>
          )}
          
          <Button 
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full"
          >
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}

interface NetworkErrorProps {
  onRetry?: () => void;
}

function NetworkError({ onRetry }: NetworkErrorProps) {
  return (
    <ErrorAlert
      variant="error"
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      dismissible={false}
    />
  );
}

interface ValidationErrorProps {
  errors: string[];
  onDismiss?: () => void;
}

function ValidationError({ errors, onDismiss }: ValidationErrorProps) {
  return (
    <ErrorAlert
      variant="warning"
      title="Validation Error"
      message={errors.length === 1 ? errors[0] : `${errors.length} validation errors occurred`}
      dismissible={!!onDismiss}
      onDismiss={onDismiss}
    />
  );
}

export { 
  ErrorAlert, 
  ErrorPage, 
  NetworkError, 
  ValidationError,
  DefaultErrorFallback 
}