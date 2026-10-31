import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
  isInteractive?: boolean;
  accentBorder?: 'teal' | 'cyan' | 'amber' | 'crimson' | 'indigo';
}

export function Card({
  className,
  variant = 'default',
  isInteractive = false,
  accentBorder,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-xl border transition-all duration-150 relative overflow-hidden',
          {
            'bg-midnight-900 border-midnight-700': variant === 'default',
            'bg-midnight-850 border-midnight-600 shadow-lg': variant === 'elevated',
            'bg-midnight-900/80 backdrop-blur-md border-midnight-700/80': variant === 'glass',
            'hover:border-tactical-cyan/40 hover:shadow-glow-cyan': isInteractive,
          },
          {
            'border-t-2 border-t-tactical-teal': accentBorder === 'teal',
            'border-t-2 border-t-tactical-cyan': accentBorder === 'cyan',
            'border-t-2 border-t-tactical-amber': accentBorder === 'amber',
            'border-t-2 border-t-tactical-crimson': accentBorder === 'crimson',
            'border-t-2 border-t-tactical-indigo': accentBorder === 'indigo',
          },
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  headerIcon?: React.ReactNode;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export function CardHeader({
  className,
  headerIcon,
  subtitle,
  headerAction,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={twMerge(
        'px-6 py-4 border-b border-midnight-700 flex items-center justify-between gap-4',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {headerIcon && (
          <div className="shrink-0 text-tactical-teal">
            {headerIcon}
          </div>
        )}
        <div className="min-w-0">
          {children}
          {subtitle && (
            <p className="text-xs text-midnight-400 mt-0.5 truncate font-sans">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {headerAction && (
        <div className="shrink-0 flex items-center gap-2">
          {headerAction}
        </div>
      )}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge('text-sm font-semibold tracking-wider text-midnight-100 uppercase font-display', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge('p-6', className)} {...props}>
      {children}
    </div>
  );
}
