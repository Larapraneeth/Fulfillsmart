import { useEffect, useRef, useState } from 'react';
import {
  X,
  Package,
  Boxes,
  Truck,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Building2,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { LoadingSkeleton } from '../../../components/common/LoadingSkeleton';
import { ErrorState } from '../../../components/common/ErrorState';
import {
  useOrderDetail,
  useOrderTrackingHistory,
  useOrderAllocationHistory,
} from '../../../api/queries/useOrders';
import { useNetworkTopology } from '../../../api/queries/useNetworkTopology';

export interface OrderDetailDrawerProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
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

export function OrderDetailDrawer({ orderId, isOpen, onClose }: OrderDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries
  const {
    data: order,
    isLoading: isOrderLoading,
    isError: isOrderError,
    error: orderError,
    refetch: refetchOrder,
  } = useOrderDetail(isOpen ? orderId : null);

  const {
    data: tracking,
    isLoading: isTrackingLoading,
  } = useOrderTrackingHistory(isOpen ? orderId : null);

  const {
    data: allocation,
    isLoading: isAllocationLoading,
  } = useOrderAllocationHistory(isOpen ? orderId : null);

  // Query network topology to translate node_id to human-friendly warehouse title and city
  const { data: topology } = useNetworkTopology();
  const nodeMap = new Map<string, { name: string; city: string }>();
  if (topology?.nodes) {
    for (const n of topology.nodes) {
      nodeMap.set(n.node_id, { name: n.node_name, city: n.city });
    }
  }

  // Accessibility: Focus management, body overflow lock, Escape listener
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';

      // Focus close button on open
      const focusTimer = setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }

        // Focus trap inside drawer
        if (e.key === 'Tab' && drawerRef.current) {
          const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(focusTimer);
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        if (previouslyFocusedElement.current) {
          previouslyFocusedElement.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !orderId) {
    return null;
  }

  const handleCopy = async (text: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const deliveryOutcome = tracking?.delivery_outcome;
  const outcomeStatus = deliveryOutcome?.delivery_outcome_status;
  const isCarrierUnavailable = outcomeStatus === 'CARRIER_UNAVAILABLE';
  const shipments = tracking?.shipments ?? [];
  const trackingEvents = tracking?.tracking_events ?? [];
  const isSplitNode = allocation?.summary.allocation_type === 'SPLIT_NODE';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-midnight-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Shell */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-drawer-title"
          aria-describedby="order-drawer-subtitle"
          className="w-screen max-w-2xl bg-midnight-900 border-l border-midnight-700 shadow-2xl flex flex-col relative"
        >
          {/* ================================================================= */}
          {/* SECTION 1: ORDER HEADER */}
          {/* ================================================================= */}
          <div className="px-6 py-4 bg-midnight-950 border-b border-midnight-700 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-tactical-teal font-mono text-base font-bold tracking-tight">
                  {orderId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(orderId)}
                  className="text-midnight-400 hover:text-midnight-100 p-1 rounded focus:outline-none focus:ring-1 focus:ring-tactical-teal/50"
                  title="Copy Order ID"
                  aria-label={`Copy order ID ${orderId}`}
                >
                  {copiedId === orderId ? (
                    <Check className="w-3.5 h-3.5 text-tactical-emerald" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Delivery Outcome Status Badge */}
                {outcomeStatus === 'DELIVERED_ON_TIME' ? (
                  <Badge variant="emerald" size="sm" pulse className="gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-tactical-emerald" />
                    Delivered On-Time
                  </Badge>
                ) : outcomeStatus === 'DELIVERED_LATE' ? (
                  <Badge variant="amber" size="sm" className="gap-1 font-mono">
                    <Clock className="w-3 h-3 text-tactical-amber" />
                    Delivered Late
                  </Badge>
                ) : outcomeStatus === 'CARRIER_UNAVAILABLE' ? (
                  <Badge variant="crimson" size="sm" className="gap-1 font-mono">
                    <AlertTriangle className="w-3 h-3 text-tactical-crimson" />
                    Carrier Unavailable
                  </Badge>
                ) : (
                  <Badge variant="outline" size="sm" className="font-mono">
                    {outcomeStatus || 'Outcome Pending'}
                  </Badge>
                )}
              </div>

              <p id="order-drawer-subtitle" className="text-xs text-midnight-400 font-mono mt-1">
                Customer: <span className="text-midnight-200">{order?.customer_id ?? '...'}</span> · Placed:{' '}
                <span className="text-midnight-200">{formatTimestamp(order?.order_time)}</span>
              </p>
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-tactical-teal/50 transition-colors shrink-0"
              title="Close Drawer (Escape)"
              aria-label="Close Order Detail Drawer"
            >
              <X className="w-5 h-5" />
            </button>

          </div>

          {/* ================================================================= */}
          {/* DRAWER BODY (SCROLLABLE) */}
          {/* ================================================================= */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 focus:outline-none">
            {isOrderError ? (
              <ErrorState
                title="Unable to Retrieve Order Detail"
                message={orderError instanceof Error ? orderError.message : 'An error occurred while fetching order details.'}
                onRetry={() => refetchOrder()}
              />
            ) : isOrderLoading || !order ? (
              <div className="space-y-4">
                <LoadingSkeleton className="h-28 w-full rounded-xl" />
                <LoadingSkeleton className="h-44 w-full rounded-xl" />
                <LoadingSkeleton className="h-40 w-full rounded-xl" />
              </div>
            ) : (
              <>
                {/* ============================================================= */}
                {/* SECTION 2: ORDER METADATA */}
                {/* ============================================================= */}
                <div className="bg-midnight-950 p-4 rounded-xl border border-midnight-700/80 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-midnight-300 font-mono flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-tactical-teal" />
                    Destination & Order Configuration
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-midnight-500 block text-[10px] uppercase">Destination</span>
                      <span className="text-midnight-100 font-semibold">{order.destination_city}, {order.destination_state}</span>
                      <span className="text-midnight-400 block text-[11px] font-mono">PIN: {order.destination_pincode}</span>
                    </div>

                    <div>
                      <span className="text-midnight-500 block text-[10px] uppercase">Delivery Zone</span>
                      <span className="text-midnight-200">{order.destination_zone_id}</span>
                      <span className="text-midnight-400 block text-[11px] truncate" title={order.zone_name}>
                        {order.zone_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-midnight-500 block text-[10px] uppercase">Service & Priority</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="teal" size="sm" className="font-mono text-[10px]">
                          {order.requested_service}
                        </Badge>
                        <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                          {order.order_priority}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="text-midnight-500 block text-[10px] uppercase">Order Value</span>
                      <span className="text-tactical-teal font-bold text-sm block">
                        {inrFormatter.format(order.order_total_inr)}
                      </span>
                      {order.order_channel && (
                        <span className="text-midnight-400 block text-[10px]">
                          Channel: {order.order_channel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* SECTION 3: SKU LINE ITEMS */}
                {/* ============================================================= */}
                <div className="bg-midnight-950 p-4 rounded-xl border border-midnight-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-midnight-300 font-mono flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-tactical-cyan" />
                      SKU Line Items ({order.total_lines} lines · {order.total_units} units)
                    </h3>
                    <span className="text-xs font-mono text-tactical-cyan font-semibold">
                      Total: {inrFormatter.format(order.order_total_inr)}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-midnight-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-midnight-900 border-b border-midnight-800 text-midnight-400 text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">SKU Identifier & Name</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3 text-right">Weight</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-midnight-850">
                        {order.lines.map((l) => (
                          <tr key={l.order_line_id} className="hover:bg-midnight-900/60 transition-colors">
                            <td className="py-2 px-3 text-midnight-500">{l.line_number}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="text-tactical-teal font-semibold block">{l.sku_id}</span>
                              <span className="text-midnight-300 font-sans text-[11px] block">{l.sku_name}</span>
                            </td>
                            <td className="py-2 px-3 text-midnight-400">{l.sku_category}</td>
                            <td className="py-2 px-3 text-right text-midnight-400">{l.unit_weight_kg.toFixed(2)} kg</td>
                            <td className="py-2 px-3 text-center font-bold text-midnight-100">{l.quantity}</td>
                            <td className="py-2 px-3 text-right text-midnight-300">{inrFormatter.format(l.unit_price_inr)}</td>
                            <td className="py-2 px-3 text-right font-semibold text-midnight-100">
                              {inrFormatter.format(l.line_total_inr)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* SECTION 4: ALLOCATION DETAILS */}
                {/* ============================================================= */}
                <div className="bg-midnight-950 p-4 rounded-xl border border-midnight-700/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-midnight-300 font-mono flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-tactical-indigoLight" />
                      Fulfillment Node Allocations
                    </h3>

                    {allocation?.summary && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isSplitNode ? 'indigo' : 'teal'}
                          size="sm"
                          className="font-mono text-[10px]"
                        >
                          {isSplitNode ? `SPLIT ALLOCATION (${allocation.summary.allocated_node_count} Nodes)` : 'SINGLE NODE'}
                        </Badge>
                        <Badge variant="emerald" size="sm" className="font-mono text-[10px]">
                          {allocation.summary.allocation_status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {isAllocationLoading ? (
                    <LoadingSkeleton className="h-20 w-full rounded-lg" />
                  ) : allocation?.decisions && allocation.decisions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {allocation.decisions.map((d) => {
                          const nodeInfo = nodeMap.get(d.node_id);
                          return (
                            <div
                              key={d.allocation_id}
                              className="p-2.5 rounded-lg bg-midnight-900 border border-midnight-800 flex items-center justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3 h-3 text-tactical-teal shrink-0" />
                                  <span className="font-semibold text-midnight-100 truncate">
                                    {nodeInfo?.city ? `${nodeInfo.city} FC` : d.node_id}
                                  </span>
                                </div>
                                <span className="text-[10px] text-midnight-400 block mt-0.5">
                                  {d.node_id} · SKU: {d.sku_id}
                                </span>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <Badge variant="outline" size="sm" className="font-mono text-tactical-teal">
                                  {d.allocated_qty} units
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-xs font-mono text-midnight-400 bg-midnight-900 rounded-lg">
                      No allocation decisions found for this order.
                    </div>
                  )}
                </div>

                {/* ============================================================= */}
                {/* SECTION 5: SHIPMENTS & CONSIGNMENTS */}
                {/* ============================================================= */}
                <div className="bg-midnight-950 p-4 rounded-xl border border-midnight-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-midnight-300 font-mono flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-tactical-amber" />
                      Shipments & Consignments ({shipments.length})
                    </h3>
                  </div>

                  {isTrackingLoading ? (
                    <LoadingSkeleton className="h-24 w-full rounded-lg" />
                  ) : isCarrierUnavailable || shipments.length === 0 ? (
                    /* EDGE CASE C: Carrier Unavailable - zero shipments explanation */
                    <div className="p-4 rounded-lg bg-tactical-crimson/10 border border-tactical-crimson/30 space-y-2">
                      <div className="flex items-center gap-2 text-tactical-crimson font-mono text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Carrier Unavailable — Zero Consignments Dispatched</span>
                      </div>
                      <p className="text-xs text-midnight-300 font-sans leading-relaxed">
                        In the historical fulfillment pipeline, this order was successfully allocated to warehouse inventory,
                        but no contracted delivery carrier had active service-zone coverage or cutoff availability for this route.
                        As recorded by the system, <strong className="text-midnight-100 font-mono">0 shipments</strong> were generated
                        and no carrier consignments exist.
                      </p>
                      <div className="inline-flex gap-2 pt-1 font-mono text-[10px]">
                        <Badge variant="crimson" size="sm">Confirmed: 0 Shipments</Badge>
                        <Badge variant="outline" size="sm">Zero Tracking Events</Badge>
                      </div>
                    </div>
                  ) : (
                    /* Shipments Cards (Cases A & B) */
                    <div className="space-y-3">
                      {shipments.map((s, idx) => {
                        const originNode = nodeMap.get(s.node_id);
                        const isDelayed = Boolean(s.is_delayed);

                        return (
                          <div
                            key={s.shipment_id}
                            className="p-3.5 rounded-lg bg-midnight-900 border border-midnight-800 space-y-2.5"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className="text-tactical-teal font-bold">{s.shipment_id}</span>
                                <Badge variant="outline" size="sm" className="text-[10px]">
                                  Parcel #{idx + 1}
                                </Badge>
                                {isDelayed ? (
                                  <Badge variant="amber" size="sm" className="text-[10px]">
                                    Delayed ({s.delay_days} {s.delay_days === 1 ? 'day' : 'days'})
                                  </Badge>
                                ) : (
                                  <Badge variant="emerald" size="sm" className="text-[10px]">
                                    On Schedule
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="default" size="sm" className="text-[10px] font-mono">
                                {s.shipment_status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono border-t border-midnight-800 pt-2 text-midnight-400">
                              <div>
                                <span className="text-midnight-500 block text-[9px] uppercase">Origin Node</span>
                                <span className="text-midnight-200 font-semibold">
                                  {originNode?.city ? `${originNode.city} FC` : s.node_id}
                                </span>
                              </div>

                              <div>
                                <span className="text-midnight-500 block text-[9px] uppercase">Carrier</span>
                                <span className="text-midnight-200 font-semibold">{s.carrier_id}</span>
                                <span className="text-midnight-400 block text-[10px]">{s.service_level_id}</span>
                              </div>

                              <div>
                                <span className="text-midnight-500 block text-[9px] uppercase">Consignment</span>
                                <span className="text-midnight-200">
                                  {s.package_line_count} line · {s.package_unit_count} units
                                </span>
                              </div>

                              <div>
                                <span className="text-midnight-500 block text-[9px] uppercase">Timeline</span>
                                <span className="text-midnight-300 block">
                                  Promised: <strong className="text-midnight-100">{s.promised_delivery_date}</strong>
                                </span>
                                <span className="text-midnight-300 block">
                                  Actual: <strong className={isDelayed ? 'text-tactical-amber' : 'text-tactical-emerald'}>{s.actual_delivery_date}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ============================================================= */}
                {/* SECTION 6: TRACKING TIMELINE */}
                {/* ============================================================= */}
                <div className="bg-midnight-950 p-4 rounded-xl border border-midnight-700/80 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-midnight-300 font-mono flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-tactical-teal" />
                    Tracking Timeline ({trackingEvents.length} events)
                  </h3>

                  {isTrackingLoading ? (
                    <LoadingSkeleton className="h-20 w-full rounded-lg" />
                  ) : trackingEvents.length === 0 ? (
                    <div className="p-3 text-xs font-mono text-midnight-400 bg-midnight-900 rounded-lg text-center">
                      No tracking events recorded for this order.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-midnight-700">
                      {trackingEvents.map((evt) => (
                        <div key={evt.tracking_event_id} className="relative">
                          {/* Dot */}
                          <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-midnight-950 bg-tactical-teal flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-midnight-950" />
                          </div>

                          <div className="bg-midnight-900 p-2.5 rounded-lg border border-midnight-800 text-xs font-mono space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="font-semibold text-tactical-teal">
                                #{evt.event_sequence} · {evt.event_type}
                              </span>
                              <span className="text-[10px] text-midnight-400">
                                {formatTimestamp(evt.event_timestamp)}
                              </span>
                            </div>

                            <p className="text-midnight-300 font-sans text-xs">
                              {evt.event_description || 'Operational tracking event.'}
                            </p>

                            <div className="text-[10px] text-midnight-400 pt-0.5">
                              Location: <span className="text-midnight-200">{evt.event_location}</span> · Shipment:{' '}
                              <span className="text-midnight-300">{evt.shipment_id}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
