import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import {
  PaginatedOrdersData,
  OrderDetail,
  OrderFilterParams,
  OrderTrackingHistoryData,
  OrderAllocationHistoryData,
} from '../../types/orders';

/**
 * Build URL query string from filter parameters with pagination limits
 */
function buildOrdersQueryString(params: OrderFilterParams): string {
  const query = new URLSearchParams();

  // Enforce server-side pagination boundaries (page >= 1, 1 <= pageSize <= 100)
  const safePage = Math.max(1, params.page || 1);
  const safePageSize = Math.min(Math.max(1, params.pageSize || 50), 100);

  query.set('page', String(safePage));
  query.set('page_size', String(safePageSize));

  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }

  if (params.status && params.status !== 'ALL') {
    query.set('status', params.status.trim());
  }

  if (params.destinationZoneId && params.destinationZoneId !== 'ALL') {
    query.set('destination_zone_id', params.destinationZoneId.trim());
  }

  if (params.orderPriority && params.orderPriority !== 'ALL') {
    query.set('order_priority', params.orderPriority.trim());
  }

  if (params.requestedService && params.requestedService !== 'ALL') {
    query.set('requested_service', params.requestedService.trim());
  }

  if (params.carrierId && params.carrierId !== 'ALL') {
    query.set('carrier_id', params.carrierId.trim());
  }

  if (params.nodeId && params.nodeId !== 'ALL') {
    query.set('node_id', params.nodeId.trim());
  }

  if (params.sortBy) {
    query.set('sort_by', params.sortBy);
  }

  if (params.sortOrder) {
    query.set('sort_order', params.sortOrder);
  }

  return query.toString();
}

/**
 * Query paginated, filtered, and sorted historical orders (50,000 baseline records).
 * Uses placeholderData: keepPreviousData to ensure seamless page transitions without UI flicker.
 */
export function useOrders(params: OrderFilterParams = {}) {
  const queryString = buildOrdersQueryString(params);

  return useQuery({
    queryKey: ['orders', 'list', params],
    queryFn: async () => {
      const endpoint = `${API_ENDPOINTS.ORDERS}?${queryString}`;
      const res = await apiClient<ApiResponseEnvelope<PaginatedOrdersData>>(endpoint);
      return res.data.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });
}

/**
 * Query complete single order header and SKU line items directly from SQLite.
 */
export function useOrderDetail(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order identifier is required for detail lookup.');
      }
      const endpoint = API_ENDPOINTS.ORDER_DETAIL(orderId);
      const res = await apiClient<ApiResponseEnvelope<OrderDetail>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(orderId && orderId.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes (historical record is immutable)
    retry: 2,
  });
}

/**
 * Query order tracking history, shipments, and chronological delivery events.
 */
export function useOrderTrackingHistory(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['orders', 'tracking-history', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order identifier is required for tracking lookup.');
      }
      const endpoint = API_ENDPOINTS.TRACKING_HISTORY(orderId);
      const res = await apiClient<ApiResponseEnvelope<OrderTrackingHistoryData>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(orderId && orderId.trim()),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Query order allocation history and warehouse node assignments per SKU line.
 */
export function useOrderAllocationHistory(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['orders', 'allocation-history', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order identifier is required for allocation lookup.');
      }
      const endpoint = API_ENDPOINTS.ALLOCATION_HISTORY(orderId);
      const res = await apiClient<ApiResponseEnvelope<OrderAllocationHistoryData>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(orderId && orderId.trim()),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
