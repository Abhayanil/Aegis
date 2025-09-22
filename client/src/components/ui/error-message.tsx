'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorMessage({ title, message, actionLabel, onAction }: ErrorMessageProps) {
  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-danger-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-danger-400" />
      </div>
      
      <h2 className="text-xl font-semibold text-primary-100 mb-2">
        {title}
      </h2>
      
      <p className="text-primary-400 mb-6">
        {message}
      </p>
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-primary flex items-center space-x-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}