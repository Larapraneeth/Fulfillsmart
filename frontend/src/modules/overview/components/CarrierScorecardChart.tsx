import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Truck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { DashboardCardSkeleton } from '../../../components/common/LoadingSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { CarrierPerformanceItem } from '../../../types/metrics';

export interface CarrierScorecardChartProps {
  data?: CarrierPerformanceItem[];
  isLoading?: boolean;
  isError?: boolean;
}

export function CarrierScorecardChart({
  data,
  isLoading = false,
  isError = false,
}: CarrierScorecardChartProps) {
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    // Sort descending by shipment volume
    return [...data].sort((a, b) => b.shipment_count - a.shipment_count);
  }, [data]);

  if (isLoading) {
    return <DashboardCardSkeleton />;
  }

  if (isError) {
    return (
      <Card variant="elevated">
        <CardContent className="p-8 text-center text-tactical-crimson">
          Failed to load carrier performance scorecard.
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card variant="elevated">
        <CardContent className="p-6">
          <EmptyState
            title="No Carrier Records"
            description="Carrier performance metrics are currently unavailable."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader
        headerIcon={<Truck className="w-4 h-4 text-tactical-teal" />}
        subtitle="10 Commercial Carriers Ranked by Shipment Volume"
        headerAction={
          <Badge variant="cyan" size="sm">
            49,436 Total Shipments
          </Badge>
        }
      >
        <CardTitle>Carrier Reliability & Volume Scorecard</CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[340px] w-full" aria-label="Carrier performance scorecard chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sortedData}
              margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
            >
              <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" horizontal={false} />
              
              <XAxis
                type="number"
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `${val.toLocaleString()}`}
              />

              <YAxis
                type="category"
                dataKey="carrier_name"
                stroke="#64748B"
                tick={{ fill: '#CBD5E1', fontSize: 11, fontFamily: 'sans-serif' }}
                tickLine={false}
                width={85}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as CarrierPerformanceItem;
                  return (
                    <div className="p-3.5 rounded-lg border border-midnight-700 bg-midnight-950/95 shadow-xl text-xs space-y-2 font-sans min-w-[230px]">
                      <div className="flex items-center justify-between pb-1.5 border-b border-midnight-800">
                        <span className="font-semibold text-midnight-100">{item.carrier_name}</span>
                        <Badge variant="outline" size="sm">{item.carrier_id}</Badge>
                      </div>

                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between text-midnight-300">
                          <span>Shipment Volume:</span>
                          <span className="font-bold text-midnight-100">{item.shipment_count.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-tactical-teal font-semibold">
                          <span>On-Time Rate:</span>
                          <span>{item.on_time_rate_pct.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-tactical-amber">
                          <span>Delayed Shipments:</span>
                          <span>{item.delayed_shipments.toLocaleString()} ({item.delay_rate_pct.toFixed(2)}%)</span>
                        </div>
                        <div className="flex justify-between text-midnight-400 pt-1 border-t border-midnight-800">
                          <span>Carrier Mean Delay (All Shipments):</span>
                          <span className="text-midnight-200">{item.average_delay_days.toFixed(3)} days</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              <Bar
                dataKey="shipment_count"
                name="Shipments"
                fill="#00F2FE"
                fillOpacity={0.85}
                radius={[0, 4, 4, 0]}
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-midnight-800 flex flex-wrap items-center justify-between text-xs text-midnight-400 font-sans gap-2">
          <span>
            Hover over bars to inspect on-time fulfillment rates and carrier mean delays.
          </span>
          <span className="font-mono text-[11px] text-midnight-500">
            Carrier delay represents average delay across all assigned shipments
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
