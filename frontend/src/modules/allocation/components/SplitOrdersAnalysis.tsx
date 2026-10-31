import React, { useState } from 'react';
import {
  Split,
  Building2,
  Package,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { SplitOrderSummary } from '../../../types/allocation';

interface SplitOrdersAnalysisProps {
  splitOrders: SplitOrderSummary[];
  onSelectOrder?: (orderId: string) => void;
}

export const SplitOrdersAnalysis: React.FC<SplitOrdersAnalysisProps> = ({
  splitOrders,
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    splitOrders[0]?.order_id || null
  );

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  // Orders with line-level splitting (lines sliced across multiple nodes)
  const lineSplitOrderIds = new Set([
    'ORD-2026-005610',
    'ORD-2026-018321',
    'ORD-2026-019142',
    'ORD-2026-040246',
    'ORD-2026-047493',
  ]);

  return (
    <div className="space-y-6">
      {/* Informational Hero Card */}
      <Card className="bg-midnight-900 border-midnight-700">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-tactical-amber/15 border border-tactical-amber/30 text-tactical-amber">
                <Split className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-midnight-100 font-display">
                  Multi-Node Split Allocation Deep-Dive
                </h3>
                <p className="text-xs text-midnight-400 mt-0.5">
                  Exactly 11 orders out of 50,000 required split fulfillment across multiple warehouses due to inventory dispersion.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-midnight-950 border border-midnight-700 text-tactical-amber">
                6 Orders across 2 Nodes
              </span>
              <span className="px-2.5 py-1 rounded bg-midnight-950 border border-midnight-700 text-tactical-teal">
                5 Orders across 3 Nodes
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 text-xs text-midnight-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-tactical-cyan shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-midnight-100">Deterministic Engine Split Fallback Rule: </span>
              Single-node allocation was evaluated first for all distance-ranked nodes. When no individual warehouse had complete inventory coverage, the engine invoked transactional multi-node fallback, prioritizing warehouses already participating in the consignment to minimize parcel dispersion.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Split Orders List / Table */}
      <Card className="bg-midnight-900 border-midnight-700">
        <CardHeader className="pb-3 border-b border-midnight-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-midnight-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-tactical-teal" />
            All 11 Historical Split Consignments
          </CardTitle>
          <span className="text-xs font-mono text-midnight-400">
            Total Split Volume: 108 Units
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-midnight-800/80">
            {splitOrders.map((order) => {
              const isExpanded = expandedOrderId === order.order_id;
              const hasLineSplit = lineSplitOrderIds.has(order.order_id);

              return (
                <div key={order.order_id} className="transition-colors hover:bg-midnight-850/40">
                  {/* Row Header */}
                  <div
                    onClick={() => toggleExpand(order.order_id)}
                    className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-midnight-400 hover:text-midnight-100 p-0.5"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-tactical-teal" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-tactical-teal">
                            {order.order_id}
                          </span>
                          <Badge variant="amber" size="sm">
                            {order.allocated_node_count} Nodes
                          </Badge>
                          {hasLineSplit && (
                            <Badge variant="cyan" size="sm">
                              Line Sliced
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-midnight-400 mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {order.order_time.replace('T', ' ').substring(0, 19)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-tactical-teal" />
                            {order.destination_city} ({order.destination_zone_id})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs font-mono">
                      <div>
                        <span className="text-midnight-500 block text-[10px]">TOTAL UNITS</span>
                        <span className="font-bold text-tactical-cyan text-sm">
                          {order.total_units} units
                        </span>
                      </div>
                      <div>
                        <span className="text-midnight-500 block text-[10px]">LINE ITEMS</span>
                        <span className="font-bold text-midnight-200 text-sm">
                          {order.line_count} lines
                        </span>
                      </div>
                      <div>
                        <span className="text-midnight-500 block text-[10px]">ORDER TOTAL</span>
                        <span className="font-bold text-midnight-100 text-sm">
                          ₹{order.order_total_inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-midnight-500 block text-[10px]">SERVICE</span>
                        <span className="text-midnight-300">{order.requested_service}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Split Anatomy Drawer */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-2 bg-midnight-950/80 border-t border-midnight-800 space-y-4">
                      {/* Participating Fulfillment Nodes */}
                      <div>
                        <h4 className="text-xs font-semibold text-midnight-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-tactical-teal" />
                          Participating Fulfillment Centers ({order.participating_nodes.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {order.participating_nodes.map((node) => (
                            <div
                              key={node.node_id}
                              className="p-3 rounded-lg bg-midnight-900 border border-midnight-800 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-mono text-xs font-bold text-midnight-100 block">
                                  {node.node_name}
                                </span>
                                <span className="text-[11px] text-midnight-400">
                                  {node.city}, {node.state} ({node.node_id})
                                </span>
                              </div>
                              <div className="text-right font-mono">
                                <span className="text-xs font-bold text-tactical-teal block">
                                  {node.allocated_units} units
                                </span>
                                <span className="text-[10px] text-midnight-500">
                                  {node.line_count} line{node.line_count > 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Line Item Decision Trail */}
                      <div>
                        <h4 className="text-xs font-semibold text-midnight-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-tactical-cyan" />
                          Split Allocation Decisions ({order.decisions.length})
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-midnight-800 bg-midnight-900">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="border-b border-midnight-800 text-midnight-400 bg-midnight-950/60">
                                <th className="py-2 px-3">Line ID</th>
                                <th className="py-2 px-3">SKU ID</th>
                                <th className="py-2 px-3">SKU Description</th>
                                <th className="py-2 px-3 text-right">Allocated Qty</th>
                                <th className="py-2 px-3">Fulfillment Centre</th>
                                <th className="py-2 px-3">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-midnight-800/60">
                              {order.decisions.map((dec) => (
                                <tr key={dec.allocation_id} className="hover:bg-midnight-850/50">
                                  <td className="py-2 px-3 text-midnight-400">{dec.order_line_id}</td>
                                  <td className="py-2 px-3 text-tactical-cyan font-bold">{dec.sku_id}</td>
                                  <td className="py-2 px-3 text-midnight-300 max-w-[200px] truncate">
                                    {dec.sku_name}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-midnight-100">
                                    {dec.allocated_qty}
                                  </td>
                                  <td className="py-2 px-3 text-midnight-200">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-midnight-950 border border-midnight-700 text-[11px]">
                                      <Building2 className="w-3 h-3 text-tactical-teal" />
                                      {dec.city} ({dec.node_id})
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-midnight-400">{dec.allocation_date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {hasLineSplit && (
                        <div className="p-2.5 rounded bg-tactical-cyan/10 border border-tactical-cyan/20 text-xs text-tactical-cyan flex items-center gap-2">
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>
                            <strong>Line Item Slicing Identified:</strong> One or more individual SKU lines in this order had its quantity divided across multiple fulfillment nodes because no single warehouse held sufficient inventory for that SKU.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
