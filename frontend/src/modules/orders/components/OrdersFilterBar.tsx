import { useState, useEffect, useRef } from 'react';
import { Search, X, Filter, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { OrderFilterParams } from '../../../types/orders';
import { useNetworkTopology } from '../../../api/queries/useNetworkTopology';

export interface OrdersFilterBarProps {
  filters: OrderFilterParams;
  onFilterChange: (newFilters: Partial<OrderFilterParams>) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

const CARRIER_OPTIONS = [
  { id: 'CAR-001', name: 'BlueDart' },
  { id: 'CAR-002', name: 'Delhivery' },
  { id: 'CAR-003', name: 'DTDC' },
  { id: 'CAR-004', name: 'Ecom Express' },
  { id: 'CAR-005', name: 'Xpressbees' },
  { id: 'CAR-006', name: 'India Post' },
  { id: 'CAR-007', name: 'Shadowfax' },
  { id: 'CAR-008', name: 'Ekart' },
  { id: 'CAR-009', name: 'Amazon Shipping' },
  { id: 'CAR-010', name: 'Professional Couriers' },
];

export function OrdersFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  isLoading = false,
}: OrdersFilterBarProps) {
  // Query 20 warehouse nodes from topology hook
  const { data: topology } = useNetworkTopology();
  const nodes = topology?.nodes ?? [];

  // Local state for 300ms debounced search
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const isFirstRender = useRef(true);

  // Sync external search filter changes (e.g. after reset)
  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  // Debounce search input by 300ms
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if ((filters.search || '') !== searchInput.trim()) {
        onFilterChange({ search: searchInput.trim(), page: 1 });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  // Calculate active filter count
  const activeFilterCount = [
    Boolean(filters.search && filters.search.trim()),
    Boolean(filters.status && filters.status !== 'ALL'),
    Boolean(filters.carrierId && filters.carrierId !== 'ALL'),
    Boolean(filters.nodeId && filters.nodeId !== 'ALL'),
    Boolean(filters.orderPriority && filters.orderPriority !== 'ALL'),
    Boolean(filters.requestedService && filters.requestedService !== 'ALL'),
    Boolean(filters.destinationZoneId && filters.destinationZoneId !== 'ALL'),
  ].filter(Boolean).length;

  return (
    <div className="bg-midnight-900 border border-midnight-700/80 rounded-xl p-3.5 space-y-3">
      {/* Row 1: Search and Primary Quick Actions */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            id="orders-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Order ID (e.g. ORD-2026-019) or Customer ID (e.g. CUST-010)..."
            aria-label="Search orders by order ID or customer ID prefix"
            className="w-full pl-9 pr-9 py-2 bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/70 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded-lg text-xs font-mono text-midnight-100 placeholder:text-midnight-500 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                onFilterChange({ search: '', page: 1 });
              }}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-midnight-500 hover:text-midnight-200 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-tactical-teal/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Summary & Reset Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeFilterCount > 0 ? (
            <Badge variant="teal" size="sm" className="gap-1 font-mono">
              <Filter className="w-3 h-3" />
              {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
            </Badge>
          ) : (
            <Badge variant="outline" size="sm" className="text-midnight-500 font-mono">
              All 50,000 orders
            </Badge>
          )}

          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              disabled={isLoading}
              className="text-xs font-mono gap-1.5 h-8 border-midnight-700 hover:bg-midnight-800 text-midnight-300"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3 h-3 text-tactical-amber" />
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Backend-Supported Filter Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-midnight-800">
        {/* Delivery Outcome Status */}
        <div className="space-y-1">
          <label htmlFor="filter-status" className="block text-[10px] font-mono uppercase tracking-wider text-midnight-400">
            Delivery Status
          </label>
          <select
            id="filter-status"
            value={filters.status || 'ALL'}
            onChange={(e) => onFilterChange({ status: e.target.value === 'ALL' ? undefined : e.target.value, page: 1 })}
            className="w-full bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/60 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-midnight-200 transition-colors"
          >
            <option value="ALL">All Outcomes</option>
            <option value="DELIVERED_ON_TIME">Delivered On-Time (48,293)</option>
            <option value="DELIVERED_LATE">Delivered Late (1,128)</option>
            <option value="CARRIER_UNAVAILABLE">Carrier Unavailable (579)</option>
          </select>
        </div>

        {/* Carrier */}
        <div className="space-y-1">
          <label htmlFor="filter-carrier" className="block text-[10px] font-mono uppercase tracking-wider text-midnight-400">
            Assigned Carrier
          </label>
          <select
            id="filter-carrier"
            value={filters.carrierId || 'ALL'}
            onChange={(e) => onFilterChange({ carrierId: e.target.value === 'ALL' ? undefined : e.target.value, page: 1 })}
            className="w-full bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/60 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-midnight-200 transition-colors"
          >
            <option value="ALL">All Carriers (10)</option>
            {CARRIER_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>

        {/* Fulfillment Node */}
        <div className="space-y-1">
          <label htmlFor="filter-node" className="block text-[10px] font-mono uppercase tracking-wider text-midnight-400">
            Fulfillment Node
          </label>
          <select
            id="filter-node"
            value={filters.nodeId || 'ALL'}
            onChange={(e) => onFilterChange({ nodeId: e.target.value === 'ALL' ? undefined : e.target.value, page: 1 })}
            className="w-full bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/60 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-midnight-200 transition-colors"
          >
            <option value="ALL">All 20 Warehouses</option>
            {nodes.map((n) => (
              <option key={n.node_id} value={n.node_id}>
                {n.city} ({n.node_id})
              </option>
            ))}
          </select>
        </div>

        {/* Priority Tier */}
        <div className="space-y-1">
          <label htmlFor="filter-priority" className="block text-[10px] font-mono uppercase tracking-wider text-midnight-400">
            Order Priority
          </label>
          <select
            id="filter-priority"
            value={filters.orderPriority || 'ALL'}
            onChange={(e) => onFilterChange({ orderPriority: e.target.value === 'ALL' ? undefined : e.target.value, page: 1 })}
            className="w-full bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/60 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-midnight-200 transition-colors"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">HIGH Priority</option>
            <option value="NORMAL">NORMAL Priority</option>
          </select>
        </div>

        {/* Requested Service */}
        <div className="space-y-1">
          <label htmlFor="filter-service" className="block text-[10px] font-mono uppercase tracking-wider text-midnight-400">
            Requested Service
          </label>
          <select
            id="filter-service"
            value={filters.requestedService || 'ALL'}
            onChange={(e) => onFilterChange({ requestedService: e.target.value === 'ALL' ? undefined : e.target.value, page: 1 })}
            className="w-full bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/60 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-midnight-200 transition-colors"
          >
            <option value="ALL">All Services</option>
            <option value="STANDARD">STANDARD Service</option>
            <option value="EXPRESS">EXPRESS Service</option>
            <option value="SAME_DAY">SAME_DAY Service</option>
          </select>
        </div>
      </div>
    </div>
  );
}
