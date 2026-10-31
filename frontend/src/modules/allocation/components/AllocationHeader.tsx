import React from 'react';
import {
  CheckCircle2,
  Split,
  Building2,
  CalendarClock,
  Layers,
  Database,
  RefreshCw,
  Percent,
} from 'lucide-react';
import { Card, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { AllocationMetricsSummary } from '../../../types/allocation';

interface AllocationHeaderProps {
  summary?: AllocationMetricsSummary;
  isLoading: boolean;
  onRefresh: () => void;
}

export const AllocationHeader: React.FC<AllocationHeaderProps> = ({
  summary,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Banner: Module Identity & Operational Baseline Disclosure */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-midnight-900/90 border border-midnight-700/80 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-tactical-teal/10 border border-tactical-teal/20 text-tactical-teal">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-midnight-100 font-display">
                  Fulfillment Allocation Control Tower
                </h1>
                <Badge variant="teal" size="sm">
                  Phase 7 Active
                </Badge>
              </div>
              <p className="text-xs text-midnight-400 mt-0.5">
                Greedy single-node optimization, transactional split-node fallback, and capacity constraints across 20 fulfillment centers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700 text-xs font-mono text-tactical-cyan">
            <Database className="w-3.5 h-3.5 text-tactical-teal" />
            <span>Historical Baseline: 50,000 Orders</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 border-midnight-600 text-midnight-300 hover:text-midnight-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* 6 Key Operational KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Allocation Success Rate */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-emerald/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Success Rate</span>
              <CheckCircle2 className="w-4 h-4 text-tactical-emerald" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-emerald">
              {summary ? `${summary.allocation_success_rate_pct.toFixed(1)}%` : '---'}
            </div>
            <div className="text-[10px] text-midnight-400 mt-1 font-mono truncate">
              {summary ? `${summary.allocated_orders.toLocaleString()} / 50,000 orders` : 'Loading...'}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Single-Node Allocations */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-teal/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Single-Node</span>
              <Layers className="w-4 h-4 text-tactical-teal" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              {summary ? summary.single_node_orders.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-tactical-teal mt-1 font-mono">
              {summary ? `${summary.single_node_rate_pct.toFixed(2)}% | 233,457 units` : 'Loading...'}
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Split-Node Orders */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-amber/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Split-Node</span>
              <Split className="w-4 h-4 text-tactical-amber" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-amber">
              {summary ? summary.split_node_orders.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-midnight-400 mt-1 font-mono">
              {summary ? `${summary.split_node_rate_pct.toFixed(3)}% | 108 units` : 'Loading...'}
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Sunday Shifts */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-cyan/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Sunday Shifts</span>
              <CalendarClock className="w-4 h-4 text-tactical-cyan" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              {summary ? summary.sunday_orders_shifted.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-tactical-cyan mt-1 font-mono">
              Shifted to Monday
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Order Capacity Util */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-midnight-500 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Order Cap Util</span>
              <Percent className="w-4 h-4 text-midnight-300" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              {summary ? `${summary.warehouse_order_capacity_utilization_pct.toFixed(2)}%` : '---'}
            </div>
            <div className="text-[10px] text-midnight-400 mt-1 font-mono truncate">
              Across active node-days
            </div>
          </CardContent>
        </Card>

        {/* KPI 6: Unit Capacity Util */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-midnight-500 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Unit Cap Util</span>
              <Building2 className="w-4 h-4 text-midnight-300" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              {summary ? `${summary.warehouse_unit_capacity_utilization_pct.toFixed(2)}%` : '---'}
            </div>
            <div className="text-[10px] text-midnight-400 mt-1 font-mono truncate">
              Across active node-days
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
