import React, { useEffect, useRef } from 'react';
import {
  X,
  Package,
  MapPin,
  Clock,
  Split,
  Truck,
  ExternalLink,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { StatCardSkeleton, TableSkeleton } from '../../../components/common/LoadingSkeleton';
import { ErrorState } from '../../../components/common/ErrorState';
import { useShipmentDetail } from '../../../api/queries/useTracking';

export interface ShipmentDetailDrawerProps {
  shipmentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectShipment: (shipmentId: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

export const ShipmentDetailDrawer: React.FC<ShipmentDetailDrawerProps> = ({
  shipmentId,
  isOpen,
  onClose,
  onSelectShipment,
  onNavigateToOrder,
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const { data: detailData, isLoading, isError, error, refetch } = useShipmentDetail(
    isOpen && shipmentId ? shipmentId : null
  );

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const shipment = detailData?.shipment;
  const events = detailData?.tracking_events || [];
  const parentOrder = detailData?.parent_order;
  const deliveryOutcome = detailData?.delivery_outcome;
  const siblingShipments = detailData?.sibling_shipments || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-midnight-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-2xl bg-midnight-950 border-l border-midnight-700/80 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-midnight-700/80 bg-midnight-900/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-tactical-teal/10 border border-tactical-teal/30 flex items-center justify-center text-tactical-teal font-mono font-bold">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-midnight-100 font-display">
                    {shipment ? shipment.shipment_id : shipmentId}
                  </h2>
                  {shipment && (
                    <Badge variant={shipment.is_delayed ? 'crimson' : 'emerald'} size="sm">
                      {shipment.is_delayed ? `Delayed (+${shipment.delay_days}d)` : 'On-Time'}
                    </Badge>
                  )}
                  {shipment?.is_split && (
                    <Badge variant="amber" size="sm">
                      Split Order
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-midnight-400 mt-0.5 flex items-center gap-2">
                  <span>Parent Order:</span>
                  <span className="font-mono text-tactical-teal">
                    {shipment ? shipment.order_id : '---'}
                  </span>
                  {shipment && onNavigateToOrder && (
                    <button
                      onClick={() => onNavigateToOrder(shipment.order_id)}
                      className="text-tactical-teal hover:underline inline-flex items-center gap-0.5"
                      title="Open in Orders Explorer"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </div>
                <TableSkeleton rows={5} />
              </div>
            )}

            {isError && (
              <ErrorState
                title="Failed to Load Shipment Detail"
                message={error instanceof Error ? error.message : 'Unknown network error.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && shipment && (
              <>
                {/* 4 Metadata Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-tactical-teal" />
                      <span>Carrier & Tier</span>
                    </div>
                    <div className="font-semibold text-midnight-100 text-xs mt-1">
                      {shipment.carrier_name}
                    </div>
                    <div className="text-[10px] text-tactical-cyan font-mono mt-0.5">
                      {shipment.service_code} ({shipment.service_level_id})
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-tactical-teal" />
                      <span>Origin Node</span>
                    </div>
                    <div className="font-semibold text-midnight-100 text-xs mt-1">
                      {shipment.node_city}
                    </div>
                    <div className="text-[10px] text-midnight-500 font-mono mt-0.5">
                      {shipment.node_id}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-tactical-cyan" />
                      <span>Destination</span>
                    </div>
                    <div className="font-semibold text-midnight-100 text-xs mt-1">
                      {shipment.destination_city}
                    </div>
                    <div className="text-[10px] text-midnight-500 font-mono mt-0.5">
                      {shipment.destination_zone_id}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-tactical-amber" />
                      <span>Schedule Dates</span>
                    </div>
                    <div className="text-[11px] font-mono text-midnight-100 mt-1">
                      Disp: {shipment.dispatch_date}
                    </div>
                    <div className="text-[10px] text-midnight-400 font-mono">
                      Prom: {shipment.promised_delivery_date}
                    </div>
                    <div className="text-[10px] text-tactical-emerald font-mono">
                      Act: {shipment.actual_delivery_date}
                    </div>
                  </div>
                </div>

                {/* Sibling Shipments for Split Orders */}
                {siblingShipments.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-tactical-amber/5 border border-tactical-amber/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-tactical-amber">
                        <Split className="w-4 h-4" />
                        <span>Split Order Multi-Consignment Timeline</span>
                      </div>
                      <Badge variant="amber" size="sm">
                        {siblingShipments.length + 1} Total Packages
                      </Badge>
                    </div>
                    <p className="text-[11px] text-midnight-400 leading-relaxed">
                      This order was fulfilled across multiple fulfillment centers. Each consignment was dispatched as an independent shipment with its own tracking lifecycle:
                    </p>

                    <div className="space-y-1.5">
                      {siblingShipments.map((sib) => (
                        <div
                          key={sib.shipment_id}
                          className="p-2 rounded-lg bg-midnight-950 border border-midnight-800 flex items-center justify-between text-xs"
                        >
                          <div className="font-mono">
                            <span className="font-semibold text-midnight-100">{sib.shipment_id}</span>
                            <span className="text-midnight-500 ml-2">from {sib.node_city}</span>
                            <span className="text-midnight-400 ml-2">via {sib.carrier_name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={sib.is_delayed ? 'crimson' : 'emerald'} size="sm">
                              {sib.is_delayed ? `Delayed (+${sib.delay_days}d)` : 'On-Time'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectShipment(sib.shipment_id)}
                              className="text-[11px] text-tactical-teal hover:bg-tactical-teal/10 py-0.5 px-2 h-auto"
                            >
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chronological Tracking Event Timeline */}
                <div className="p-4 rounded-xl bg-midnight-900 border border-midnight-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-midnight-800 pb-2">
                    <h3 className="text-xs font-semibold text-midnight-100 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-tactical-teal" />
                      <span>Tracking Event Lifecycle ({events.length} Events)</span>
                    </h3>
                    <span className="text-[11px] font-mono text-tactical-cyan">
                      Contiguous Audit Trail
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-4 pt-1">
                    {/* Vertical connecting line */}
                    <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-midnight-700" />

                    {events.map((evt) => {
                      let dotColor = 'bg-tactical-teal border-midnight-950';
                      let typeColor = 'text-tactical-teal';
                      if (evt.event_type === 'DELAYED') {
                        dotColor = 'bg-tactical-crimson border-midnight-950';
                        typeColor = 'text-tactical-crimson';
                      } else if (evt.event_type === 'DELIVERED') {
                        dotColor = 'bg-tactical-emerald border-midnight-950';
                        typeColor = 'text-tactical-emerald';
                      }

                      return (
                        <div key={evt.tracking_event_id} className="relative">
                          {/* Dot */}
                          <div
                            className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 ${dotColor} flex items-center justify-center`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-midnight-950" />
                          </div>

                          <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 text-xs space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-1 font-mono">
                              <span className={`font-semibold ${typeColor}`}>
                                #{evt.event_sequence} · {evt.event_type}
                              </span>
                              <span className="text-[10px] text-midnight-400">
                                {formatTimestamp(evt.event_timestamp)}
                              </span>
                            </div>

                            <p className="text-midnight-300 font-sans text-xs">
                              {evt.event_description}
                            </p>

                            <div className="text-[10px] text-midnight-400 pt-0.5 font-mono">
                              Scan Location: <span className="text-midnight-200">{evt.event_location}</span> · Event ID:{' '}
                              <span className="text-midnight-400">{evt.tracking_event_id}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Parent Order Metadata & Delivery Outcome */}
                {parentOrder && (
                  <div className="p-4 rounded-xl bg-midnight-900 border border-midnight-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-midnight-800 pb-2">
                      <h3 className="text-xs font-semibold text-midnight-100 uppercase tracking-wider flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-tactical-teal" />
                        <span>Parent Order Overview</span>
                      </h3>
                      {deliveryOutcome && (
                        <Badge
                          variant={
                            deliveryOutcome.delivery_outcome_status === 'DELIVERED_ON_TIME'
                              ? 'emerald'
                              : 'crimson'
                          }
                          size="sm"
                        >
                          {deliveryOutcome.delivery_outcome_status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-midnight-300 pt-1 font-mono">
                      <div>
                        Customer ID: <span className="text-midnight-100">{parentOrder.customer_id}</span>
                      </div>
                      <div>
                        Order Priority: <span className="text-midnight-100">{parentOrder.order_priority}</span>
                      </div>
                      <div>
                        Destination: <span className="text-midnight-100">{parentOrder.destination_city}, {parentOrder.destination_state}</span>
                      </div>
                      <div>
                        Order Value:{' '}
                        <span className="text-tactical-emerald font-semibold">
                          {inrFormatter.format(parentOrder.order_total_inr)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
