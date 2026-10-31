import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  ArrowUpDown,
  Layers,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { NodeAllocationSummary } from '../../../types/allocation';

interface WarehouseAllocationTableProps {
  nodes: NodeAllocationSummary[];
}

type SortField = 'allocated_units' | 'allocated_orders' | 'network_volume_share_pct' | 'order_utilization_pct' | 'unit_utilization_pct' | 'city';
type SortDirection = 'asc' | 'desc';

export const WarehouseAllocationTable: React.FC<WarehouseAllocationTableProps> = ({ nodes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('allocated_units');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedNodes = useMemo(() => {
    return nodes
      .filter((node) => {
        const query = searchTerm.toLowerCase().trim();
        return (
          node.node_id.toLowerCase().includes(query) ||
          node.node_name.toLowerCase().includes(query) ||
          node.city.toLowerCase().includes(query) ||
          node.state.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          return sortDirection === 'asc'
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }

        return sortDirection === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [nodes, searchTerm, sortField, sortDirection]);

  return (
    <div className="space-y-6">
      {/* Search & Overview Banner */}
      <Card className="bg-midnight-900 border-midnight-700">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-tactical-teal/10 border border-tactical-teal/20 text-tactical-teal">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-midnight-100 font-display">
                  Fulfillment Node Volume & Capacity Distribution
                </h3>
                <p className="text-xs text-midnight-400 mt-0.5">
                  Historical order volumes, allocated units, and actual capacity utilization across all 20 fulfillment centers.
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by city, state, or node ID..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700 text-xs text-midnight-100 placeholder:text-midnight-500 focus:outline-none focus:border-tactical-teal font-sans"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 text-xs text-midnight-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-tactical-teal shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-midnight-100">Regional Distribution: </span>
              Volume is distributed across 20 nationwide fulfillment centers based on order delivery proximity. Eastern hubs (Kolkata: 24,578 units, Patna: 20,701 units) and Northern hubs (Delhi: 16,836 units, Lucknow: 16,446 units) lead network volume.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nodes Table */}
      <Card className="bg-midnight-900 border-midnight-700">
        <CardHeader className="pb-3 border-b border-midnight-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-midnight-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-tactical-teal" />
            All 20 Fulfillment Centers
          </CardTitle>
          <span className="text-xs font-mono text-midnight-400">
            Showing {filteredAndSortedNodes.length} of {nodes.length} nodes
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-midnight-800 text-midnight-400 bg-midnight-950/60">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-midnight-200"
                    onClick={() => handleSort('city')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Fulfillment Center & Location</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-midnight-200"
                    onClick={() => handleSort('allocated_orders')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Orders</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-midnight-200"
                    onClick={() => handleSort('allocated_units')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Units</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-midnight-200"
                    onClick={() => handleSort('network_volume_share_pct')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Network Volume Share</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-midnight-200"
                    onClick={() => handleSort('order_utilization_pct')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Order Util %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-midnight-200"
                    onClick={() => handleSort('unit_utilization_pct')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Unit Util %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-800/60">
                {filteredAndSortedNodes.map((node) => (
                  <tr key={node.node_id} className="hover:bg-midnight-850/60 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-tactical-teal shrink-0" />
                        <div>
                          <div className="font-bold text-midnight-100 font-sans">
                            {node.city} ({node.state})
                          </div>
                          <div className="text-[11px] text-midnight-400 font-mono">
                            {node.node_id} • {node.node_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-midnight-100">
                      {node.allocated_orders.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-tactical-cyan">
                      {node.allocated_units.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-1 w-32">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-tactical-teal font-bold">{node.network_volume_share_pct.toFixed(2)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-midnight-950 overflow-hidden">
                          <div
                            className="h-full bg-tactical-teal rounded-full"
                            style={{ width: `${Math.min(node.network_volume_share_pct * 7, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-mono font-bold ${
                          node.order_utilization_pct > 4.5
                            ? 'text-tactical-amber'
                            : 'text-tactical-emerald'
                        }`}
                      >
                        {node.order_utilization_pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-midnight-200">
                        {node.unit_utilization_pct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
