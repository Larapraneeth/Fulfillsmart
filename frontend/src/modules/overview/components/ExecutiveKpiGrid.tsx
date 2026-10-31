import { useState } from 'react';
import {
  Package,
  CheckCircle2,
  Truck,
  Clock,
  AlertTriangle,
  GitFork,
  Warehouse,
  ShieldCheck,
  Info,
  X,
} from 'lucide-react';
import { Card, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { HeadlineSummary } from '../../../types/metrics';

export interface ExecutiveKpiGridProps {
  headline?: HeadlineSummary;
  delayedOrdersCount?: number;
  shipmentDelayRatePct?: number;
  carrierPromiseCoverageRatePct?: number;
}

export function ExecutiveKpiGrid({
  headline,
  delayedOrdersCount = 1128,
  shipmentDelayRatePct = 2.28,
  carrierPromiseCoverageRatePct = 98.87,
}: ExecutiveKpiGridProps) {
  const [showOnTimeDisclosure, setShowOnTimeDisclosure] = useState(false);

  return (
    <div className="space-y-4">
      {/* 8-Card Responsive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Orders */}
        <Card variant="elevated" accentBorder="cyan" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Total Orders
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-cyan/10 border border-tactical-cyan/30 text-tactical-cyan">
                <Package className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-midnight-100 mb-1">
              {headline ? headline.total_orders.toLocaleString() : '—'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-midnight-400 font-sans">
              <span className="font-semibold text-tactical-emerald">
                {headline ? `${headline.allocation_success_rate_pct.toFixed(1)}%` : '—'}
              </span>
              <span>Allocated (Zero Unallocated)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Strict On-Time Rate (Primary Headline KPI) */}
        <Card variant="elevated" accentBorder="teal" className="relative group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                  Strict On-Time Rate
                </span>
                <button
                  type="button"
                  onClick={() => setShowOnTimeDisclosure(!showOnTimeDisclosure)}
                  className="text-midnight-400 hover:text-tactical-teal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-teal rounded p-0.5"
                  aria-label="View on-time delivery rate definitions and disclosures"
                  aria-expanded={showOnTimeDisclosure}
                >
                  <Info className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="p-1.5 rounded-lg bg-tactical-teal/10 border border-tactical-teal/30 text-tactical-teal">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-midnight-100 mb-1">
              {headline ? `${headline.order_on_time_rate_strict_all_orders_pct.toFixed(2)}%` : '—'}
            </div>
            <div className="flex items-center justify-between text-xs text-midnight-400 font-sans">
              <span>All Orders Baseline (Strict)</span>
              <Badge variant="teal" size="sm">Primary</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Shipments */}
        <Card variant="elevated" accentBorder="indigo" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Total Shipments
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-indigo/10 border border-tactical-indigo/30 text-tactical-indigoLight">
                <Truck className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-midnight-100 mb-1">
              {headline ? headline.shipments.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-midnight-400 font-sans truncate">
              {carrierPromiseCoverageRatePct.toFixed(2)}% Promise Coverage Rate
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Delayed Orders */}
        <Card variant="elevated" accentBorder="amber" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Delayed Deliveries
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-amber/10 border border-tactical-amber/30 text-tactical-amber">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-tactical-amber mb-1">
              {delayedOrdersCount.toLocaleString()}
            </div>
            <div className="text-xs text-midnight-400 font-sans">
              {shipmentDelayRatePct.toFixed(2)}% Shipment Delay Rate
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Carrier Unavailability */}
        <Card variant="elevated" accentBorder="crimson" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Carrier Unavailability
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-crimson/10 border border-tactical-crimson/30 text-tactical-crimson">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-tactical-crimson mb-1">
              {headline ? headline.carrier_unavailable_orders.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-midnight-400 font-sans">
              Zone / Service Level Gaps
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Split Shipments */}
        <Card variant="elevated" accentBorder="cyan" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Split Fulfillments
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-cyan/10 border border-tactical-cyan/30 text-tactical-cyan">
                <GitFork className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-midnight-100 mb-1">
              {headline ? headline.split_node_orders.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-midnight-400 font-sans">
              0.022% Multi-Node Allocation Rate
            </div>
          </CardContent>
        </Card>

        {/* Card 7: Warehouse Capacity Utilization */}
        <Card variant="elevated" accentBorder="indigo" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Capacity Utilization
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-indigo/10 border border-tactical-indigo/30 text-tactical-indigoLight">
                <Warehouse className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-midnight-100 mb-1">
              {headline ? `${headline.warehouse_order_capacity_utilization_pct.toFixed(2)}%` : '—'}
            </div>
            <div className="text-xs text-midnight-400 font-sans">
              Order Capacity ({headline ? `${headline.warehouse_unit_capacity_utilization_pct.toFixed(2)}%` : '—'} Units)
            </div>
          </CardContent>
        </Card>

        {/* Card 8: Promise Coverage Rate */}
        <Card variant="elevated" accentBorder="teal" className="relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono tracking-wider uppercase text-midnight-400">
                Promise Coverage
              </span>
              <div className="p-1.5 rounded-lg bg-tactical-teal/10 border border-tactical-teal/30 text-tactical-teal">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-midnight-100 mb-1">
              {carrierPromiseCoverageRatePct.toFixed(2)}%
            </div>
            <div className="text-xs text-midnight-400 font-sans">
              49,436 of 50,000 Orders Assigned
            </div>
          </CardContent>
        </Card>
      </div>

      {/* On-Time Rate Disambiguation Modal / Disclosure Panel */}
      {showOnTimeDisclosure && (
        <div className="p-5 rounded-xl border border-tactical-teal/40 bg-midnight-900/95 shadow-glow-subtle-teal animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-tactical-teal shrink-0" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-midnight-100 font-display">
                On-Time Delivery Rate Definitions & Provenance
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowOnTimeDisclosure(false)}
              className="text-midnight-400 hover:text-midnight-100 p-1 rounded hover:bg-midnight-800 transition-colors"
              aria-label="Close on-time definitions disclosure"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-midnight-950 border border-tactical-teal/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-tactical-teal">Strict (All Orders)</span>
                <Badge variant="teal" size="sm">Primary</Badge>
              </div>
              <div className="text-xl font-bold font-mono text-midnight-100">
                {headline ? `${headline.order_on_time_rate_strict_all_orders_pct.toFixed(2)}%` : '96.59%'}
              </div>
              <p className="text-midnight-400 font-sans leading-relaxed">
                48,293 / 50,000 orders. Truthfully counts 579 carrier-unavailable orders as fulfillment failures.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-midnight-200">Strict (Completed Orders)</span>
                <Badge variant="outline" size="sm">Operational</Badge>
              </div>
              <div className="text-xl font-bold font-mono text-midnight-100">
                {headline ? `${headline.order_on_time_rate_strict_completed_pct.toFixed(2)}%` : '97.72%'}
              </div>
              <p className="text-midnight-400 font-sans leading-relaxed">
                48,293 / 49,421 completed orders. Evaluates genuine on-time delivery among orders where delivery was completed.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-midnight-400">Historical (Step 7 Legacy)</span>
                <Badge variant="outline" size="sm">Audit</Badge>
              </div>
              <div className="text-xl font-bold font-mono text-midnight-300">
                {headline ? `${headline.order_on_time_rate_all_orders_pct.toFixed(2)}%` : '97.74%'}
              </div>
              <p className="text-midnight-500 font-sans leading-relaxed">
                48,872 / 50,000 orders. Legacy Step 7 reporting artifact where Pandas boolean coercion counted 579 carrier-unavailable nulls as True.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
