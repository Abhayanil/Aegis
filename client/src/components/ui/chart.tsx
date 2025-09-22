import * as React from "react"
import { cn } from "@/lib/utils"

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-full h-full", className)}
      {...props}
    >
      {children}
    </div>
  )
)
ChartContainer.displayName = "ChartContainer"

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
  }
  benchmark?: {
    label: string
    value: string | number
  }
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, title, value, change, benchmark, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <div className="flex items-baseline space-x-2">
          <p className="text-2xl font-bold text-slate-50">{value}</p>
          {change && (
            <span
              className={cn(
                "text-sm font-medium",
                change.type === 'increase' && "text-green-400",
                change.type === 'decrease' && "text-red-400",
                change.type === 'neutral' && "text-slate-400"
              )}
            >
              {change.type === 'increase' && '+'}
              {change.value}%
            </span>
          )}
        </div>
        {benchmark && (
          <p className="text-xs text-slate-500">
            {benchmark.label}: {benchmark.value}
          </p>
        )}
      </div>
    </div>
  )
)
MetricCard.displayName = "MetricCard"

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  label?: string
  color?: 'blue' | 'green' | 'red' | 'amber'
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, label, color = 'blue', ...props }, ref) => {
    const percentage = Math.min((value / max) * 100, 100)
    
    const colorClasses = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      amber: 'bg-amber-500'
    }

    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {label && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-300">{value}{max === 100 ? '%' : `/${max}`}</span>
          </div>
        )}
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={cn("h-2 rounded-full transition-all duration-300", colorClasses[color])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)
ProgressBar.displayName = "ProgressBar"

export { ChartContainer, MetricCard, ProgressBar }