import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'default'
  | 'teal'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'crimson'
  | 'indigo'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-mono font-medium rounded-full tracking-wide',
          {
            'px-2 py-0.5 text-xs': size === 'sm',
            'px-2.5 py-1 text-xs': size === 'md',
          },
          {
            'bg-midnight-700 text-midnight-300 border border-midnight-600': variant === 'default',
            'bg-tactical-teal/10 text-tactical-teal border border-tactical-teal/30': variant === 'teal',
            'bg-tactical-cyan/10 text-tactical-cyan border border-tactical-cyan/30': variant === 'cyan',
            'bg-tactical-emerald/10 text-tactical-emerald border border-tactical-emerald/30': variant === 'emerald',
            'bg-tactical-amber/10 text-tactical-amber border border-tactical-amber/30': variant === 'amber',
            'bg-tactical-crimson/10 text-tactical-crimson border border-tactical-crimson/30': variant === 'crimson',
            'bg-tactical-indigo/10 text-tactical-indigo border border-tactical-indigo/30': variant === 'indigo',
            'bg-transparent text-midnight-400 border border-midnight-700': variant === 'outline',
          },
          className
        )
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2 mr-1.5" aria-hidden="true">
          <span
            className={clsx(
              'motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              {
                'bg-tactical-emerald': variant === 'emerald',
                'bg-tactical-teal': variant === 'teal',
                'bg-tactical-cyan': variant === 'cyan',
                'bg-tactical-amber': variant === 'amber',
                'bg-tactical-crimson': variant === 'crimson',
                'bg-tactical-indigo': variant === 'indigo',
                'bg-midnight-400': variant === 'default' || variant === 'outline',
              }
            )}
          />
          <span
            className={clsx('relative inline-flex rounded-full h-2 w-2', {
              'bg-tactical-emerald': variant === 'emerald',
              'bg-tactical-teal': variant === 'teal',
              'bg-tactical-cyan': variant === 'cyan',
              'bg-tactical-amber': variant === 'amber',
              'bg-tactical-crimson': variant === 'crimson',
              'bg-tactical-indigo': variant === 'indigo',
              'bg-midnight-400': variant === 'default' || variant === 'outline',
            })}
          />
        </span>
      )}
      {children}
    </span>
  );
}
