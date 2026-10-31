import React from 'react';
import { ShieldAlert, Info, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { AnomalyOverviewSeverity, AnomalyTimeTrendItem } from '../../../types/anomalies';

interface AnomalySeverityDistributionProps {
  severities: AnomalyOverviewSeverity[];
  monthlyTrends: AnomalyTimeTrendItem[];
  totalAnomalies: number;
}

export const AnomalySeverityDistribution: React.FC<AnomalySeverityDistributionProps> = ({
  severities,
  monthlyTrends,
  totalAnomalies,
}) => {
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          textColor: 'text-tactical-crimson',
          bgColor: 'bg-tactical-crimson/15',
          borderColor: 'border-tactical-crimson/30',
          barColor: 'bg-tactical-crimson',
        };
      case 'HIGH':
        return {
          textColor: 'text-tactical-amber',
          bgColor: 'bg-tactical-amber/15',
          borderColor: 'border-tactical-amber/30',
          barColor: 'bg-tactical-amber',
        };
      case 'MEDIUM':
        return {
          textColor: 'text-tactical-teal',
          bgColor: 'bg-tactical-teal/15',
          borderColor: 'border-tactical-teal/30',
          barColor: 'bg-tactical-teal',
        };
      case 'LOW':
      default:
        return {
          textColor: 'text-tactical-cyan',
          bgColor: 'bg-tactical-cyan/15',
          borderColor: 'border-tactical-cyan/30',
          barColor: 'bg-tactical-cyan',
        };
    }
  };

  // Find max monthly anomalies for scaling the mini-trend bar
  const maxMonthly = Math.max(...monthlyTrends.map((t) => t.total_count), 1);

  return (
    <Card className="border-midnight-750 bg-midnight-900/80">
      <CardHeader className="pb-3 border-b border-midnight-700/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-midnight-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-tactical-amber" />
            <span>Rule-Based Severity Tiers & Temporal Distribution</span>
          </CardTitle>
          <span className="text-xs font-mono text-midnight-400">
            {totalAnomalies.toLocaleString()} Records
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Severity Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {severities.map((s) => {
            const style = getSeverityStyle(s.severity);
            return (
              <div
                key={s.severity}
                className={`p-3 rounded-lg border bg-midnight-950/80 ${style.borderColor} space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${style.bgColor} ${style.textColor} ${style.borderColor}`}>
                    {s.severity}
                  </span>
                  <span className="text-xs font-mono text-midnight-400">
                    {s.percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-midnight-50">
                    {s.count.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-midnight-400">cases</span>
                </div>

                <p className="text-[11px] text-midnight-400 leading-snug line-clamp-2" title={s.classification_rule}>
                  {s.classification_rule}
                </p>

                <div className="w-full h-1.5 rounded-full bg-midnight-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${style.barColor}`}
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 10-Month Historical Trend Timeline */}
        <div className="p-3.5 rounded-lg bg-midnight-950/70 border border-midnight-750/70 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium text-midnight-200">
              <Calendar className="w-3.5 h-3.5 text-tactical-teal" />
              <span>Historical Monthly Distribution (Jan–Oct 2026)</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-midnight-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tactical-amber" />
                Delivery Delays (Jan only)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tactical-crimson" />
                Carrier Unavail (Monthly)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-2">
            {monthlyTrends.map((m) => {
              const heightPct = Math.max((m.total_count / maxMonthly) * 100, 8);
              return (
                <div key={m.month} className="flex flex-col items-center gap-1.5 group">
                  <div className="text-[10px] font-mono text-midnight-400">
                    {m.total_count}
                  </div>
                  <div className="w-full h-20 bg-midnight-900 rounded flex flex-col justify-end p-0.5 overflow-hidden border border-midnight-800">
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        m.delivery_delay_count > 0 ? 'bg-tactical-amber' : 'bg-tactical-crimson'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${m.month}: ${m.total_count} total (${m.carrier_unavailable_count} carrier unavail, ${m.delivery_delay_count} delays, ${m.split_order_count} splits)`}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-midnight-400">
                    {m.month.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rule Disclosure Alert */}
        <div className="p-3 rounded-lg bg-midnight-950/60 border border-midnight-800 flex items-start gap-2.5 text-xs text-midnight-400">
          <Info className="w-4 h-4 text-tactical-teal shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-midnight-200">Derived Severity Notice: </strong>
            Severity tags are rule-based classifications derived transparently from operational outcomes.
            Carrier unfulfillable orders are tagged as <span className="text-tactical-crimson font-mono">CRITICAL</span> because they block dispatch entirely.
            Delivery delays are tiered by duration: 1-day late is <span className="text-tactical-cyan font-mono">LOW</span>, 2-days is <span className="text-tactical-teal font-mono">MEDIUM</span>, and 3+ days is <span className="text-tactical-amber font-mono">HIGH</span>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
