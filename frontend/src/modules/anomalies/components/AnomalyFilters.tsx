import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { AnomalyQueryParams } from '../../../types/anomalies';

interface AnomalyFiltersProps {
  filters: AnomalyQueryParams;
  onFilterChange: (newFilters: Partial<AnomalyQueryParams>) => void;
  onReset: () => void;
  totalMatches: number;
}

export const AnomalyFilters: React.FC<AnomalyFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
  totalMatches,
}) => {
  const isFiltered = Boolean(
    (filters.search && filters.search.trim().length > 0) ||
    (filters.category && filters.category !== 'ALL') ||
    (filters.severity && filters.severity !== 'ALL') ||
    (filters.status && filters.status !== 'ALL')
  );

  return (
    <div className="p-4 rounded-xl bg-midnight-900/80 border border-midnight-750 space-y-3">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-midnight-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Anomaly ID, Order ID, Shipment ID, City, Node..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-midnight-950 border border-midnight-700/80 text-sm text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal/60 focus:ring-1 focus:ring-tactical-teal/30 transition-all font-mono"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-midnight-400 hidden sm:inline">Category:</span>
            <select
              value={filters.category || 'ALL'}
              onChange={(e) => onFilterChange({ category: e.target.value, page: 1 })}
              className="px-2.5 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700/80 text-xs text-midnight-200 focus:outline-none focus:border-tactical-teal/60 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="CARRIER_UNAVAILABLE">Carrier Assignment Failures (579)</option>
              <option value="DELIVERY_DELAY">Delivery Delay Deviations (1,128)</option>
              <option value="SPLIT_ORDER_COMPLEXITY">Split-Order Complexities (11)</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-midnight-400 hidden sm:inline">Severity:</span>
            <select
              value={filters.severity || 'ALL'}
              onChange={(e) => onFilterChange({ severity: e.target.value, page: 1 })}
              className="px-2.5 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700/80 text-xs text-midnight-200 focus:outline-none focus:border-tactical-teal/60 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL (579)</option>
              <option value="HIGH">HIGH (376)</option>
              <option value="MEDIUM">MEDIUM (387)</option>
              <option value="LOW">LOW (376)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-midnight-400 hidden sm:inline">Status:</span>
            <select
              value={filters.status || 'ALL'}
              onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}
              className="px-2.5 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700/80 text-xs text-midnight-200 focus:outline-none focus:border-tactical-teal/60 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNRESOLVED">Unresolved / Blocked (580)</option>
              <option value="DELIVERED_HISTORICAL">Delivered Historical (1,138)</option>
            </select>
          </div>

          {/* Reset Button */}
          {isFiltered && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-midnight-300 hover:text-midnight-100 bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 transition-all"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Match indicator */}
      <div className="flex items-center justify-between text-xs text-midnight-400 font-mono pt-1 border-t border-midnight-800/80">
        <div>
          Showing matches: <strong className="text-midnight-100">{totalMatches.toLocaleString()}</strong> records
        </div>
        <div className="flex items-center gap-2">
          <span>Sort:</span>
          <select
            value={`${filters.sort_by || 'detected_date'}_${filters.sort_order || 'desc'}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('_');
              onFilterChange({ sort_by: sb as any, sort_order: so as any, page: 1 });
            }}
            className="px-2 py-0.5 rounded bg-midnight-950 border border-midnight-700 text-xs text-midnight-300 focus:outline-none"
          >
            <option value="detected_date_desc">Detected Date (Newest)</option>
            <option value="detected_date_asc">Detected Date (Oldest)</option>
            <option value="severity_asc">Severity (Critical First)</option>
            <option value="severity_desc">Severity (Low First)</option>
            <option value="anomaly_id_asc">Anomaly ID (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
