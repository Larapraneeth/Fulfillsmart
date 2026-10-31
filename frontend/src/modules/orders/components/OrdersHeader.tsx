import {
  PackageSearch,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Boxes,
  Database,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useHeadlineMetrics } from '../../../api/queries/useMetrics';

export interface OrdersHeaderProps {
  totalOrdersCount?: number;
}

export function OrdersHeader({ totalOrdersCount = 50000 }: OrdersHeaderProps) {
  const { data: headline } = useHeadlineMetrics();

  // Dynamic values sourced from headline telemetry if available, falling back to verified baseline values
  const totalOrders = headline?.total_orders ?? totalOrdersCount;
  const splitOrders = headline?.split_node_orders ?? 11;
  const carrierUnavailable = headline?.carrier_unavailable_orders ?? 579;
  // Baseline verified distribution: 48,293 On-Time, 1,128 Late, 579 Carrier Unavailable = 50,000 Total
  const onTimeOrders = 48293;
  const lateOrders = 1128;

  return (
    <div className="space-y-4">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-midnight-900 border border-midnight-700 flex items-center justify-center text-tactical-teal shadow-glow-subtle-teal"
            aria-hidden="true"
          >
            <PackageSearch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-midnight-100 font-display tracking-tight">
                Orders Explorer
              </h1>
              <Badge variant="amber" size="sm" className="gap-1 font-mono">
                <Database className="w-3 h-3" />
                Historical Baseline Dataset
              </Badge>
            </div>
            <p className="text-xs text-midnight-400 font-sans mt-0.5">
              High-throughput server-side deferred-join pagination across 50,000 baseline fulfillment records.
            </p>
          </div>
        </div>

        {/* Operational Guard Disclosure */}
        <div className="flex items-center gap-2 bg-midnight-900/90 border border-midnight-700/80 px-3 py-1.5 rounded-lg text-xs font-mono text-midnight-400">
          <ShieldAlert className="w-3.5 h-3.5 text-tactical-amber shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Baseline Read-Only:</span>
          <span className="text-midnight-200">Simulation sandbox isolated</span>
        </div>
      </div>

      {/* Quick Provenance KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-midnight-900/80 border border-midnight-700/80 rounded-lg p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-midnight-800 border border-midnight-700 flex items-center justify-center text-midnight-300 shrink-0">
            <PackageSearch className="w-4 h-4 text-tactical-teal" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-midnight-400">Total Orders</p>
            <p className="text-sm font-bold font-mono text-midnight-100">{totalOrders.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-midnight-900/80 border border-midnight-700/80 rounded-lg p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-tactical-emerald/10 border border-tactical-emerald/30 flex items-center justify-center text-tactical-emerald shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-midnight-400">On-Time</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold font-mono text-tactical-emerald">{onTimeOrders.toLocaleString()}</span>
              <span className="text-[10px] font-mono text-midnight-400">(96.6%)</span>
            </div>
          </div>
        </div>

        <div className="bg-midnight-900/80 border border-midnight-700/80 rounded-lg p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-tactical-amber/10 border border-tactical-amber/30 flex items-center justify-center text-tactical-amber shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-midnight-400">Late Deliveries</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold font-mono text-tactical-amber">{lateOrders.toLocaleString()}</span>
              <span className="text-[10px] font-mono text-midnight-400">(2.3%)</span>
            </div>
          </div>
        </div>

        <div className="bg-midnight-900/80 border border-midnight-700/80 rounded-lg p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-tactical-crimson/10 border border-tactical-crimson/30 flex items-center justify-center text-tactical-crimson shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-midnight-400">Carrier Unavail.</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold font-mono text-tactical-crimson">{carrierUnavailable.toLocaleString()}</span>
              <span className="text-[10px] font-mono text-midnight-400">(1.2%)</span>
            </div>
          </div>
        </div>

        <div className="bg-midnight-900/80 border border-midnight-700/80 rounded-lg p-2.5 flex items-center gap-2.5 col-span-2 sm:col-span-1">
          <div className="w-8 h-8 rounded-md bg-tactical-indigo/10 border border-tactical-indigo/30 flex items-center justify-center text-tactical-indigoLight shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-midnight-400">Split-Node Orders</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold font-mono text-tactical-indigoLight">{splitOrders}</span>
              <span className="text-[10px] font-mono text-midnight-400">orders</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
