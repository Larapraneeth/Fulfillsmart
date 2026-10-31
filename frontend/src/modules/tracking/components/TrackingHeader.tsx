import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  Database,
  RefreshCw,
  Building2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { TrackingOverviewSummary } from '../../../types/tracking';

interface TrackingHeaderProps {
  summary?: TrackingOverviewSummary;
  isLoading: boolean;
  onRefresh: () => void;
}

export const TrackingHeader: React.FC<TrackingHeaderProps> = ({
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
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-midnight-100 font-display">
                  Shipment Tracking & Delivery Intelligence
                </h1>
                <Badge variant="teal" size="sm">
                  Phase 9 Active
                </Badge>
              </div>
              <p className="text-xs text-midnight-400 mt-0.5">
                Historical parcel tracking lifecycles, contiguous event sequencing, multi-shipment order rollups, and delay distributions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700 text-xs font-mono text-tactical-cyan">
            <Database className="w-3.5 h-3.5 text-tactical-teal" />
            <span>Historical Baseline: Jan 1 – Oct 31, 2026</span>
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
        {/* KPI 1: Total Shipments */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-teal/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Dispatched Shipments</span>
              <Layers className="w-4 h-4 text-tactical-teal" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              {summary ? summary.total_shipments.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-midnight-400 mt-1 font-mono truncate">
              Across 49,421 assigned orders
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Total Tracking Events */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-cyan/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Tracking Events</span>
              <Activity className="w-4 h-4 text-tactical-cyan" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-cyan">
              {summary ? summary.total_tracking_events.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-tactical-cyan mt-1 font-mono truncate">
              100% contiguous scans
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: On-Time Delivery Rate */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-emerald/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">On-Time Rate</span>
              <CheckCircle2 className="w-4 h-4 text-tactical-emerald" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-emerald">
              {summary ? `${summary.shipment_on_time_rate_pct.toFixed(2)}%` : '---'}
            </div>
            <div className="text-[10px] text-tactical-emerald mt-1 font-mono truncate">
              {summary ? `${summary.on_time_shipments.toLocaleString()} on-time` : 'Loading...'}
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Delayed Shipments */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-crimson/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Delayed Shipments</span>
              <Clock className="w-4 h-4 text-tactical-crimson" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-crimson">
              {summary ? summary.delayed_shipments.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-tactical-crimson mt-1 font-mono truncate">
              {summary ? `${summary.shipment_delay_rate_pct.toFixed(2)}% delay rate` : 'Loading...'}
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Carrier Unavailable */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-tactical-amber/40 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Carrier Unavailable</span>
              <ShieldAlert className="w-4 h-4 text-tactical-amber" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-amber">
              {summary ? summary.carrier_unavailable_orders.toLocaleString() : '---'}
            </div>
            <div className="text-[10px] text-tactical-amber mt-1 font-mono truncate">
              {summary ? `${summary.carrier_unavailable_rate_pct.toFixed(3)}% of 50K orders` : 'Loading...'}
            </div>
          </CardContent>
        </Card>

        {/* KPI 6: Network Scope */}
        <Card className="bg-midnight-900/70 border-midnight-700/60 hover:border-midnight-500 transition-colors">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1.5">
              <span className="text-xs font-medium">Network Scope</span>
              <Building2 className="w-4 h-4 text-midnight-300" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              10 / 20 / 50
            </div>
            <div className="text-[10px] text-midnight-400 mt-1 font-mono truncate">
              Carriers / Nodes / Zones
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Explicit Telemetry Notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-midnight-950/80 border border-midnight-700/50 text-xs text-midnight-400">
        <AlertTriangle className="w-4 h-4 text-tactical-amber shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-midnight-200">Historical Tracking Provenance:</strong> Tracking milestones and timestamps represent verified historical baseline scans across the 49,436 consignments (all terminal delivered status). FulfillSmart strictly preserves historical record integrity—no simulated live GPS positions, estimated vehicle breadcrumbs, or real-time carrier status updates are claimed or synthesized.
        </div>
      </div>
    </div>
  );
};
