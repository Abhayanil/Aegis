# UI Design Guidelines for Aegis Platform

## User Persona & Core Needs

**Primary User**: Michael Chen, Senior Associate at a VC Firm
- **Goal**: Quickly screen 20+ deals a week to find the 2-3 worth deep diving into
- **Pain Points**: Drowning in PDFs, wasted time on poorly-fitting deals, inconsistent memo formatting, missing subtle red flags
- **Core Needs**:
  - **Speed**: A verdict in minutes, not hours
  - **Clarity**: Immediately see the top-line score, upside, and risks
  - **Trust**: Understand why the AI reached its conclusion
  - **Actionability**: Get data to feed into a partnership discussion or a CRM

## Design Principles

### 1. Progressive Disclosure
Start with a high-level score and one-liner. Let the user drill down into details only if they are interested.

### 2. Data Density, Not Clutter
Present a lot of information in a scannable, organized way. Use typography, color, and spacing to create hierarchy.

### 3. Objective Tone
The UI should feel analytical and neutral, not salesy. Red flags should be just as prominent as strengths.

### 4. "At-a-Glance" Understanding
The user should be able to form a hypothesis about the startup within 10 seconds of the page loading.

## Visual Design System

### Aesthetic
"Confidential Analyst Notebook" - Think Bloomberg Terminal, not Instagram.

### Color Palette
- **Primary**: Dark charcoal (#1a1a1a), dark blue/navy (#0f172a) for backgrounds (reduces eye strain)
- **Data Colors**: Electric blue (#3b82f6), green (#10b981) for key metrics and scores
- **Alert Colors**: 
  - Amber (#f59e0b) for medium-risk
  - Red (#ef4444) for high-risk
  - Used sparingly for maximum impact
- **Text**: 
  - Primary text: #f8fafc (light gray)
  - Secondary text: #94a3b8 (muted gray)
  - Accent text: #e2e8f0 (medium gray)

### Typography
- **Primary**: Inter or SF Pro Display (highly legible, professional sans-serif)
- **Monospace**: JetBrains Mono or SF Mono for data/code snippets
- **Hierarchy**:
  - H1: 2.25rem (36px), font-weight: 700
  - H2: 1.875rem (30px), font-weight: 600
  - H3: 1.5rem (24px), font-weight: 600
  - Body: 1rem (16px), font-weight: 400
  - Small: 0.875rem (14px), font-weight: 400

### Data Visualization
- Clean, minimalist bar charts and progress circles
- No unnecessary 3D effects or decorations
- Use consistent color coding across all charts
- Emphasize comparison between company metrics and benchmarks

## Component Guidelines

### Signal Score Display
- Large, bold score (8.5/10 format)
- Color-coded backgrounds:
  - Green (8-10): Excellent
  - Yellow (5-7.9): Moderate
  - Red (<5): Poor
- Prominent placement in header

### Recommendation Badges
- Clear, actionable labels: "STRONG MEET", "MEET", "WEAK PASS", "PASS"
- Consistent styling with signal score colors
- High contrast for readability

### Metric Cards
- Company value vs. sector benchmark format
- Visual indicators (arrows, bars) for performance comparison
- Consistent card layout with clear hierarchy
- Hover states for additional context

### Risk Assessment Matrix
- Categorized by type (Team, Market, Product, Metrics)
- Prioritized by severity (High, Medium, Low)
- High priority risks expanded by default
- Clickable source references (page numbers, timestamps)

### Interactive Elements
- Real-time weighting sliders with immediate feedback
- Smooth transitions and animations (200-300ms)
- Clear hover and active states
- Accessible keyboard navigation

## Layout Structure

### Main Interface Layout
```
┌─────────────────────────────────────────────────────────┐
│ Header Zone (Company Info + Signal Score)               │
├─────────────────────────────────┬───────────────────────┤
│                                 │ Sticky Sidebar       │
│ Main Scrolling Content          │ - Document Hub       │
│ - Top Action Bar                │ - Weighting Sliders  │
│ - Key Metrics Dashboard         │                       │
│ - Growth Potential Summary      │                       │
│ - Risk Assessment Matrix        │                       │
│ - Investment Recommendation     │                       │
│                                 │                       │
└─────────────────────────────────┴───────────────────────┘
```

### Responsive Breakpoints
- Desktop: 1280px+ (primary target)
- Tablet: 768px - 1279px (secondary)
- Mobile: <768px (minimal support, redirect to desktop)

## User Flow Guidelines

### Primary Flow: "Quick Analysis"
1. **Landing Page**: Large drag-and-drop zone with clear CTA
2. **Processing State**: Transparent progress with detailed steps
3. **Results Interface**: Complete deal memo with progressive disclosure

### Processing State Transparency
Show detailed steps to build trust:
- "Processing PDF..."
- "Extracting data..."
- "Analyzing with Gemini..."
- "Benchmarking..."
- "Generating recommendations..."

### Document Integration
- Clickable source references that jump to specific pages/timestamps
- Side-by-side document viewer with highlighted quotes
- Thumbnail previews of all uploaded documents

## Accessibility Standards

### WCAG 2.1 AA Compliance
- Minimum contrast ratio of 4.5:1 for normal text
- Minimum contrast ratio of 3:1 for large text
- Keyboard navigation support for all interactive elements
- Screen reader compatibility with proper ARIA labels

### Keyboard Navigation
- Tab order follows logical flow
- Escape key closes modals and overlays
- Enter/Space activates buttons and controls
- Arrow keys navigate within component groups

## Performance Guidelines

### Loading States
- Skeleton screens for content loading
- Progressive image loading for document thumbnails
- Optimistic UI updates for slider interactions

### Animation Guidelines
- Use CSS transforms for smooth animations
- Keep animations under 300ms for responsiveness
- Provide reduced motion options for accessibility
- Use easing functions: ease-out for entrances, ease-in for exits

## Technical Implementation Notes

### Framework Preferences
- **React 18+** with TypeScript for type safety
- **Next.js 14+** for SSR and routing
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **Recharts** or **Chart.js** for data visualization

### State Management
- **Zustand** or **React Context** for global state
- **React Query** for server state management
- **React Hook Form** for form handling

### Code Organization
```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   ├── charts/       # Data visualization components
│   ├── layout/       # Layout components
│   └── features/     # Feature-specific components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions and API clients
├── styles/           # Global styles and Tailwind config
└── types/            # TypeScript type definitions
```

## Quality Assurance

### Testing Strategy
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: Playwright for E2E testing
- **Visual Regression**: Chromatic or Percy
- **Accessibility**: axe-core automated testing

### Browser Support
- Chrome 90+ (primary)
- Firefox 88+ (secondary)
- Safari 14+ (secondary)
- Edge 90+ (secondary)

## Content Guidelines

### Tone of Voice
- Professional and analytical
- Concise and data-driven
- Neutral, not promotional
- Transparent about AI reasoning

### Error Messages
- Clear, actionable error descriptions
- Suggest specific next steps
- Avoid technical jargon
- Provide contact information for support

### Loading Messages
- Specific progress indicators
- Estimated time remaining when possible
- Context about what's happening
- Option to cancel long-running operations

## Future Considerations

### Scalability
- Component library for consistency across features
- Design tokens for easy theme updates
- Modular architecture for feature additions
- Performance monitoring and optimization

### Internationalization
- Support for multiple languages (future)
- RTL layout support (future)
- Currency and number formatting
- Date/time localization