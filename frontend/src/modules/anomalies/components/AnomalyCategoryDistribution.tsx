import React from 'react';
import { Layers, Database, ShieldCheck, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { AnomalyOverviewCategory } from '../../../types/anomalies';

interface AnomalyCategoryDistributionProps {
  categories: AnomalyOverviewCategory[];
  totalAnomalies: number;
}

export const AnomalyCategoryDistribution: React.FC<AnomalyCategoryDistributionProps> = ({
  categories,
  totalAnomalies,
}) => {
  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'CARRIER_UNAVAILABLE':
        return {
          barBg: 'bg-tactical-crimson',
          badgeBg: 'bg-tactical-crimson/15 text-tactical-crimson border-tactical-crimson/30',
        };
      case 'DELIVERY_DELAY':
        return {
          barBg: 'bg-tactical-amber',
          badgeBg: 'bg-tactical-amber/15 text-tactical-amber border-tactical-amber/30',
        };
      case 'SPLIT_ORDER_COMPLEXITY':
        return {
          barBg: 'bg-tactical-teal',
          badgeBg: 'bg-tactical-teal/15 text-tactical-teal border-tactical-teal/30',
        };
      default:
        return {
          barBg: 'bg-tactical-emerald',
          badgeBg: 'bg-tactical-emerald/15 text-tactical-emerald border-tactical-emerald/30',
        };
    }
  };

  return (
    <Card className="border-midnight-750 bg-midnight-900/80">
      <CardHeader className="pb-3 border-b border-midnight-700/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-midnight-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-tactical-teal" />
            <span>Category Composition & Source Verification</span>
          </CardTitle>
          <span className="text-xs font-mono text-midnight-400">
            {totalAnomalies.toLocaleString()} Total Records
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {categories.map((cat) => {
          const theme = getCategoryTheme(cat.category);
          const isZero = cat.count === 0;

          return (
            <div
              key={cat.category}
              className={`p-3 rounded-lg border transition-all ${
                isZero
                  ? 'bg-midnight-950/40 border-midnight-800/60 opacity-75'
                  : 'bg-midnight-950/80 border-midnight-750/80 hover:border-midnight-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-midnight-100">
                      {cat.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${theme.badgeBg}`}>
                      {cat.count.toLocaleString()} cases ({cat.percentage.toFixed(1)}%)
                    </span>
                    {cat.verification_type === 'VERIFIED_HISTORICAL_RECORD' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-midnight-400 font-mono">
                        <Database className="w-3 h-3 text-tactical-teal" />
                        {cat.source_table}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-tactical-teal font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        Derived Indicator
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-midnight-400 mt-1">
                    {cat.description}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-medium text-midnight-200">
                    {cat.rate_against_baseline.toFixed(3)}%
                  </div>
                  <div className="text-[10px] text-midnight-400 font-mono">
                    of {cat.denominator_count.toLocaleString()} {cat.denominator_entity}s
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-midnight-800/80 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${theme.barBg}`}
                  style={{ width: `${Math.max(cat.percentage, isZero ? 0 : 2)}%` }}
                />
              </div>

              {isZero && (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-tactical-emerald font-mono">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Verified 0 occurrences across production dataset</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
