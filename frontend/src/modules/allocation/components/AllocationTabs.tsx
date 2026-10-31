import React from 'react';
import { Search, Split, Building2, Terminal } from 'lucide-react';

export type AllocationTabId = 'overview' | 'splits' | 'capacity' | 'sandbox';

interface AllocationTabsProps {
  activeTab: AllocationTabId;
  onTabChange: (tab: AllocationTabId) => void;
  splitCount?: number;
}

export const AllocationTabs: React.FC<AllocationTabsProps> = ({
  activeTab,
  onTabChange,
  splitCount = 11,
}) => {
  const tabs = [
    {
      id: 'overview' as AllocationTabId,
      label: 'Explorer & Lookup',
      icon: Search,
      badge: '50k Baseline',
    },
    {
      id: 'splits' as AllocationTabId,
      label: 'Split Case Studies',
      icon: Split,
      badge: `${splitCount} Orders`,
    },
    {
      id: 'capacity' as AllocationTabId,
      label: 'Warehouse Capacity',
      icon: Building2,
      badge: '20 Nodes',
    },
    {
      id: 'sandbox' as AllocationTabId,
      label: 'Engine Sandbox',
      icon: Terminal,
      badge: 'Interactive',
    },
  ];

  return (
    <div className="flex border-b border-midnight-700/80 gap-2 overflow-x-auto pb-px">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all duration-150 border-t border-x border-b-0 whitespace-nowrap ${
              isActive
                ? 'bg-midnight-900 border-midnight-700 text-tactical-teal shadow-[0_-2px_10px_rgba(0,242,254,0.1)] border-b-2 border-b-midnight-900 -mb-px z-10'
                : 'bg-midnight-950/40 border-transparent text-midnight-400 hover:text-midnight-200 hover:bg-midnight-900/40'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-tactical-teal' : 'text-midnight-400'}`} />
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                isActive
                  ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30'
                  : 'bg-midnight-800 text-midnight-400'
              }`}
            >
              {tab.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
};
