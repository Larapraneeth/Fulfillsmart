import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  GitFork,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

export interface OperationalInsightsPanelProps {
  carrierUnavailableOrders?: number;
  delayedOrders?: number;
  splitNodeOrders?: number;
  totalOrders?: number;
}

export function OperationalInsightsPanel({
  carrierUnavailableOrders = 579,
  delayedOrders = 1128,
  splitNodeOrders = 11,
  totalOrders = 50000,
}: OperationalInsightsPanelProps) {
  const navigate = useNavigate();

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader
        headerIcon={<AlertTriangle className="w-4 h-4 text-tactical-amber" />}
        subtitle="Exceptions Breakdown & Baseline Governance Telemetry"
        headerAction={
          <Badge variant="amber" size="sm">
            Audited Baseline
          </Badge>
        }
      >
        <CardTitle>Operational Exceptions & Governance</CardTitle>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Exception 1: Carrier Unavailability */}
        <div className="p-4 rounded-xl border border-tactical-crimson/30 bg-midnight-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-tactical-crimson/10 border border-tactical-crimson/30 text-tactical-crimson shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-midnight-100 font-display">
                  Carrier Unavailability Gaps
                </span>
                <Badge variant="crimson" size="sm">
                  {carrierUnavailableOrders.toLocaleString()} Orders
                </Badge>
              </div>
              <p className="text-xs text-midnight-400 font-sans leading-relaxed">
                Orders where requested service tier or destination zone exceeded active carrier coverage matrices or operating cutoffs.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/orders?status=CARRIER_UNAVAILABLE')}
            className="shrink-0 gap-1.5 text-xs font-mono border-tactical-crimson/30 text-midnight-200 hover:text-tactical-crimson"
          >
            <span>Inspect Orders</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>

        {/* Exception 2: Delayed Orders */}
        <div className="p-4 rounded-xl border border-tactical-amber/30 bg-midnight-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-tactical-amber/10 border border-tactical-amber/30 text-tactical-amber shrink-0 mt-0.5">
              <Clock className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-midnight-100 font-display">
                  Delayed Delivery Dispatches
                </span>
                <Badge variant="amber" size="sm">
                  {delayedOrders.toLocaleString()} Orders
                </Badge>
              </div>
              <p className="text-xs text-midnight-400 font-sans leading-relaxed">
                Shipments delivered past committed delivery promise date (2.28% delay rate across 49,436 historical dispatches).
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/orders?status=DELIVERED_LATE')}
            className="shrink-0 gap-1.5 text-xs font-mono border-tactical-amber/30 text-midnight-200 hover:text-tactical-amber"
          >
            <span>Inspect Delays</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>

        {/* Exception 3: Split Node Fulfillments */}
        <div className="p-4 rounded-xl border border-midnight-700 bg-midnight-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-tactical-cyan/10 border border-tactical-cyan/30 text-tactical-cyan shrink-0 mt-0.5">
              <GitFork className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-midnight-100 font-display">
                  Split Multi-Node Fulfillments
                </span>
                <Badge variant="cyan" size="sm">
                  {splitNodeOrders.toLocaleString()} Orders (0.022%)
                </Badge>
              </div>
              <p className="text-xs text-midnight-400 font-sans leading-relaxed">
                Multi-line orders whose SKU basket required cross-node inventory dispatch. 49,989 of {totalOrders.toLocaleString()} orders fulfilled from a single node.
              </p>
            </div>
          </div>

          <Badge variant="outline" size="sm" className="shrink-0 font-mono">
            49,989 Single-Node
          </Badge>
        </div>

        {/* Baseline Specificity Audit Governance */}
        <div className="p-4 rounded-xl border border-tactical-teal/20 bg-midnight-900/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-tactical-teal" aria-hidden="true" />
              <span className="text-xs font-semibold text-midnight-200 font-display uppercase tracking-wider">
                Clean Baseline Specificity Audit
              </span>
            </div>
            <Badge variant="teal" size="sm">Verified 0 FP</Badge>
          </div>

          <p className="text-xs text-midnight-400 font-sans leading-relaxed">
            247,061 baseline operational records audited across all 6 deterministic logistics rules with 0 false positive detections. Validates rule specificity on clean historical project data.
          </p>

          <div className="pt-2 border-t border-midnight-800 flex items-center justify-between">
            <span className="text-[11px] font-mono text-midnight-500">
              Note: Classifier metrics on synthetic defects are maintained in the Anomalies module.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/anomalies')}
              className="gap-1 text-xs text-tactical-teal hover:text-tactical-cyan p-0 h-auto font-mono"
            >
              <span>Anomalies Lab</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
