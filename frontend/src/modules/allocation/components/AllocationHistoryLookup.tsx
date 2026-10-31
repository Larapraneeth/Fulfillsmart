import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Split,
  Tag,
  Info,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAllocationHistory } from '../../../api/queries/useAllocation';

export const AllocationHistoryLookup: React.FC = () => {
  const [searchInput, setSearchInput] = useState('ORD-2026-000001');
  const [activeOrderId, setActiveOrderId] = useState('ORD-2026-000001');

  const { data: historyData, isLoading, isError, error } = useAllocationHistory(activeOrderId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveOrderId(searchInput.trim().toUpperCase());
    }
  };

  const handleSelectPreset = (orderId: string) => {
    setSearchInput(orderId);
    setActiveOrderId(orderId);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar & Quick Presets */}
      <Card className="bg-midnight-900 border-midnight-700">
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Order ID (e.g. ORD-2026-000001 or ORD-2026-019142)..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-midnight-950 border border-midnight-700 text-sm text-midnight-100 placeholder:text-midnight-500 focus:outline-none focus:border-tactical-teal font-mono"
              />
            </div>
            <Button type="submit" variant="primary" size="md" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Query Allocation</span>
            </Button>
          </form>

          {/* Quick-Load Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-midnight-800 text-xs">
            <span className="text-midnight-400 flex items-center gap-1 font-medium">
              <Tag className="w-3.5 h-3.5 text-tactical-teal" />
              Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => handleSelectPreset('ORD-2026-000001')}
              className="px-2.5 py-1 rounded bg-midnight-800 hover:bg-midnight-750 border border-midnight-700 text-midnight-300 hover:text-tactical-teal font-mono transition-colors"
            >
              Single-Node (ORD-2026-000001)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('ORD-2026-000007')}
              className="px-2.5 py-1 rounded bg-midnight-800 hover:bg-midnight-750 border border-midnight-700 text-midnight-300 hover:text-tactical-cyan font-mono transition-colors"
            >
              Sunday Shifted (ORD-2026-000007)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('ORD-2026-019142')}
              className="px-2.5 py-1 rounded bg-midnight-800 hover:bg-midnight-750 border border-midnight-700 text-midnight-300 hover:text-tactical-amber font-mono transition-colors"
            >
              3-Node Split (ORD-2026-019142)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('ORD-2026-005610')}
              className="px-2.5 py-1 rounded bg-midnight-800 hover:bg-midnight-750 border border-midnight-700 text-midnight-300 hover:text-tactical-amber font-mono transition-colors"
            >
              Line-Split (ORD-2026-005610)
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Query Result Section */}
      {isLoading ? (
        <Card className="bg-midnight-900 border-midnight-700 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-tactical-teal mx-auto mb-3" />
          <p className="text-sm text-midnight-400 font-mono">
            Querying allocation records for {activeOrderId}...
          </p>
        </Card>
      ) : isError ? (
        <Card className="bg-midnight-900 border-tactical-crimson/50 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-tactical-crimson mx-auto mb-2" />
          <h3 className="text-base font-bold text-midnight-100 font-display">
            Historical Record Not Found
          </h3>
          <p className="text-sm text-midnight-400 mt-1 max-w-md mx-auto">
            {(error as Error)?.message || `No allocation decision record found for order ${activeOrderId}.`}
          </p>
        </Card>
      ) : historyData ? (
        <div className="space-y-4">
          {/* Allocation Summary Card */}
          <Card className="bg-midnight-900 border-midnight-700">
            <CardHeader className="pb-3 border-b border-midnight-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-midnight-400">Order:</span>
                  <span className="font-mono text-base font-bold text-tactical-teal">
                    {historyData.summary.order_id}
                  </span>
                  <Badge
                    variant={historyData.summary.allocation_status === 'ALLOCATED' ? 'emerald' : 'crimson'}
                    size="sm"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                    {historyData.summary.allocation_status}
                  </Badge>
                  <Badge
                    variant={historyData.summary.allocation_type === 'SINGLE_NODE' ? 'teal' : 'amber'}
                    size="sm"
                  >
                    {historyData.summary.allocation_type === 'SINGLE_NODE' ? (
                      <Layers className="w-3 h-3 mr-1 inline" />
                    ) : (
                      <Split className="w-3 h-3 mr-1 inline" />
                    )}
                    {historyData.summary.allocation_type}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-midnight-300">
                    <span className="text-midnight-500 mr-1.5">Nodes:</span>
                    <span className="font-bold text-midnight-100">
                      {historyData.summary.allocated_node_count}
                    </span>
                  </div>
                  <div className="text-midnight-300">
                    <span className="text-midnight-500 mr-1.5">Total Units:</span>
                    <span className="font-bold text-tactical-cyan">
                      {historyData.summary.total_units}
                    </span>
                  </div>
                  <div className="text-midnight-300">
                    <span className="text-midnight-500 mr-1.5">Decisions:</span>
                    <span className="font-bold text-midnight-100">
                      {historyData.decisions.length}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <h4 className="text-xs font-semibold text-midnight-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-tactical-teal" />
                Line-Item Allocation Decisions ({historyData.decisions.length})
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-midnight-800 text-midnight-400">
                      <th className="py-2.5 px-3">Allocation ID</th>
                      <th className="py-2.5 px-3">Order Line</th>
                      <th className="py-2.5 px-3">SKU ID</th>
                      <th className="py-2.5 px-3 text-right">Allocated Qty</th>
                      <th className="py-2.5 px-3">Assigned Node</th>
                      <th className="py-2.5 px-3">Allocation Date</th>
                      <th className="py-2.5 px-3">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight-800/60">
                    {historyData.decisions.map((dec) => (
                      <tr key={dec.allocation_id} className="hover:bg-midnight-850/60 transition-colors">
                        <td className="py-2.5 px-3 text-midnight-300">{dec.allocation_id}</td>
                        <td className="py-2.5 px-3 text-midnight-400">{dec.order_line_id}</td>
                        <td className="py-2.5 px-3 text-tactical-cyan font-bold">{dec.sku_id}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-midnight-100">
                          {dec.allocated_qty}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-midnight-950 border border-midnight-700 text-midnight-200">
                            <Building2 className="w-3 h-3 text-tactical-teal" />
                            {dec.node_id}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-midnight-300">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-midnight-400" />
                            {dec.allocation_date}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              dec.allocation_type === 'SINGLE_NODE'
                                ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30'
                                : 'bg-tactical-amber/15 text-tactical-amber border border-tactical-amber/30'
                            }`}
                          >
                            {dec.allocation_type}
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
      ) : null}
    </div>
  );
};
