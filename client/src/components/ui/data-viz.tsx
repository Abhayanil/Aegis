import * as React from "react"
import { cn } from "@/lib/utils"

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: 'blue' | 'green' | 'red' | 'amber'
  showValue?: boolean
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ 
    className, 
    value, 
    max = 100, 
    size = 120, 
    strokeWidth = 8, 
    color = 'blue',
    showValue = true,
    ...props 
  }, ref) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const percentage = Math.min((value / max) * 100, 100)
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
    
    const colorClasses = {
      blue: 'stroke-blue-500',
      green: 'stroke-green-500',
      red: 'stroke-red-500',
      amber: 'stroke-amber-500'
    }

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className={cn("transition-all duration-500 ease-out", colorClasses[color])}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-slate-50">
              {Math.round(percentage)}
            </span>
          </div>
        )}
      </div>
    )
  }
)
CircularProgress.displayName = "CircularProgress"

interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Array<{
    label: string
    value: number
    color?: string
  }>
  maxValue?: number
  height?: number
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  ({ className, data, maxValue, height = 200, ...props }, ref) => {
    const max = maxValue || Math.max(...data.map(d => d.value))
    
    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        style={{ height }}
        {...props}
      >
        <div className="flex items-end justify-between h-full space-x-2">
          {data.map((item, index) => {
            const barHeight = (item.value / max) * (height - 40) // Leave space for labels
            const barColor = item.color || 'bg-blue-500'
            
            return (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="flex flex-col items-center justify-end h-full">
                  <div className="text-xs text-slate-400 mb-1">
                    {item.value}
                  </div>
                  <div
                    className={cn("w-full rounded-t transition-all duration-500", barColor)}
                    style={{ height: barHeight }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-2 text-center">
                  {item.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
BarChart.displayName = "BarChart"

interface TrendLineProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Array<{
    label: string
    value: number
  }>
  color?: 'blue' | 'green' | 'red' | 'amber'
  height?: number
}

const TrendLine = React.forwardRef<HTMLDivElement, TrendLineProps>(
  ({ className, data, color = 'blue', height = 100, ...props }, ref) => {
    if (data.length < 2) return null
    
    const max = Math.max(...data.map(d => d.value))
    const min = Math.min(...data.map(d => d.value))
    const range = max - min || 1
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((item.value - min) / range) * 100
      return `${x},${y}`
    }).join(' ')
    
    const colorClasses = {
      blue: 'stroke-blue-500',
      green: 'stroke-green-500',
      red: 'stroke-red-500',
      amber: 'stroke-amber-500'
    }

    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        style={{ height }}
        {...props}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points={points}
            className={cn("transition-all duration-500", colorClasses[color])}
          />
          {/* Data points */}
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100
            const y = 100 - ((item.value - min) / range) * 100
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1.5"
                fill="currentColor"
                className={colorClasses[color]}
              />
            )
          })}
        </svg>
      </div>
    )
  }
)
TrendLine.displayName = "TrendLine"

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Array<{
    label: string
    value: number
    color: string
  }>
  size?: number
  innerRadius?: number
  showLabels?: boolean
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  ({ 
    className, 
    data, 
    size = 200, 
    innerRadius = 60,
    showLabels = true,
    ...props 
  }, ref) => {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    const radius = (size - 20) / 2 // Leave some padding
    const center = size / 2
    
    let cumulativePercentage = 0
    
    const segments = data.map((item) => {
      const percentage = (item.value / total) * 100
      const startAngle = (cumulativePercentage / 100) * 360 - 90
      const endAngle = ((cumulativePercentage + percentage) / 100) * 360 - 90
      
      const startAngleRad = (startAngle * Math.PI) / 180
      const endAngleRad = (endAngle * Math.PI) / 180
      
      const largeArcFlag = percentage > 50 ? 1 : 0
      
      const x1 = center + radius * Math.cos(startAngleRad)
      const y1 = center + radius * Math.sin(startAngleRad)
      const x2 = center + radius * Math.cos(endAngleRad)
      const y2 = center + radius * Math.sin(endAngleRad)
      
      const x3 = center + innerRadius * Math.cos(startAngleRad)
      const y3 = center + innerRadius * Math.sin(startAngleRad)
      const x4 = center + innerRadius * Math.cos(endAngleRad)
      const y4 = center + innerRadius * Math.sin(endAngleRad)
      
      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x4} ${y4}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x3} ${y3}`,
        'Z'
      ].join(' ')
      
      cumulativePercentage += percentage
      
      return {
        ...item,
        pathData,
        percentage: Math.round(percentage)
      }
    })

    return (
      <div
        ref={ref}
        className={cn("relative", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg width={size} height={size}>
          {segments.map((segment, index) => (
            <path
              key={index}
              d={segment.pathData}
              fill={segment.color}
              className="transition-all duration-300 hover:opacity-80"
            />
          ))}
        </svg>
        
        {showLabels && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-50">{total}</div>
              <div className="text-sm text-slate-400">Total</div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
DonutChart.displayName = "DonutChart"

export { CircularProgress, BarChart, TrendLine, DonutChart }