import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { OrdersHeader } from './components/OrdersHeader';
import { OrdersFilterBar } from './components/OrdersFilterBar';
import { OrdersTable } from './components/OrdersTable';
import { OrdersPagination } from './components/OrdersPagination';
import { OrderDetailDrawer } from './components/OrderDetailDrawer';
import { useOrders } from '../../api/queries/useOrders';
import {
  OrderFilterParams,
  OrderSortField,
  SortOrderDirection,
} from '../../types/orders';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Button } from '../../components/common/Button';

export default function OrdersPage() {
  // Query parameters state
  const [filterParams, setFilterParams] = useState<OrderFilterParams>({
    page: 1,
    pageSize: 50,
    sortBy: 'order_time',
    sortOrder: 'desc',
  });

  // Selected order state for inspection drawer
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Fetch paginated orders through TanStack Query
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useOrders(filterParams);

  // Handlers
  const handleFilterChange = useCallback((updated: Partial<OrderFilterParams>) => {
    setFilterParams((prev) => ({
      ...prev,
      ...updated,
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilterParams({
      page: 1,
      pageSize: 50,
      sortBy: 'order_time',
      sortOrder: 'desc',
      search: undefined,
      status: undefined,
      destinationZoneId: undefined,
      orderPriority: undefined,
      requestedService: undefined,
      carrierId: undefined,
      nodeId: undefined,
    });
    setSelectedOrderId(null);
  }, []);

  const handleSortChange = useCallback((field: OrderSortField) => {
    setFilterParams((prev) => {
      const isSameField = prev.sortBy === field;
      const nextOrder: SortOrderDirection = isSameField
        ? prev.sortOrder === 'asc'
          ? 'desc'
          : 'asc'
        : field === 'order_id'
        ? 'asc'
        : 'desc';

      return {
        ...prev,
        sortBy: field,
        sortOrder: nextOrder,
        page: 1, // Reset to first page on sort change
      };
    });
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilterParams((prev) => ({
      ...prev,
      page: newPage,
    }));
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setFilterParams((prev) => ({
      ...prev,
      pageSize: newPageSize,
      page: 1,
    }));
  }, []);

  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrderId((prev) => (prev === orderId ? null : orderId));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedOrderId(null);
  }, []);

  const totalCount = data?.total_count ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const currentPage = data?.page ?? filterParams.page ?? 1;
  const pageSize = data?.page_size ?? filterParams.pageSize ?? 50;
  const orders = data?.items ?? [];

  return (
    <div className="space-y-5">
      {/* 1. Header with Historical Provenance & Baseline Counters */}
      <OrdersHeader totalOrdersCount={totalCount || 50000} />

      {/* 2. Search & Filter Bar */}
      <OrdersFilterBar
        filters={filterParams}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        isLoading={isFetching}
      />

      {/* 3. Main Data Grid Viewport */}
      {isError ? (
        <ErrorState
          title="Failed to Load Historical Orders"
          message={error instanceof Error ? error.message : 'Unable to query orders endpoint from SQLite backend.'}
          onRetry={() => refetch()}
        />
      ) : isLoading && !data ? (
        <div className="p-4 rounded-xl border border-midnight-700 bg-midnight-900 shadow-xl">
          <TableSkeleton rows={10} />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No Orders Match Active Filters"
          description="None of the 50,000 historical baseline orders matched the specified query parameters. Try widening your search or clearing active filters."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
              className="gap-2 font-mono text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-tactical-amber" />
              Reset All Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Orders Table */}
          <div className="relative">
            {/* Visual subtle loading overlay during page transitions */}
            {isFetching && (
              <div
                className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-tactical-teal to-transparent motion-safe:animate-pulse z-10"
                aria-hidden="true"
              />
            )}
            <OrdersTable
              orders={orders}
              sortBy={filterParams.sortBy}
              sortOrder={filterParams.sortOrder}
              onSortChange={handleSortChange}
              onSelectOrder={handleSelectOrder}
              selectedOrderId={selectedOrderId}
            />
          </div>

          {/* Pagination Toolbar */}
          <OrdersPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={isFetching}
          />
        </div>
      )}

      {/* 4. Slide-Over Order Detail Drawer */}
      <OrderDetailDrawer
        orderId={selectedOrderId}
        isOpen={Boolean(selectedOrderId)}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}


