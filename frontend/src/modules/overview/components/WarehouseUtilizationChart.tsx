import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Warehouse } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { DashboardCardSkeleton } from '../../../components/common/LoadingSkeleton';
import { EmptyState } from '../../../components/common/EmptyState';
import { WarehouseUtilizationItem } from '../../../types/metrics';

export interface WarehouseUtilizationChartProps {
  data?: WarehouseUtilizationItem[];
  isLoading?: boolean;
  isError?: boolean;
}

export function WarehouseUtilizationChart({
  data,
  isLoading = false,
  isError = false,
}: WarehouseUtilizationChartProps) {
  const topNodes = useMemo(() => {
    if (!data || data.length === 0) return [];
    // Show top 8 facilities by allocated order volume
    return [...data]
      .sort((a, b) => b.allocated_orders - a.allocated_orders)
      .slice(0, 8);
  }, [data]);

  if (isLoading) {
    return <DashboardCardSkeleton />;
  }

  if (isError) {
    return (
      <Card variant="elevated">
        <CardContent className="p-8 text-center text-tactical-crimson">
          Failed to load warehouse utilization telemetry.
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card variant="elevated">
        <CardContent className="p-6">
          <EmptyState
            title="No Warehouse Records"
            description="Warehouse capacity utilization records are currently unavailable."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader
        headerIcon={<Warehouse className="w-4 h-4 text-tactical-teal" />}
        subtitle="Top 8 Fulfillment Hubs by Allocated Order Volume"
        headerAction={
          <Badge variant="indigo" size="sm">
            20 Nodes Active
          </Badge>
        }
      >
        <CardTitle>Warehouse Utilization: Orders vs. Units</CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[340px] w-full" aria-label="Warehouse utilization comparison chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topNodes}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
              
              <XAxis
                dataKey="city"
                stroke="#64748B"
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'sans-serif' }}
                tickLine={{ stroke: '#334155' }}
              />

              <YAxis
                stroke="#64748B"
                domain={[0, 'auto']}
                tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                tickFormatter={(val) => `${val.toFixed(1)}%`}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as WarehouseUtilizationItem;
                  return (
                    <div className="p-3.5 rounded-lg border border-midnight-700 bg-midnight-950/95 shadow-xl text-xs space-y-2 font-sans min-w-[240px]">
                      <div className="flex items-center justify-between pb-1.5 border-b border-midnight-800">
                        <span className="font-semibold text-midnight-100">{item.node_name}</span>
                        <Badge variant="outline" size="sm">{item.city}, {item.state}</Badge>
                      </div>

                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div>
                          <div className="flex justify-between text-tactical-cyan font-semibold">
                            <span>Order Capacity Utilization:</span>
                            <span>{item.order_utilization_pct.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between text-midnight-400 text-[10px]">
                            <span>Allocated / Max Orders:</span>
                            <span>{item.allocated_orders.toLocaleString()} / {item.order_capacity.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-midnight-800">
                          <div className="flex justify-between text-tactical-indigoLight font-semibold">
                            <span>Unit Capacity Utilization:</span>
                            <span>{item.unit_utilization_pct.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between text-midnight-400 text-[10px]">
                            <span>Allocated / Max Units:</span>
                            <span>{item.allocated_units.toLocaleString()} / {item.unit_capacity.toLocaleString()}</span>
                          </div>
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

              {/* Order Capacity Utilization %: Tactical Cyan */}
              <Bar
                dataKey="order_utilization_pct"
                name="Order Capacity Util %"
                fill="#06B6D4"
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />

              {/* Unit Capacity Utilization %: Tactical Indigo */}
              <Bar
                dataKey="unit_utilization_pct"
                name="Unit Capacity Util %"
                fill="#818CF8"
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-midnight-800 flex flex-wrap items-center justify-between text-xs text-midnight-400 font-sans gap-2">
          <span>
            <strong className="text-tactical-cyan font-medium">Order Capacity</strong> tracks dispatch slots; <strong className="text-tactical-indigoLight font-medium">Unit Capacity</strong> tracks volume throughput.
          </span>
          <span className="font-mono text-[11px] text-midnight-500">
            Averaged across 260 operating days
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
