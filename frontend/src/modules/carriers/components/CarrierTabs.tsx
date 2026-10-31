import React from 'react';
import { Award, Layers, MapPin, TrendingUp } from 'lucide-react';

export type CarrierTabType = 'scorecard' | 'service_levels' | 'coverage' | 'trends';

interface CarrierTabsProps {
  activeTab: CarrierTabType;
  onTabChange: (tab: CarrierTabType) => void;
  carriersCount: number;
  serviceLevelsCount: number;
  coverageCount: number;
}

export const CarrierTabs: React.FC<CarrierTabsProps> = ({
  activeTab,
  onTabChange,
  carriersCount,
  serviceLevelsCount,
  coverageCount,
}) => {
  const tabs = [
    {
      id: 'scorecard' as CarrierTabType,
      label: 'Carrier Scorecard',
      icon: Award,
      badge: carriersCount ? `${carriersCount} Carriers` : undefined,
    },
    {
      id: 'service_levels' as CarrierTabType,
      label: 'Service Level Performance',
      icon: Layers,
      badge: serviceLevelsCount ? `${serviceLevelsCount} Tiers` : undefined,
    },
    {
      id: 'coverage' as CarrierTabType,
      label: 'Zone Coverage Matrix',
      icon: MapPin,
      badge: coverageCount ? `${coverageCount} Routes` : undefined,
    },
    {
      id: 'trends' as CarrierTabType,
      label: 'Monthly Delivery Trends',
      icon: TrendingUp,
      badge: '10 Months',
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
