import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import {
  TrackingOverviewData,
  ShipmentPaginatedData,
  ShipmentDetailData,
  ShipmentsQueryParams,
} from '../../types/tracking';
import { OrderTrackingHistoryData } from '../../types/orders';

/**
 * Query complete historical tracking overview KPIs, delay distribution, carrier and node performance.
 */
export function useTrackingOverview() {
  return useQuery({
    queryKey: ['tracking', 'overview'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<TrackingOverviewData>>(
        API_ENDPOINTS.TRACKING_OVERVIEW
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (historical baseline data)
    retry: 2,
  });
}

/**
 * Query server-side paginated shipments with search, carrier, node, and delay filters.
 */
export function useShipmentsPaginated(params: ShipmentsQueryParams) {
  return useQuery({
    queryKey: ['tracking', 'shipments', params],
    queryFn: async () => {
      const urlParams = new URLSearchParams();
      if (params.page) urlParams.append('page', params.page.toString());
      if (params.page_size) urlParams.append('page_size', params.page_size.toString());
      if (params.search && params.search.trim()) urlParams.append('search', params.search.trim());
      if (params.carrier_id && params.carrier_id !== 'ALL') urlParams.append('carrier_id', params.carrier_id);
      if (params.node_id && params.node_id !== 'ALL') urlParams.append('node_id', params.node_id);
      if (params.is_delayed !== undefined && params.is_delayed !== -1) {
        urlParams.append('is_delayed', params.is_delayed.toString());
      }
      if (params.service_code && params.service_code !== 'ALL') {
        urlParams.append('service_code', params.service_code);
      }

      const qs = urlParams.toString();
      const endpoint = qs ? `${API_ENDPOINTS.TRACKING_SHIPMENTS}?${qs}` : API_ENDPOINTS.TRACKING_SHIPMENTS;

      const res = await apiClient<ApiResponseEnvelope<ShipmentPaginatedData>>(endpoint);
      return res.data.data;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/**
 * Query full shipment metadata, chronological event timeline, parent order, and split siblings.
 */
export function useShipmentDetail(shipmentId: string | null | undefined) {
  return useQuery({
    queryKey: ['tracking', 'shipment', shipmentId],
    queryFn: async () => {
      if (!shipmentId || !shipmentId.trim()) {
        throw new Error('Shipment identifier is required for detail lookup.');
      }
      const endpoint = API_ENDPOINTS.TRACKING_SHIPMENT_DETAIL(shipmentId.trim());
      const res = await apiClient<ApiResponseEnvelope<ShipmentDetailData>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(shipmentId && shipmentId.trim()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Query historical tracking events and delivery outcome for an order ID.
 */
export function useOrderTrackingHistory(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['tracking', 'history', orderId],
    queryFn: async () => {
      if (!orderId || !orderId.trim()) {
        throw new Error('Order identifier is required for tracking lookup.');
      }
      const endpoint = API_ENDPOINTS.TRACKING_HISTORY(orderId.trim());
      const res = await apiClient<ApiResponseEnvelope<OrderTrackingHistoryData>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(orderId && orderId.trim()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
