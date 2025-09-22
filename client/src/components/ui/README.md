# UI Components

This directory contains reusable UI components for the Aegis platform, following the design system guidelines.

## Design System

### Color Palette
- **Primary**: Dark charcoal (#1a1a1a), dark blue/navy (#0f172a) for backgrounds
- **Data Colors**: Electric blue (#3b82f6), green (#10b981) for key metrics and scores
- **Alert Colors**: 
  - Amber (#f59e0b) for medium-risk
  - Red (#ef4444) for high-risk
- **Text**: 
  - Primary text: #f8fafc (light gray)
  - Secondary text: #94a3b8 (muted gray)
  - Accent text: #e2e8f0 (medium gray)

### Typography
- **Primary**: Inter or SF Pro Display
- **Monospace**: JetBrains Mono or SF Mono for data/code snippets

## Component Categories

### Base Components
- `button.tsx` - Button component with variants
- `card.tsx` - Card container components
- `badge.tsx` - Status and label badges
- `separator.tsx` - Visual separators

### Form Components
- `slider.tsx` - Range input sliders
- `tabs.tsx` - Tab navigation
- `tooltip.tsx` - Hover tooltips

### Feedback Components
- `progress.tsx` - Progress indicators
- `loading.tsx` - Loading states and spinners
- `error.tsx` - Error boundaries and alerts

### Data Visualization
- `chart.tsx` - Basic chart components
- `data-viz.tsx` - Advanced data visualization components
- `icons.tsx` - Custom icon library

### Layout Components
- `main-layout.tsx` - Application layout wrapper
- Various layout utilities

## Usage Examples

### Basic Card
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Deal Analysis</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Content goes here</p>
  </CardContent>
</Card>
```

### Progress Indicator
```tsx
import { ProgressBar } from '@/components/ui/chart';

<ProgressBar 
  value={75} 
  color="green"
  label="75th percentile"
/>
```

### Loading States
```tsx
import { LoadingSpinner, LoadingCard } from '@/components/ui/loading';

// Spinner
<LoadingSpinner size="md" />

// Card skeleton
<LoadingCard title lines={3} />
```

### Data Visualization
```tsx
import { CircularProgress, BarChart } from '@/components/ui/data-viz';

// Circular progress
<CircularProgress value={8.5} max={10} color="green" />

// Bar chart
<BarChart 
  data={[
    { label: 'Q1', value: 100, color: 'bg-blue-500' },
    { label: 'Q2', value: 150, color: 'bg-green-500' }
  ]}
/>
```

### Error Handling
```tsx
import { ErrorBoundary, ErrorAlert } from '@/components/ui/error';

// Error boundary
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// Error alert
<ErrorAlert 
  variant="error"
  title="Upload Failed"
  message="Please try again"
  dismissible
  onDismiss={() => {}}
/>
```

## Styling Guidelines

### Consistent Spacing
- Use Tailwind's spacing scale (4, 6, 8, 12, 16, 24)
- Maintain consistent padding and margins

### Color Usage
- Use semantic color names (success, warning, danger)
- Maintain proper contrast ratios (4.5:1 minimum)
- Use opacity for subtle variations

### Animation
- Keep animations under 300ms for responsiveness
- Use easing functions: ease-out for entrances, ease-in for exits
- Provide reduced motion options

### Accessibility
- Include proper ARIA labels
- Support keyboard navigation
- Maintain focus indicators
- Screen reader compatibility

## Component Development

### Creating New Components
1. Follow the existing naming convention
2. Use React.forwardRef for DOM components
3. Include proper TypeScript types
4. Add className prop for customization
5. Use cn() utility for class merging

### Example Template
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "base-styles",
        variant === 'secondary' && "secondary-styles",
        size === 'lg' && "large-styles",
        className
      )}
      {...props}
    />
  )
)
MyComponent.displayName = "MyComponent"

export { MyComponent }
```

## Testing

### Component Testing
- Test all variants and sizes
- Verify accessibility features
- Test keyboard navigation
- Validate responsive behavior

### Visual Testing
- Use Storybook for component documentation
- Test in different browsers
- Verify dark theme compatibility
- Check mobile responsiveness

## Performance

### Optimization Tips
- Use React.memo for expensive components
- Implement proper key props for lists
- Lazy load heavy components
- Optimize SVG icons

### Bundle Size
- Tree-shake unused components
- Use dynamic imports for large components
- Monitor bundle size impact

## Contributing

1. Follow the existing patterns
2. Add proper TypeScript types
3. Include accessibility features
4. Test thoroughly
5. Update documentation