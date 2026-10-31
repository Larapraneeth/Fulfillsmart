import React from 'react';

export type ModuleId =
  | 'overview'
  | 'network'
  | 'orders'
  | 'allocation'
  | 'carriers'
  | 'tracking'
  | 'anomalies'
  | 'simulation'
  | 'analytics';

export interface NavigationItem {
  id: ModuleId;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

export interface NavigationSection {
  id: 'operations' | 'engines' | 'intelligence';
  title: string;
  items: NavigationItem[];
}
