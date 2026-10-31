import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-teal/50 focus-visible:ring-offset-2 focus-visible:ring-offset-midnight-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          {
            'px-3 py-1.5 text-xs font-mono gap-1.5': size === 'sm',
            'px-4 py-2 text-sm gap-2': size === 'md',
            'px-5 py-2.5 text-base gap-2.5': size === 'lg',
          },
          {
            'bg-tactical-cyan hover:bg-tactical-teal text-midnight-950 font-semibold shadow-glow-cyan hover:shadow-glow-teal':
              variant === 'primary',
            'bg-midnight-800 hover:bg-midnight-700 text-midnight-100 border border-midnight-600':
              variant === 'secondary',
            'bg-transparent hover:bg-midnight-800 text-midnight-300 border border-midnight-700':
              variant === 'outline',
            'bg-tactical-crimson/20 hover:bg-tactical-crimson/30 text-tactical-crimson border border-tactical-crimson/40':
              variant === 'danger',
            'bg-transparent hover:bg-midnight-800 text-midnight-400 hover:text-midnight-100':
              variant === 'ghost',
          },
          className
        )
      )}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Processing...
        </span>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
