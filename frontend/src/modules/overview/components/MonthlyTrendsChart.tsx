import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Calendar, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { DashboardCardSkeleton } from '../../../components/common/LoadingSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { MonthlyTrendItem } from '../../../types/metrics';

export interface MonthlyTrendsChartProps {
  data?: MonthlyTrendItem[];
  isLoading?: boolean;
  isError?: boolean;
}

interface ProcessedMonthlyData {
  rawMonth: string;
  displayMonth: string;
  orders: number;
  completed_orders: number;
  late_orders: number;
  carrier_unavailable_orders: number;
  strict_on_time_rate: number;
  historical_on_time_rate: number;
}

export function MonthlyTrendsChart({
  data,
  isLoading = false,
  isError = false,
}: MonthlyTrendsChartProps) {
  const chartData: ProcessedMonthlyData[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => {
      // Month formatting (e.g. "2026-01" -> "Jan '26")
      const [yearStr, monthStr] = item.month.split('-');
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const monthIndex = parseInt(monthStr, 10) - 1;
      const monthName = monthNames[monthIndex] || item.month;
      const displayMonth = `${monthName} '${yearStr.slice(2)}`;

      // Derive strict on-time rate using verified formula
      const strictOnTimeOrders = item.on_time_orders - item.carrier_unavailable_orders;
      const strictRate = item.orders > 0 ? (strictOnTimeOrders / item.orders) * 100 : 0;

      return {
        rawMonth: item.month,
        displayMonth,
        orders: item.orders,
        completed_orders: item.completed_orders,
        late_orders: item.late_orders,
        carrier_unavailable_orders: item.carrier_unavailable_orders,
        strict_on_time_rate: parseFloat(strictRate.toFixed(2)),
        historical_on_time_rate: parseFloat(item.on_time_rate_all_orders_pct.toFixed(2)),
      };
    });
  }, [data]);

  if (isLoading) {
    return <DashboardCardSkeleton />;
  }

  if (isError) {
    return (
      <Card variant="elevated">
        <CardContent className="p-8 text-center text-tactical-crimson">
          Failed to load monthly delivery trends telemetry.
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card variant="elevated">
        <CardContent className="p-6">
          <EmptyState
            title="No Monthly Data Available"
            description="Historical monthly delivery outcome records are not currently available."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader
        headerIcon={<TrendingUp className="w-4 h-4 text-tactical-teal" />}
        subtitle="11 Historical Operating Months (Dec 2025 – Oct 2026)"
        headerAction={
          <div className="flex items-center gap-2">
            <Badge variant="teal" size="sm">Strict vs Baseline</Badge>
          </div>
        }
      >
        <CardTitle>Monthly Fulfillment Performance & Trajectory</CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[340px] w-full" aria-label="Monthly fulfillment trends chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
              
              <XAxis
                dataKey="displayMonth"
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
              />

              {/* Left Y-Axis: Order Volumes */}
              <YAxis
                yAxisId="left"
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />

              {/* Right Y-Axis: On-Time Rate Percentages */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 105]}
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `${val}%`}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as ProcessedMonthlyData;
                  return (
                    <div className="p-3.5 rounded-lg border border-midnight-700 bg-midnight-950/95 shadow-xl text-xs space-y-2 font-sans min-w-[220px]">
                      <div className="flex items-center justify-between pb-1.5 border-b border-midnight-800">
                        <span className="font-semibold text-midnight-100 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-tactical-teal" />
                          {label} ({d.rawMonth})
                        </span>
                      </div>

                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between text-midnight-300">
                          <span>Total Orders:</span>
                          <span className="font-bold text-midnight-100">{d.orders.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-tactical-cyan">
                          <span>Completed Deliveries:</span>
                          <span className="font-bold">{d.completed_orders.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-tactical-amber">
                          <span>Delayed Orders:</span>
                          <span className="font-bold">{d.late_orders.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-tactical-crimson">
                          <span>Carrier Unavailable:</span>
                          <span className="font-bold">{d.carrier_unavailable_orders.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-midnight-800 space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between items-center text-tactical-teal font-semibold">
                          <span>Strict On-Time Rate:</span>
                          <span>{d.strict_on_time_rate.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between items-center text-midnight-400 text-[10px]">
                          <span>Historical Baseline (Legacy):</span>
                          <span>{d.historical_on_time_rate.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontFamily: 'sans-serif' }}
                formatter={(value) => (
                  <span className="text-midnight-300 text-xs mr-2">{value}</span>
                )}
              />

              {/* Volume Bars */}
              <Bar
                yAxisId="left"
                dataKey="orders"
                name="Total Orders"
                fill="#1E293B"
                stroke="#334155"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                yAxisId="left"
                dataKey="completed_orders"
                name="Completed Orders"
                fill="#06B6D4"
                fillOpacity={0.65}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />

              {/* Primary Strict Rate: Solid Electric Teal */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="strict_on_time_rate"
                name="Strict On-Time Rate"
                stroke="#00F2FE"
                strokeWidth={2.5}
                dot={{ fill: '#00F2FE', r: 3.5, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#00F2FE', stroke: '#060913', strokeWidth: 2 }}
              />

              {/* Secondary Audit Rate: Dashed Muted Slate */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="historical_on_time_rate"
                name="Historical Baseline (Step 7 Legacy)"
                stroke="#64748B"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ fill: '#64748B', r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#94A3B8' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-midnight-800 flex flex-wrap items-center justify-between text-xs text-midnight-400 font-sans gap-2">
          <span>
            Primary solid line represents <strong className="text-tactical-teal font-medium">Strict On-Time Rate</strong> (excluding 579 carrier-unavailable orders).
          </span>
          <span className="font-mono text-[11px] text-midnight-500">
            Dashed line: Step 7 historical baseline audit reference
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
