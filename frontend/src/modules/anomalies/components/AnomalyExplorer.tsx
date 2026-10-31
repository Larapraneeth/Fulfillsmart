import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Package, 
  Truck, 
  Building2, 
  AlertCircle 
} from 'lucide-react';
import { Card, CardContent } from '../../../components/common/Card';
import { Badge, BadgeVariant } from '../../../components/common/Badge';
import { AnomalyExplorerItem } from '../../../types/anomalies';

interface AnomalyExplorerProps {
  items: AnomalyExplorerItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onInspect: (anomalyId: string) => void;
}

export const AnomalyExplorer: React.FC<AnomalyExplorerProps> = ({
  items,
  totalCount,
  page,
  pageSize,
  totalPages,
  hasNext,
  hasPrevious,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onInspect,
}) => {
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

  const getCategoryPill = (category: string) => {
    switch (category) {
      case 'CARRIER_UNAVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-tactical-crimson/15 text-tactical-crimson border border-tactical-crimson/30">
            Carrier Unavail
          </span>
        );
      case 'DELIVERY_DELAY':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-tactical-amber/15 text-tactical-amber border border-tactical-amber/30">
            Delivery Delay
          </span>
        );
      case 'SPLIT_ORDER_COMPLEXITY':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30">
            Split Fulfillment
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-midnight-800 text-midnight-300 border border-midnight-700">
            {category}
          </span>
        );
    }
  };

  return (
    <Card className="border-midnight-750 bg-midnight-900/80 overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-midnight-950/80 text-midnight-400 font-mono text-[11px] uppercase tracking-wider border-b border-midnight-750">
              <tr>
                <th className="py-3 px-4">Anomaly ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Node / Facility</th>
                <th className="py-3 px-4">Carrier & Service</th>
                <th className="py-3 px-4">Detected Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight-800/60 font-sans">
              {isLoading ? (
                [...Array(pageSize > 10 ? 10 : pageSize)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-4 w-28 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-midnight-800 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-6 w-16 bg-midnight-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-midnight-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-midnight-500" />
                      <span className="text-base font-semibold text-midnight-200">No matching anomalies found</span>
                      <p className="text-xs text-midnight-400 max-w-sm">
                        Try adjusting your search terms or relaxing category and severity filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.anomaly_id}
                    onClick={() => onInspect(item.anomaly_id)}
                    className="hover:bg-midnight-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Anomaly ID */}
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-midnight-100 group-hover:text-tactical-teal transition-colors">
                      {item.anomaly_id}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      {getCategoryPill(item.category)}
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-4">
                      <Badge variant={getSeverityBadgeVariant(item.severity)} size="sm">
                        {item.severity}
                      </Badge>
                    </td>

                    {/* Entity */}
                    <td className="py-3 px-4 font-mono text-xs text-midnight-200">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-midnight-400" />
                        <span>{item.entity_id}</span>
                      </div>
                    </td>

                    {/* Node */}
                    <td className="py-3 px-4 text-xs font-mono text-midnight-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-midnight-500" />
                        <span>{item.node_id || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Carrier & Service */}
                    <td className="py-3 px-4 text-xs text-midnight-300">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-midnight-500" />
                        <span className="font-mono">{item.carrier_id || 'NONE'}</span>
                        {item.service_level_id && (
                          <span className="text-[10px] text-midnight-400 font-mono">
                            ({item.service_level_id.replace('SL-', '').replace('-STANDARD', '').replace('-EXPRESS', '')})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-xs font-mono text-midnight-300">
                      {item.detected_date}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        item.status === 'UNRESOLVED'
                          ? 'bg-tactical-crimson/15 text-tactical-crimson border border-tactical-crimson/30'
                          : 'bg-tactical-emerald/15 text-tactical-emerald border border-tactical-emerald/30'
                      }`}>
                        {item.status === 'UNRESOLVED' ? 'Blocked' : 'Delivered'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspect(item.anomaly_id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-midnight-800 text-midnight-200 hover:text-midnight-50 hover:bg-tactical-teal/20 border border-midnight-700 hover:border-tactical-teal/40 text-xs font-medium transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="p-3.5 bg-midnight-950/70 border-t border-midnight-750 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-midnight-400 font-mono">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 rounded bg-midnight-900 border border-midnight-700 text-midnight-200 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-midnight-500">|</span>
            <span>
              Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPrevious || isLoading}
              className="p-1.5 rounded-lg border border-midnight-700 bg-midnight-900 text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-midnight-200 bg-midnight-900/60 rounded border border-midnight-800">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNext || isLoading}
              className="p-1.5 rounded-lg border border-midnight-700 bg-midnight-900 text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
