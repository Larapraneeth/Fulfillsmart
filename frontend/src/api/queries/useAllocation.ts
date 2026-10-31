import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import {
  AllocationOverviewData,
  AllocationOutcome,
  OrderRequestPayload,
  BatchAllocationRequestPayload,
} from '../../types/allocation';
import { OrderAllocationHistoryData } from '../../types/orders';

/**
 * Query complete historical allocation overview, all 11 split orders, and 20-node volume distribution.
 */
export function useAllocationOverview() {
  return useQuery({
    queryKey: ['allocation', 'overview'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<AllocationOverviewData>>(
        API_ENDPOINTS.ALLOCATION_OVERVIEW
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (historical baseline data)
    retry: 2,
  });
}

/**
 * Query order allocation history and warehouse node assignments per SKU line for any order.
 */
export function useAllocationHistory(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['allocation', 'history', orderId],
    queryFn: async () => {
      if (!orderId || !orderId.trim()) {
        throw new Error('Order identifier is required for allocation lookup.');
      }
      const endpoint = API_ENDPOINTS.ALLOCATION_HISTORY(orderId.trim());
      const res = await apiClient<ApiResponseEnvelope<OrderAllocationHistoryData>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(orderId && orderId.trim()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Mutation to evaluate single candidate order fulfillment node allocation statelessly in-memory.
 * Leaves zero database or inventory reservations upon completion.
 */
export function useAllocateOrderMutation() {
  return useMutation({
    mutationFn: async (payload: OrderRequestPayload) => {
      const res = await apiClient<ApiResponseEnvelope<AllocationOutcome>>(
        API_ENDPOINTS.ALLOCATION_ORDER,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return res.data.data;
    },
  });
}

/**
 * Mutation to evaluate batch orders in chronological sequence with priority tie-breakers.
 */
export function useAllocateBatchMutation() {
  return useMutation({
    mutationFn: async (payload: BatchAllocationRequestPayload) => {
      const res = await apiClient<ApiResponseEnvelope<AllocationOutcome[]>>(
        API_ENDPOINTS.ALLOCATION_BATCH,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      return res.data.data;
    },
  });
}
