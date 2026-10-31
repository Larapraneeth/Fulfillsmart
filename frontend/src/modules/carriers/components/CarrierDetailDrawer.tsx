import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  Truck,
  MapPin,
  CheckCircle2,
  Layers,
  Search,
  ExternalLink,
  Package,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { StatCardSkeleton, TableSkeleton } from '../../../components/common/LoadingSkeleton';
import { ErrorState } from '../../../components/common/ErrorState';
import { useCarrierDetail } from '../../../api/queries/useCarriers';

export interface CarrierDetailDrawerProps {
  carrierId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToOrder?: (orderId: string) => void;
}

type DrawerTab = 'shipments' | 'service_levels' | 'zones';

export const CarrierDetailDrawer: React.FC<CarrierDetailDrawerProps> = ({
  carrierId,
  isOpen,
  onClose,
  onNavigateToOrder,
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('shipments');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');

  const { data: detailData, isLoading, isError, error, refetch } = useCarrierDetail(
    isOpen && carrierId ? carrierId : null
  );

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when drawer is open
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

  const carrier = detailData?.carrier;
  const serviceLevels = detailData?.service_levels || [];
  const coveredZones = detailData?.covered_zones || [];
  const recentShipments = detailData?.recent_shipments || [];

  const filteredShipments = useMemo(() => {
    if (!shipmentSearch.trim()) return recentShipments;
    const q = shipmentSearch.trim().toLowerCase();
    return recentShipments.filter(
      (s) =>
        s.shipment_id.toLowerCase().includes(q) ||
        s.order_id.toLowerCase().includes(q) ||
        s.destination_city.toLowerCase().includes(q) ||
        s.destination_zone_id.toLowerCase().includes(q)
    );
  }, [recentShipments, shipmentSearch]);

  const filteredZones = useMemo(() => {
    if (!zoneSearch.trim()) return coveredZones;
    const q = zoneSearch.trim().toLowerCase();
    return coveredZones.filter(
      (z) =>
        z.city.toLowerCase().includes(q) ||
        z.zone_name.toLowerCase().includes(q) ||
        z.delivery_zone_id.toLowerCase().includes(q) ||
        z.state.toLowerCase().includes(q)
    );
  }, [coveredZones, zoneSearch]);

  if (!isOpen) return null;

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
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-midnight-100 font-display">
                    {carrier ? carrier.carrier_name : carrierId}
                  </h2>
                  <Badge variant="teal" size="sm">
                    {carrierId}
                  </Badge>
                  {carrier?.supports_reverse_logistics && (
                    <Badge variant="emerald" size="sm">
                      Reverse Enabled
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-midnight-400 mt-0.5">
                  Operating cutoffs, transit commitments, and historical delivery records.
                </p>
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
                title="Failed to Load Carrier Profile"
                message={error instanceof Error ? error.message : 'Unknown network error.'}
                onRetry={() => refetch()}
              />
            )}

            {!isLoading && !isError && carrier && (
              <>
                {/* 4 Overview Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400">Total Shipments</div>
                    <div className="text-lg font-bold font-mono text-midnight-100 mt-0.5">
                      {carrier.shipment_count.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-tactical-teal mt-0.5 font-mono">
                      {((carrier.shipment_count / 49436) * 100).toFixed(1)}% network share
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400">On-Time Rate</div>
                    <div className="text-lg font-bold font-mono text-tactical-emerald mt-0.5">
                      {carrier.on_time_rate_pct.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-tactical-crimson mt-0.5 font-mono">
                      {carrier.delayed_shipments} delayed ({carrier.delay_rate_pct.toFixed(2)}%)
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400">Pickup Cutoff</div>
                    <div className="text-lg font-bold font-mono text-tactical-amber mt-0.5">
                      {carrier.pickup_cutoff_time}
                    </div>
                    <div className="text-[10px] text-midnight-400 mt-0.5 font-mono">
                      Window: {carrier.dispatch_window_start} – {carrier.dispatch_window_end}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-midnight-900 border border-midnight-800">
                    <div className="text-[11px] text-midnight-400">Zone Coverage</div>
                    <div className="text-lg font-bold font-mono text-tactical-cyan mt-0.5">
                      {carrier.covered_zones_count}{' '}
                      <span className="text-xs font-normal text-midnight-400">/ 50</span>
                    </div>
                    <div className="text-[10px] text-tactical-cyan mt-0.5 font-mono">
                      {((carrier.covered_zones_count / 50) * 100).toFixed(0)}% zone coverage
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-midnight-800 pb-2">
                  <button
                    onClick={() => setActiveTab('shipments')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'shipments'
                        ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30'
                        : 'text-midnight-400 hover:text-midnight-200'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Recent Consignments ({recentShipments.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('service_levels')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'service_levels'
                        ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30'
                        : 'text-midnight-400 hover:text-midnight-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Service Levels ({serviceLevels.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('zones')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === 'zones'
                        ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30'
                        : 'text-midnight-400 hover:text-midnight-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Covered Zones ({coveredZones.length})</span>
                  </button>
                </div>

                {/* Tab 1: Recent Consignments (50 Shipments) */}
                {activeTab === 'shipments' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-midnight-400">
                        Showing last {filteredShipments.length} consignments dispatched via {carrier.carrier_name}.
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-midnight-500" />
                        <input
                          type="text"
                          value={shipmentSearch}
                          onChange={(e) => setShipmentSearch(e.target.value)}
                          placeholder="Search shipment/order/city..."
                          className="pl-7 pr-2.5 py-1 rounded bg-midnight-900 border border-midnight-800 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-48"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-midnight-800 max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-midnight-900 border-b border-midnight-800 text-[11px] font-semibold text-midnight-400">
                          <tr>
                            <th className="py-2.5 px-3">Shipment & Order</th>
                            <th className="py-2.5 px-3">Origin Node</th>
                            <th className="py-2.5 px-3">Destination</th>
                            <th className="py-2.5 px-3">Dispatched / Promised</th>
                            <th className="py-2.5 px-3">Delivery Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-midnight-800/40 text-midnight-200 font-mono">
                          {filteredShipments.map((s) => (
                            <tr key={s.shipment_id} className="hover:bg-midnight-900/60 transition-colors">
                              <td className="py-2 px-3">
                                <div className="text-midnight-100 font-semibold">{s.shipment_id}</div>
                                <div className="text-[10px] text-tactical-teal flex items-center gap-1">
                                  <span>{s.order_id}</span>
                                  {onNavigateToOrder && (
                                    <button
                                      onClick={() => onNavigateToOrder(s.order_id)}
                                      className="text-tactical-teal hover:underline inline-flex items-center"
                                      title="Open order in Explorer"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="py-2 px-3">
                                <div className="text-midnight-200 font-sans">{s.node_city}</div>
                                <div className="text-[10px] text-midnight-500">{s.node_id}</div>
                              </td>

                              <td className="py-2 px-3">
                                <div className="text-midnight-200 font-sans">{s.destination_city}</div>
                                <div className="text-[10px] text-midnight-500">{s.destination_zone_id}</div>
                              </td>

                              <td className="py-2 px-3 text-[11px]">
                                <div>Disp: {s.dispatch_date}</div>
                                <div className="text-midnight-400">Prom: {s.promised_delivery_date}</div>
                              </td>

                              <td className="py-2 px-3">
                                {s.is_delayed ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-tactical-crimson/15 text-tactical-crimson border border-tactical-crimson/30">
                                    <span>Delayed ({s.delay_days}d)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-tactical-emerald/15 text-tactical-emerald border border-tactical-emerald/30">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>On-Time</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 2: Service Levels */}
                {activeTab === 'service_levels' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {serviceLevels.map((sl) => (
                        <div
                          key={sl.service_level_id}
                          className="p-3.5 rounded-lg bg-midnight-900 border border-midnight-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="teal" size="sm">
                              {sl.service_code}
                            </Badge>
                            <span className="text-[11px] font-mono text-midnight-400">
                              {sl.service_level_id}
                            </span>
                          </div>

                          <div className="font-semibold text-midnight-100 text-sm">
                            {sl.service_name}
                          </div>

                          <div className="text-xs text-midnight-400 font-mono space-y-1">
                            <div>Transit: {sl.nominal_transit_days} business days</div>
                            <div>Max Weight: {sl.max_weight_kg} kg</div>
                            <div>Volume: {sl.shipment_count.toLocaleString()} shipments</div>
                            <div>Delays: {sl.delayed_shipments}</div>
                          </div>

                          <div className="pt-1 border-t border-midnight-800">
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-midnight-400">Reliability</span>
                              <span className="text-tactical-emerald font-bold">
                                {sl.on_time_rate_pct.toFixed(2)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-midnight-950 overflow-hidden">
                              <div
                                className="h-full bg-tactical-emerald rounded-full"
                                style={{ width: `${sl.on_time_rate_pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Covered Delivery Zones */}
                {activeTab === 'zones' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-midnight-400">
                        {filteredZones.length} delivery zones covered by {carrier.carrier_name}.
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-midnight-500" />
                        <input
                          type="text"
                          value={zoneSearch}
                          onChange={(e) => setZoneSearch(e.target.value)}
                          placeholder="Search zone, city, state..."
                          className="pl-7 pr-2.5 py-1 rounded bg-midnight-900 border border-midnight-800 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-44"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                      {filteredZones.map((z) => (
                        <div
                          key={z.delivery_zone_id}
                          className="p-2.5 rounded-lg bg-midnight-900 border border-midnight-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-midnight-100 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-tactical-teal" />
                              <span>{z.city}</span>
                              <span className="text-[10px] font-mono text-midnight-400">
                                ({z.delivery_zone_id})
                              </span>
                            </div>
                            <div className="text-[10px] text-midnight-400 ml-4.5">
                              {z.state} · {z.region}
                            </div>
                          </div>

                          <div className="flex gap-1 text-[9px] font-mono">
                            {z.standard_available && (
                              <span className="px-1.5 py-0.5 rounded bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30">
                                STD
                              </span>
                            )}
                            {z.express_available && (
                              <span className="px-1.5 py-0.5 rounded bg-tactical-cyan/15 text-tactical-cyan border border-tactical-cyan/30">
                                EXP
                              </span>
                            )}
                            {z.same_day_available && (
                              <span className="px-1.5 py-0.5 rounded bg-tactical-amber/15 text-tactical-amber border border-tactical-amber/30">
                                SAME
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
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
