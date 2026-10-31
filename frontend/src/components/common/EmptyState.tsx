import React from 'react';
import { PackageOpen } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        'p-10 rounded-xl border border-midnight-700 bg-midnight-900/60 text-center max-w-lg mx-auto my-6',
        className
      )}
    >
      <div
        className="w-12 h-12 rounded-xl bg-midnight-800 border border-midnight-700 flex items-center justify-center mx-auto mb-4 text-midnight-400"
        aria-hidden="true"
      >
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-base font-semibold text-midnight-100 font-display mb-1.5">{title}</h3>
      <p className="text-sm text-midnight-400 mb-6 font-sans leading-relaxed">{description}</p>

      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}
