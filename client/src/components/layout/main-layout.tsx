'use client';

import { ReactNode } from 'react';
import { Header } from './header';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
  showHeader?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function MainLayout({ 
  children, 
  className,
  showHeader = true,
  maxWidth = 'full'
}: MainLayoutProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-none'
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {showHeader && <Header />}
      
      <main className={cn(
        "flex-1",
        showHeader && "pt-16", // Account for fixed header
        className
      )}>
        <div className={cn(
          "mx-auto px-4 sm:px-6 lg:px-8",
          maxWidthClasses[maxWidth]
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {breadcrumbs && (
            <nav className="mb-4">
              <ol className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <li key={index} className="flex items-center">
                    {index > 0 && (
                      <span className="mx-2 text-slate-500">/</span>
                    )}
                    {crumb.href ? (
                      <a 
                        href={crumb.href}
                        className="text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-slate-300">{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-50">{title}</h1>
              {description && (
                <p className="mt-2 text-slate-400">{description}</p>
              )}
            </div>
            
            {actions && (
              <div className="flex items-center space-x-3">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

export function Section({ title, description, children, className, headerActions }: SectionProps) {
  return (
    <section className={cn("py-8", className)}>
      {(title || description || headerActions) && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h2 className="text-2xl font-bold text-slate-50">{title}</h2>
              )}
              {description && (
                <p className="mt-2 text-slate-400">{description}</p>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center space-x-3">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

interface GridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Grid({ children, cols = 1, gap = 'md', className }: GridProps) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    12: 'grid-cols-12'
  };

  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12'
  };

  return (
    <div className={cn(
      "grid",
      colClasses[cols],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
}

interface StackProps {
  children: ReactNode;
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Stack({ children, spacing = 'md', className }: StackProps) {
  const spacingClasses = {
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8'
  };

  return (
    <div className={cn(spacingClasses[spacing], className)}>
      {children}
    </div>
  );
}