import React from 'react';
import { ShieldAlert, Info, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';

interface AnomaliesHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const AnomaliesHeader: React.FC<AnomaliesHeaderProps> = ({
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Banner Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-tactical-crimson/10 border border-tactical-crimson/30 text-tactical-crimson">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-midnight-50 font-display tracking-tight">
                  Anomaly Intelligence & Audit Radar
                </h1>
                <Badge variant="crimson" size="sm">
                  Phase 10
                </Badge>
              </div>
              <p className="text-sm text-midnight-400 mt-0.5">
                Forensic tracking of historical operational exceptions, delivery delay deviations, and the 6 deterministic business rules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-midnight-800 text-midnight-300 hover:text-midnight-100 hover:bg-midnight-700/80 border border-midnight-700 transition-all disabled:opacity-50"
              title="Refresh anomaly metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-tactical-teal' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tactical-emerald/10 border border-tactical-emerald/30 text-tactical-emerald text-xs font-mono font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>247,061 Clean Records / 0 FP</span>
          </div>
        </div>
      </div>

      {/* Historical Baseline Disclosure Banner */}
      <div className="p-3.5 rounded-xl bg-midnight-900/90 border border-midnight-700/70 flex items-start gap-3 shadow-inner">
        <Info className="w-4 h-4 text-tactical-teal shrink-0 mt-0.5" />
        <div className="text-xs text-midnight-300 space-y-1">
          <div className="font-semibold text-midnight-100 flex items-center gap-2">
            <span>Historical Baseline Forensic Audit (Jan–Nov 2026)</span>
            <span className="text-[10px] text-midnight-400 font-mono">50,000 Orders | 49,436 Dispatched Parcels</span>
          </div>
          <p className="text-midnight-400 leading-relaxed">
            All anomaly classifications reflect verified historical database records or documented deterministic business-rule classifications.
            Order-level exceptions (579 carrier unfulfillable orders) and shipment-level deviations (1,128 delayed parcels across 1d/2d/3d SLAs)
            are tracked with strict denominator separation. Clean operational audit verifies zero false positives across production baseline tables.
          </p>
        </div>
      </div>
    </div>
  );
};
