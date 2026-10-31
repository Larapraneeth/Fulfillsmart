import React, { useState, useMemo } from 'react';
import { TrendingUp, Filter, Calendar, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { MonthlyCarrierTrendItem } from '../../../types/carrier';

interface CarrierMonthlyTrendsChartProps {
  trends: MonthlyCarrierTrendItem[];
  carriers: Array<{ carrier_id: string; carrier_name: string }>;
  onSelectCarrier?: (carrierId: string) => void;
}

export const CarrierMonthlyTrendsChart: React.FC<CarrierMonthlyTrendsChartProps> = ({
  trends,
  carriers,
}) => {
  const [selectedCarrier, setSelectedCarrier] = useState<string>('ALL');

  // Month names mapping
  const monthNames: Record<string, string> = {
    '2026-01': 'Jan 2026',
    '2026-02': 'Feb 2026',
    '2026-03': 'Mar 2026',
    '2026-04': 'Apr 2026',
    '2026-05': 'May 2026',
    '2026-06': 'Jun 2026',
    '2026-07': 'Jul 2026',
    '2026-08': 'Aug 2026',
    '2026-09': 'Sep 2026',
    '2026-10': 'Oct 2026',
  };

  // Group trends by month
  const monthlyData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: string;
        shipment_count: number;
        delayed_shipments: number;
        ontime_shipments: number;
        on_time_rate_pct: number;
      }
    > = {};

    trends.forEach((t) => {
      if (selectedCarrier !== 'ALL' && t.carrier_id !== selectedCarrier) {
        return;
      }

      if (!monthMap[t.month]) {
        monthMap[t.month] = {
          month: t.month,
          shipment_count: 0,
          delayed_shipments: 0,
          ontime_shipments: 0,
          on_time_rate_pct: 0,
        };
      }

      monthMap[t.month].shipment_count += t.shipment_count;
      monthMap[t.month].delayed_shipments += t.delayed_shipments;
    });

    const result = Object.values(monthMap).map((m) => {
      const ontime = m.shipment_count - m.delayed_shipments;
      const rate = m.shipment_count ? (ontime / m.shipment_count) * 100 : 0;
      return {
        ...m,
        ontime_shipments: ontime,
        on_time_rate_pct: Number(rate.toFixed(2)),
      };
    });

    result.sort((a, b) => a.month.localeCompare(b.month));
    return result;
  }, [trends, selectedCarrier]);

  // Insights
  const insights = useMemo(() => {
    if (monthlyData.length === 0) return null;
    let peakMonth = monthlyData[0];
    let highestOntime = monthlyData[0];
    let lowestOntime = monthlyData[0];

    monthlyData.forEach((m) => {
      if (m.shipment_count > peakMonth.shipment_count) peakMonth = m;
      if (m.on_time_rate_pct > highestOntime.on_time_rate_pct) highestOntime = m;
      if (m.on_time_rate_pct < lowestOntime.on_time_rate_pct) lowestOntime = m;
    });

    const totalShipments = monthlyData.reduce((s, m) => s + m.shipment_count, 0);
    const totalDelays = monthlyData.reduce((s, m) => s + m.delayed_shipments, 0);
    const avgRate = totalShipments
      ? (((totalShipments - totalDelays) / totalShipments) * 100).toFixed(2)
      : '0.00';

    return {
      peakMonth,
      highestOntime,
      lowestOntime,
      totalShipments,
      totalDelays,
      avgRate,
    };
  }, [monthlyData]);

  // Max volume for relative bar scaling
  const maxVolume = useMemo(() => {
    return Math.max(...monthlyData.map((m) => m.shipment_count), 1);
  }, [monthlyData]);

  return (
    <div className="space-y-4">
      {/* 3 Insight Metric Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-midnight-900/70 border-midnight-700/60">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between text-midnight-400 mb-1">
                <span className="text-xs font-medium">Peak Dispatch Volume</span>
                <Calendar className="w-3.5 h-3.5 text-tactical-teal" />
              </div>
              <div className="text-lg font-bold font-mono text-midnight-100">
                {monthNames[insights.peakMonth.month] || insights.peakMonth.month}
              </div>
              <div className="text-xs font-mono text-tactical-teal mt-0.5">
                {insights.peakMonth.shipment_count.toLocaleString()} shipments
                <span className="text-midnight-400 font-sans ml-1">
                  ({insights.peakMonth.on_time_rate_pct}% on-time)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-midnight-900/70 border-midnight-700/60">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between text-midnight-400 mb-1">
                <span className="text-xs font-medium">Highest Reliability Month</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-tactical-emerald" />
              </div>
              <div className="text-lg font-bold font-mono text-tactical-emerald">
                {monthNames[insights.highestOntime.month] || insights.highestOntime.month}
              </div>
              <div className="text-xs font-mono text-tactical-emerald mt-0.5">
                {insights.highestOntime.on_time_rate_pct}% on-time
                <span className="text-midnight-400 font-sans ml-1">
                  ({insights.highestOntime.delayed_shipments} delays)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-midnight-900/70 border-midnight-700/60">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between text-midnight-400 mb-1">
                <span className="text-xs font-medium">Overall 10-Month Rate</span>
                <TrendingUp className="w-3.5 h-3.5 text-tactical-cyan" />
              </div>
              <div className="text-lg font-bold font-mono text-tactical-cyan">
                {insights.avgRate}%
              </div>
              <div className="text-xs font-mono text-midnight-400 mt-0.5">
                {insights.totalDelays.toLocaleString()} total delayed consignments
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Trends Table & Visual Progress Card */}
      <Card className="bg-midnight-900/90 border-midnight-700/80 shadow-xl">
        <CardHeader className="pb-3 border-b border-midnight-700/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-midnight-100 flex items-center gap-2">
                <span>Monthly Delivery Trends (Jan – Oct 2026)</span>
                <Badge variant="teal" size="sm">
                  {monthlyData.length} Months
                </Badge>
              </CardTitle>
              <p className="text-xs text-midnight-400 mt-0.5">
                Historical monthly dispatch volume and on-time fulfillment rates across the 10-month evaluation period.
              </p>
            </div>

            {/* Carrier Filter */}
            <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-midnight-400" />
              <select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value="ALL" className="bg-midnight-900">
                  All Carriers (Aggregate Network)
                </option>
                {carriers.map((c) => (
                  <option key={c.carrier_id} value={c.carrier_id} className="bg-midnight-900">
                    {c.carrier_name} ({c.carrier_id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-midnight-700/60 bg-midnight-950/60 text-[11px] font-semibold text-midnight-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Evaluation Month</th>
                  <th className="py-3 px-3">Volume Distribution</th>
                  <th className="py-3 px-3 text-right">Shipments</th>
                  <th className="py-3 px-3 text-right">Delivered On-Time</th>
                  <th className="py-3 px-3 text-right">Delayed</th>
                  <th className="py-3 px-4">On-Time Delivery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-800/40 text-xs text-midnight-200">
                {monthlyData.map((m) => {
                  const volumePct = ((m.shipment_count / maxVolume) * 100).toFixed(0);
                  const rate = m.on_time_rate_pct;

                  return (
                    <tr key={m.month} className="hover:bg-midnight-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-midnight-100">
                        <div className="text-sm font-semibold">
                          {monthNames[m.month] || m.month}
                        </div>
                        <div className="text-[10px] text-midnight-500">{m.month}</div>
                      </td>

                      {/* Visual Relative Volume Bar */}
                      <td className="py-3 px-3 min-w-[160px]">
                        <div className="w-full h-2 rounded-full bg-midnight-950 overflow-hidden">
                          <div
                            className="h-full bg-tactical-teal/70 rounded-full"
                            style={{ width: `${volumePct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-midnight-400 font-mono mt-0.5">
                          {volumePct}% of peak month
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-midnight-100">
                        {m.shipment_count.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-tactical-emerald">
                        {m.ontime_shipments.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-tactical-crimson">
                        {m.delayed_shipments.toLocaleString()}
                        <div className="text-[10px] text-midnight-500">
                          {((m.delayed_shipments / m.shipment_count) * 100).toFixed(2)}%
                        </div>
                      </td>

                      {/* On-Time Rate with Progress Bar */}
                      <td className="py-3 px-4 min-w-[160px]">
                        <div className="flex items-center justify-between mb-1 font-mono">
                          <span
                            className={`font-bold ${
                              rate >= 97.5
                                ? 'text-tactical-emerald'
                                : rate >= 97.0
                                ? 'text-tactical-teal'
                                : 'text-tactical-amber'
                            }`}
                          >
                            {rate.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-midnight-950 overflow-hidden">
                          <div
                            className={`h-full ${
                              rate >= 97.5
                                ? 'bg-tactical-emerald'
                                : rate >= 97.0
                                ? 'bg-tactical-teal'
                                : 'bg-tactical-amber'
                            } rounded-full`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {monthlyData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-midnight-400">
                      No monthly trend data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
