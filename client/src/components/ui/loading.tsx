import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8'
    }

    return (
      <div
        ref={ref}
        className={cn(
          "animate-spin rounded-full border-2 border-slate-700 border-t-blue-500",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
LoadingSpinner.displayName = "LoadingSpinner"

interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const LoadingDots = React.forwardRef<HTMLDivElement, LoadingDotsProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-1 h-1',
      md: 'w-2 h-2',
      lg: 'w-3 h-3'
    }

    return (
      <div
        ref={ref}
        className={cn("flex space-x-1", className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "bg-blue-500 rounded-full animate-pulse",
              sizeClasses[size]
            )}
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
    )
  }
)
LoadingDots.displayName = "LoadingDots"

interface LoadingBarProps extends React.HTMLAttributes<HTMLDivElement> {
  progress?: number
}

const LoadingBar = React.forwardRef<HTMLDivElement, LoadingBarProps>(
  ({ className, progress, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-full bg-slate-700 rounded-full h-2", className)}
      {...props}
    >
      <div
        className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ 
          width: progress !== undefined ? `${progress}%` : '0%',
          ...(progress === undefined && {
            animation: 'loading-bar 2s ease-in-out infinite'
          })
        }}
      />
    </div>
  )
)
LoadingBar.displayName = "LoadingBar"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, lines = 1, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-700 rounded animate-pulse"
          style={{
            width: i === lines - 1 ? '75%' : '100%'
          }}
        />
      ))}
    </div>
  )
)
Skeleton.displayName = "Skeleton"

interface LoadingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: boolean
  lines?: number
}

const LoadingCard = React.forwardRef<HTMLDivElement, LoadingCardProps>(
  ({ className, title = true, lines = 3, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-slate-700 bg-slate-800/50 p-6 space-y-4",
        className
      )}
      {...props}
    >
      {title && (
        <div className="h-6 bg-slate-700 rounded animate-pulse w-1/3" />
      )}
      <Skeleton lines={lines} />
    </div>
  )
)
LoadingCard.displayName = "LoadingCard"

export { LoadingSpinner, LoadingDots, LoadingBar, Skeleton, LoadingCard }