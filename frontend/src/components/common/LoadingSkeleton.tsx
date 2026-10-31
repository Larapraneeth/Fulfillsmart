import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: string;
  width?: string;
}

export function LoadingSkeleton({
  className,
  height,
  width,
  style,
  ...props
}: LoadingSkeletonProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'relative overflow-hidden rounded-md bg-midnight-800/80 border border-midnight-700/50 motion-safe:animate-pulse',
          className
        )
      )}
      style={{
        height: height || undefined,
        width: width || undefined,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      <div
        className="absolute inset-0 -translate-x-full motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-midnight-600/20 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="p-6 rounded-xl border border-midnight-700 bg-midnight-900/60 space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-4 w-32" />
        <LoadingSkeleton className="h-4 w-12" />
      </div>
      <LoadingSkeleton className="h-10 w-24" />
      <LoadingSkeleton className="h-3 w-48" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-5 rounded-xl border border-midnight-700 bg-midnight-850/80 space-y-2" aria-hidden="true">
      <LoadingSkeleton className="h-3 w-28" />
      <LoadingSkeleton className="h-8 w-20" />
      <LoadingSkeleton className="h-2.5 w-36" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-midnight-700 bg-midnight-900/60 p-4 space-y-3" aria-hidden="true">
      <div className="flex items-center justify-between pb-3 border-b border-midnight-700">
        <LoadingSkeleton className="h-4 w-40" />
        <LoadingSkeleton className="h-8 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-4 py-2">
          <LoadingSkeleton className="h-4 w-28" />
          <LoadingSkeleton className="h-4 w-48 flex-1" />
          <LoadingSkeleton className="h-4 w-20" />
          <LoadingSkeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
