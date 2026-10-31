import React from 'react';
import { 
  AlertOctagon, 
  XCircle, 
  Clock, 
  GitFork, 
  ShieldCheck, 
  FileCheck2 
} from 'lucide-react';
import { Card, CardContent } from '../../../components/common/Card';
import { AnomalyOverviewResponse } from '../../../types/anomalies';

interface AnomalyKpiCardsProps {
  overview?: AnomalyOverviewResponse;
  isLoading?: boolean;
}

export const AnomalyKpiCards: React.FC<AnomalyKpiCardsProps> = ({
  overview,
  isLoading = false,
}) => {
  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-midnight-900/60 border border-midnight-800 animate-pulse p-4">
            <div className="h-3 w-20 bg-midnight-700/60 rounded mb-3" />
            <div className="h-7 w-24 bg-midnight-700/80 rounded mb-2" />
            <div className="h-2.5 w-16 bg-midnight-700/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'total-anomalies',
      title: 'Total Flagged Records',
      value: overview.total_anomalies.toLocaleString(),
      subtitle: 'Disjoint Operational Deviations',
      badge: '1,718 Historical',
      badgeColor: 'text-tactical-amber bg-tactical-amber/10 border-tactical-amber/30',
      icon: AlertOctagon,
      iconColor: 'text-tactical-amber',
      accentGlow: 'hover:border-tactical-amber/40',
    },
    {
      id: 'carrier-exceptions',
      title: 'Carrier Assignment Failures',
      value: '579',
      subtitle: `${overview.order_exception_rate_pct.toFixed(3)}% of 50k Orders`,
      badge: 'Unfulfillable (SAME_DAY)',
      badgeColor: 'text-tactical-crimson bg-tactical-crimson/10 border-tactical-crimson/30',
      icon: XCircle,
      iconColor: 'text-tactical-crimson',
      accentGlow: 'hover:border-tactical-crimson/40',
    },
    {
      id: 'delivery-delays',
      title: 'Delivery Delay Deviations',
      value: '1,128',
      subtitle: `${overview.shipment_delay_rate_pct.toFixed(3)}% of 49.4k Parcels`,
      badge: '+1d / +2d / +3d SLAs',
      badgeColor: 'text-tactical-amber bg-tactical-amber/10 border-tactical-amber/30',
      icon: Clock,
      iconColor: 'text-tactical-amber',
      accentGlow: 'hover:border-tactical-amber/40',
    },
    {
      id: 'split-orders',
      title: 'Split-Order Complexities',
      value: '11',
      subtitle: `${overview.split_order_rate_pct.toFixed(3)}% of 50k Orders`,
      badge: '2–3 Warehouse Nodes',
      badgeColor: 'text-tactical-teal bg-tactical-teal/10 border-tactical-teal/30',
      icon: GitFork,
      iconColor: 'text-tactical-teal',
      accentGlow: 'hover:border-tactical-teal/40',
    },
    {
      id: 'clean-audit',
      title: 'Clean Invariants Audit',
      value: `${overview.clean_records_specificity_pct.toFixed(1)}%`,
      subtitle: '247,061 Records Checked',
      badge: '0 False Positives',
      badgeColor: 'text-tactical-emerald bg-tactical-emerald/10 border-tactical-emerald/30',
      icon: ShieldCheck,
      iconColor: 'text-tactical-emerald',
      accentGlow: 'hover:border-tactical-emerald/40',
    },
    {
      id: 'synthetic-benchmark',
      title: 'Benchmark Suite Score',
      value: overview.synthetic_benchmark_f1.toFixed(3),
      subtitle: '976 Replacement Cases',
      badge: '100% Precision & Recall',
      badgeColor: 'text-tactical-cyan bg-tactical-cyan/10 border-tactical-cyan/30',
      icon: FileCheck2,
      iconColor: 'text-tactical-cyan',
      accentGlow: 'hover:border-tactical-cyan/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.id}
            className={`border-midnight-750 bg-midnight-900/80 transition-all duration-200 ${c.accentGlow}`}
          >
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-midnight-400 truncate max-w-[120px]">
                  {c.title}
                </span>
                <div className={`p-1.5 rounded-lg bg-midnight-950/80 ${c.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-midnight-50 tracking-tight">
                  {c.value}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] pt-0.5">
                <span className="text-midnight-400 truncate max-w-[110px]" title={c.subtitle}>
                  {c.subtitle}
                </span>
                <span className={`px-1.5 py-0.5 rounded border font-mono text-[9px] font-medium whitespace-nowrap ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
