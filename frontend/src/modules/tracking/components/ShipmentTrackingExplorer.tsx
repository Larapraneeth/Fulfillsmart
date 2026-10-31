import React, { useState } from 'react';
import {
  Search,
  Filter,
  Package,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Split,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { TableSkeleton } from '../../../components/common/LoadingSkeleton';
import { ErrorState } from '../../../components/common/ErrorState';
import { useShipmentsPaginated } from '../../../api/queries/useTracking';
import { ShipmentsQueryParams } from '../../../types/tracking';

interface ShipmentTrackingExplorerProps {
  onSelectShipment: (shipmentId: string) => void;
  carriers: Array<{ carrier_id: string; carrier_name: string }>;
  nodes: Array<{ node_id: string; node_name: string }>;
}

export const ShipmentTrackingExplorer: React.FC<ShipmentTrackingExplorerProps> = ({
  onSelectShipment,
  carriers,
  nodes,
}) => {
  const [params, setParams] = useState<ShipmentsQueryParams>({
    page: 1,
    page_size: 20,
    search: '',
    carrier_id: 'ALL',
    node_id: 'ALL',
    is_delayed: -1,
    service_code: 'ALL',
  });

  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading, isError, error, refetch } = useShipmentsPaginated(params);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams((prev) => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setParams((prev) => ({ ...prev, search: '', page: 1 }));
  };

  const handleCarrierChange = (cid: string) => {
    setParams((prev) => ({ ...prev, carrier_id: cid, page: 1 }));
  };

  const handleNodeChange = (nid: string) => {
    setParams((prev) => ({ ...prev, node_id: nid, page: 1 }));
  };

  const handleDelayedChange = (val: number) => {
    setParams((prev) => ({ ...prev, is_delayed: val, page: 1 }));
  };

  const handleServiceChange = (code: string) => {
    setParams((prev) => ({ ...prev, service_code: code, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setParams((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setParams((prev) => ({ ...prev, page_size: newSize, page: 1 }));
  };

  const shipments = data?.items || [];
  const totalCount = data?.total_count || 0;
  const totalPages = data?.total_pages || 1;
  const currentPage = data?.page || 1;
  const pageSize = data?.page_size || 20;

  const startIdx = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIdx = Math.min(currentPage * pageSize, totalCount);

  return (
    <Card className="bg-midnight-900/90 border-midnight-700/80 shadow-xl">
      <CardHeader className="pb-3 border-b border-midnight-700/60">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-midnight-100 flex items-center gap-2">
                <span>Shipment Tracking Explorer</span>
                <Badge variant="teal" size="sm">
                  {totalCount.toLocaleString()} Total Records
                </Badge>
              </CardTitle>
              <p className="text-xs text-midnight-400 mt-0.5">
                Search and filter historical consignments, chronological event sequences, and split shipment packages.
              </p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search shipment, order, city..."
                  className="pl-8 pr-7 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-60"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-midnight-400 hover:text-midnight-200 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
              <Button type="submit" variant="outline" size="sm" className="text-xs border-midnight-700">
                Search
              </Button>
            </form>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-midnight-800/80">
            {/* Carrier Filter */}
            <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-midnight-400" />
              <select
                value={params.carrier_id || 'ALL'}
                onChange={(e) => handleCarrierChange(e.target.value)}
                className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value="ALL" className="bg-midnight-900">
                  All Carriers (10)
                </option>
                {carriers.map((c) => (
                  <option key={c.carrier_id} value={c.carrier_id} className="bg-midnight-900">
                    {c.carrier_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Node Filter */}
            <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
              <select
                value={params.node_id || 'ALL'}
                onChange={(e) => handleNodeChange(e.target.value)}
                className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value="ALL" className="bg-midnight-900">
                  All Origin Nodes (20)
                </option>
                {nodes.map((n) => (
                  <option key={n.node_id} value={n.node_id} className="bg-midnight-900">
                    {n.node_name} ({n.node_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Delay Status Filter */}
            <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
              <select
                value={params.is_delayed !== undefined ? params.is_delayed : -1}
                onChange={(e) => handleDelayedChange(Number(e.target.value))}
                className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value={-1} className="bg-midnight-900">
                  All Outcomes (49,436)
                </option>
                <option value={0} className="bg-midnight-900">
                  On-Time Only (48,308)
                </option>
                <option value={1} className="bg-midnight-900">
                  Delayed Only (1,128)
                </option>
              </select>
            </div>

            {/* Service Level Filter */}
            <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
              <select
                value={params.service_code || 'ALL'}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value="ALL" className="bg-midnight-900">
                  All Service Tiers
                </option>
                <option value="STANDARD" className="bg-midnight-900">
                  STANDARD (4 Days)
                </option>
                <option value="EXPRESS" className="bg-midnight-900">
                  EXPRESS (2 Days)
                </option>
                <option value="SAME_DAY" className="bg-midnight-900">
                  SAME_DAY (0 Days)
                </option>
              </select>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 ml-auto text-xs text-midnight-400">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="bg-midnight-950 border border-midnight-700 rounded px-2 py-1 text-midnight-100 focus:outline-none text-xs cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading && (
          <div className="p-4">
            <TableSkeleton rows={10} />
          </div>
        )}

        {isError && (
          <div className="p-6">
            <ErrorState
              title="Failed to Load Shipments"
              message={error instanceof Error ? error.message : 'Unable to query paginated shipments.'}
              onRetry={() => refetch()}
            />
          </div>
        )}

        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-midnight-700/60 bg-midnight-950/60 text-[11px] font-semibold text-midnight-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Shipment & Order</th>
                  <th className="py-3 px-3">Origin Node</th>
                  <th className="py-3 px-3">Destination</th>
                  <th className="py-3 px-3">Carrier & Tier</th>
                  <th className="py-3 px-3">Transit Schedule</th>
                  <th className="py-3 px-3">Delivery Outcome</th>
                  <th className="py-3 px-3 text-center">Lifecycle</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-800/40 text-xs text-midnight-200">
                {shipments.map((s) => {
                  let badgeVariant: 'teal' | 'cyan' | 'amber' = 'teal';
                  if (s.service_code === 'EXPRESS') badgeVariant = 'cyan';
                  if (s.service_code === 'SAME_DAY') badgeVariant = 'amber';

                  return (
                    <tr
                      key={s.shipment_id}
                      className="hover:bg-midnight-800/40 transition-colors cursor-pointer group"
                      onClick={() => onSelectShipment(s.shipment_id)}
                    >
                      {/* Shipment & Order */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-1.5 font-semibold text-midnight-100">
                          <Package className="w-3.5 h-3.5 text-tactical-teal" />
                          <span>{s.shipment_id}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-midnight-400 mt-0.5">
                          <span>{s.order_id}</span>
                          {s.is_split && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-sans font-semibold bg-tactical-amber/15 text-tactical-amber border border-tactical-amber/30">
                              <Split className="w-2.5 h-2.5" />
                              <span>Split</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Origin Node */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-midnight-100">{s.node_city}</div>
                        <div className="text-[10px] font-mono text-midnight-500">{s.node_id}</div>
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-midnight-200">
                          <MapPin className="w-3 h-3 text-tactical-cyan" />
                          <span>{s.destination_city}</span>
                        </div>
                        <div className="text-[10px] font-mono text-midnight-500">
                          {s.destination_zone_id}
                        </div>
                      </td>

                      {/* Carrier & Tier */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-midnight-100">{s.carrier_name}</div>
                        <div className="mt-0.5">
                          <Badge variant={badgeVariant} size="sm">
                            {s.service_code}
                          </Badge>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div>Disp: {s.dispatch_date}</div>
                        <div className="text-midnight-400">Prom: {s.promised_delivery_date}</div>
                        <div className="text-midnight-500 text-[10px]">
                          Act: {s.actual_delivery_date || '—'}
                        </div>
                      </td>

                      {/* Delivery Outcome */}
                      <td className="py-3 px-3 font-mono">
                        {s.is_delayed ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-tactical-crimson/15 text-tactical-crimson border border-tactical-crimson/30">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Delayed (+{s.delay_days}d)</span>
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-tactical-emerald/15 text-tactical-emerald border border-tactical-emerald/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>On-Time</span>
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-midnight-500 mt-0.5 font-sans">
                          {s.package_unit_count} units ({s.package_line_count} line)
                        </div>
                      </td>

                      {/* Lifecycle Events Count */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-midnight-950 text-tactical-cyan border border-midnight-700">
                          <Activity className="w-2.5 h-2.5" />
                          <span>{s.events_count} Events</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectShipment(s.shipment_id)}
                          className="text-xs text-tactical-teal hover:text-tactical-teal hover:bg-tactical-teal/10 flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {shipments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-midnight-400">
                      No historical shipments match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && !isError && totalCount > 0 && (
          <div className="p-3.5 border-t border-midnight-700/60 bg-midnight-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-midnight-400">
            <div>
              Showing <span className="font-mono text-midnight-200">{startIdx.toLocaleString()}</span> to{' '}
              <span className="font-mono text-midnight-200">{endIdx.toLocaleString()}</span> of{' '}
              <span className="font-mono text-midnight-200">{totalCount.toLocaleString()}</span> shipments
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="text-xs border-midnight-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                Previous
              </Button>

              <div className="font-mono text-xs px-2 text-midnight-200">
                Page {currentPage} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="text-xs border-midnight-700 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
