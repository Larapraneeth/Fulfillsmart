import React from 'react';
import { 
  X, 
  ShieldAlert, 
  Database, 
  Truck, 
  Clock, 
  AlertTriangle, 
  Layers 
} from 'lucide-react';
import { Badge, BadgeVariant } from '../../../components/common/Badge';
import { useAnomalyDetail } from '../../../api/queries/useAnomalies';

interface AnomalyDetailDrawerProps {
  anomalyId: string | null;
  onClose: () => void;
}

export const AnomalyDetailDrawer: React.FC<AnomalyDetailDrawerProps> = ({
  anomalyId,
  onClose,
}) => {
  const { data: detail, isLoading, error } = useAnomalyDetail(anomalyId);

  if (!anomalyId) return null;

  const getSeverityBadgeVariant = (severity: string): BadgeVariant => {
    switch (severity) {
      case 'CRITICAL':
        return 'crimson';
      case 'HIGH':
        return 'amber';
      case 'MEDIUM':
        return 'teal';
      default:
        return 'default';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-midnight-950/75 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-midnight-900 border-l border-midnight-750 shadow-2xl flex flex-col h-full transform transition-transform duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-midnight-750 bg-midnight-950/80 flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-midnight-100">
                {anomalyId}
              </span>
              {detail && (
                <Badge variant={getSeverityBadgeVariant(detail.severity)} size="sm">
                  {detail.severity}
                </Badge>
              )}
            </div>
            <h2 className="text-base font-semibold text-midnight-100">
              {detail ? detail.title : 'Loading anomaly record...'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 transition-colors"
            title="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 rounded-xl bg-midnight-800/60" />
              <div className="h-32 rounded-xl bg-midnight-800/60" />
              <div className="h-48 rounded-xl bg-midnight-800/60" />
            </div>
          ) : error || !detail ? (
            <div className="p-6 rounded-xl bg-tactical-crimson/10 border border-tactical-crimson/30 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-tactical-crimson mx-auto" />
              <div className="text-sm font-semibold text-midnight-100">Failed to load anomaly details</div>
              <p className="text-xs text-midnight-400 font-mono">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
            </div>
          ) : (
            <>
              {/* Rule Classification Disclosure */}
              <div className="p-4 rounded-xl bg-midnight-950 border border-midnight-750 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-tactical-teal font-mono uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-tactical-teal" />
                  <span>Rule-Based Classification & Verification</span>
                </div>
                <div className="text-xs text-midnight-300 leading-relaxed space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-midnight-400">Classification Rule:</span>
                    <span className="text-midnight-100 font-medium">{detail.severity_rule}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-midnight-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3 text-tactical-teal" />
                      Source Table: <strong className="text-midnight-200">{detail.source_table}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-tactical-emerald">{detail.verification_type}</span>
                  </div>
                </div>
              </div>

              {/* Primary Evidence Section */}
              <div className="p-4 rounded-xl bg-midnight-950/80 border border-midnight-750 space-y-3">
                <h3 className="text-xs font-semibold text-midnight-300 uppercase tracking-wider font-mono">
                  Primary Forensic Evidence
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-midnight-900 border border-midnight-800">
                    <span className="text-midnight-400 text-[11px]">Entity Type / ID</span>
                    <div className="font-mono font-medium text-midnight-100 mt-0.5">
                      {detail.entity_type}: {detail.entity_id}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-midnight-900 border border-midnight-800">
                    <span className="text-midnight-400 text-[11px]">Parent Order</span>
                    <div className="font-mono font-medium text-tactical-teal mt-0.5">
                      {detail.order_id}
                    </div>
                  </div>

                  {detail.shipment_id && (
                    <div className="p-2.5 rounded bg-midnight-900 border border-midnight-800">
                      <span className="text-midnight-400 text-[11px]">Shipment Parcel</span>
                      <div className="font-mono font-medium text-midnight-100 mt-0.5">
                        {detail.shipment_id}
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded bg-midnight-900 border border-midnight-800">
                    <span className="text-midnight-400 text-[11px]">Detected Date</span>
                    <div className="font-mono font-medium text-midnight-100 mt-0.5">
                      {detail.detected_date}
                    </div>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="p-3 rounded-lg bg-midnight-900/60 border border-midnight-800/80 text-xs text-midnight-300 leading-relaxed font-sans">
                  <strong className="text-midnight-100">Forensic Explanation: </strong>
                  {detail.explanation}
                </div>
              </div>

              {/* Category-Specific Related Records */}
              {/* 1. CARRIER_UNAVAILABLE related records */}
              {detail.category === 'CARRIER_UNAVAILABLE' && (
                <div className="p-4 rounded-xl bg-midnight-950/80 border border-midnight-750 space-y-3">
                  <h3 className="text-xs font-semibold text-midnight-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-tactical-crimson" />
                    <span>Unfulfillable Order Forensic Breakdown</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Exception Code</span>
                      <div className="font-mono text-tactical-crimson font-medium text-xs">
                        {detail.evidence.exception_code}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Requested Service</span>
                      <div className="font-mono text-midnight-100 font-medium text-xs">
                        {detail.evidence.requested_service}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Destination City / State</span>
                      <div className="text-midnight-100 font-medium text-xs">
                        {detail.evidence.destination_city}, {detail.evidence.destination_state} ({detail.evidence.destination_zone_id})
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Order Value</span>
                      <div className="font-mono text-tactical-emerald font-medium text-xs">
                        ₹{Number(detail.evidence.order_total_inr || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Allocation lines */}
                  {detail.related_entities.allocations && detail.related_entities.allocations.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-mono text-midnight-400 block mb-1.5">
                        Inventory Allocated Prior to Carrier Failure:
                      </span>
                      <div className="space-y-1">
                        {detail.related_entities.allocations.map((a: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded bg-midnight-900 text-xs font-mono">
                            <span className="text-midnight-300">{a.node_id}</span>
                            <span className="text-midnight-400">{a.sku_id}</span>
                            <span className="text-tactical-teal">{a.allocated_qty} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. DELIVERY_DELAY related records */}
              {detail.category === 'DELIVERY_DELAY' && (
                <div className="p-4 rounded-xl bg-midnight-950/80 border border-midnight-750 space-y-3">
                  <h3 className="text-xs font-semibold text-midnight-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-tactical-amber" />
                    <span>Delivery SLA Deviation & Timeline</span>
                  </h3>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Dispatch Date</span>
                      <div className="font-mono text-midnight-200 text-xs mt-0.5">
                        {detail.evidence.dispatch_date}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Promised SLA</span>
                      <div className="font-mono text-tactical-teal text-xs mt-0.5">
                        {detail.evidence.promised_delivery_date}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Actual Delivered</span>
                      <div className="font-mono text-tactical-amber text-xs mt-0.5 font-bold">
                        {detail.evidence.actual_delivery_date} (+{detail.evidence.delay_days}d)
                      </div>
                    </div>
                  </div>

                  {/* Tracking Events Timeline */}
                  {detail.related_entities.tracking_events && detail.related_entities.tracking_events.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-mono text-midnight-400 block mb-2">
                        Tracking Events Forensic Chain:
                      </span>
                      <div className="space-y-2 border-l-2 border-midnight-700 pl-3 ml-1.5">
                        {detail.related_entities.tracking_events.map((ev: any) => {
                          const isDelayEvent = ev.event_type === 'DELAYED';
                          return (
                            <div key={ev.tracking_event_id} className="relative text-xs space-y-0.5">
                              <div className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                                isDelayEvent
                                  ? 'bg-tactical-amber border-midnight-950'
                                  : 'bg-tactical-teal border-midnight-950'
                              }`} />
                              <div className="flex items-center gap-2 font-mono">
                                <span className={`font-semibold ${isDelayEvent ? 'text-tactical-amber' : 'text-midnight-200'}`}>
                                  {ev.event_type}
                                </span>
                                <span className="text-[10px] text-midnight-400">
                                  {ev.event_timestamp}
                                </span>
                              </div>
                              <p className="text-midnight-400 text-[11px]">
                                {ev.event_description} ({ev.event_location})
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. SPLIT_ORDER_COMPLEXITY related records */}
              {detail.category === 'SPLIT_ORDER_COMPLEXITY' && (
                <div className="p-4 rounded-xl bg-midnight-950/80 border border-midnight-750 space-y-3">
                  <h3 className="text-xs font-semibold text-midnight-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-tactical-teal" />
                    <span>Split Fulfillment Coordination Details</span>
                  </h3>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Fulfillment Nodes</span>
                      <div className="font-mono text-tactical-teal text-xs mt-0.5 font-bold">
                        {detail.evidence.allocated_node_count} Warehouses
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Total Order Units</span>
                      <div className="font-mono text-midnight-100 text-xs mt-0.5">
                        {detail.evidence.total_units} units
                      </div>
                    </div>
                    <div className="p-2 rounded bg-midnight-900">
                      <span className="text-midnight-400 text-[10px]">Outcome Status</span>
                      <div className="font-mono text-tactical-emerald text-xs mt-0.5">
                        {detail.evidence.delivery_outcome_status}
                      </div>
                    </div>
                  </div>

                  {/* Constituent Shipments */}
                  {detail.related_entities.shipments && detail.related_entities.shipments.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-mono text-midnight-400 block mb-1.5">
                        Constituent Parcel Dispatches ({detail.related_entities.shipments.length}):
                      </span>
                      <div className="space-y-1.5">
                        {detail.related_entities.shipments.map((s: any) => (
                          <div key={s.shipment_id} className="p-2 rounded bg-midnight-900 text-xs font-mono flex items-center justify-between">
                            <span className="text-midnight-200">{s.shipment_id}</span>
                            <span className="text-midnight-400">{s.node_id}</span>
                            <span className="text-tactical-teal">{s.carrier_id}</span>
                            <span className="text-tactical-emerald">Delivered</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-midnight-750 bg-midnight-950/80 flex items-center justify-between shrink-0">
          <span className="text-xs text-midnight-400 font-mono">
            {detail?.verification_type || 'Verified Historical Data'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-midnight-800 text-midnight-200 hover:text-midnight-50 hover:bg-midnight-700 transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
