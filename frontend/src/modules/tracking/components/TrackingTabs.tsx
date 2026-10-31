import React from 'react';
import { Package, Clock, Truck, Building2 } from 'lucide-react';

export type TrackingTabType = 'explorer' | 'performance' | 'carriers' | 'nodes';

interface TrackingTabsProps {
  activeTab: TrackingTabType;
  onTabChange: (tab: TrackingTabType) => void;
  shipmentsCount: number;
  delayedCount: number;
}

export const TrackingTabs: React.FC<TrackingTabsProps> = ({
  activeTab,
  onTabChange,
  shipmentsCount,
  delayedCount,
}) => {
  const tabs = [
    {
      id: 'explorer' as TrackingTabType,
      label: 'Shipment Tracking Explorer',
      icon: Package,
      badge: shipmentsCount ? `${shipmentsCount.toLocaleString()} Shipments` : undefined,
    },
    {
      id: 'performance' as TrackingTabType,
      label: 'Delay Duration Distribution',
      icon: Clock,
      badge: delayedCount ? `${delayedCount.toLocaleString()} Delays` : undefined,
    },
    {
      id: 'carriers' as TrackingTabType,
      label: 'Carrier Delivery Comparison',
      icon: Truck,
      badge: '10 Carriers',
    },
    {
      id: 'nodes' as TrackingTabType,
      label: 'Fulfillment Node Comparison',
      icon: Building2,
      badge: '20 Nodes',
    },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-midnight-700/80 pb-2 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30 shadow-sm'
                : 'text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/40 border border-transparent'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-tactical-teal' : 'text-midnight-400'}`} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                  isActive
                    ? 'bg-tactical-teal/20 text-tactical-teal'
                    : 'bg-midnight-800 text-midnight-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
