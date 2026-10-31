import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import {
  CarrierOverviewData,
  CarrierDetailData,
  CarrierServiceZoneMatrixData,
} from '../../types/carrier';

/**
 * Query complete historical carrier performance scorecard, service level distribution, and monthly trends.
 */
export function useCarrierOverview() {
  return useQuery({
    queryKey: ['carrier', 'overview'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<CarrierOverviewData>>(
        API_ENDPOINTS.CARRIER_OVERVIEW
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (historical baseline data)
    retry: 2,
  });
}

/**
 * Query detailed carrier profile, operating cutoffs, service levels, covered zones, and 50 recent shipments.
 */
export function useCarrierDetail(carrierId: string | null | undefined) {
  return useQuery({
    queryKey: ['carrier', 'detail', carrierId],
    queryFn: async () => {
      if (!carrierId || !carrierId.trim()) {
        throw new Error('Carrier identifier is required for detail lookup.');
      }
      const endpoint = API_ENDPOINTS.CARRIER_DETAIL(carrierId.trim());
      const res = await apiClient<ApiResponseEnvelope<CarrierDetailData>>(endpoint);
      return res.data.data;
    },
    enabled: Boolean(carrierId && carrierId.trim()),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Query master carrier service zone coverage matrix indicating Standard, Express, and Same-Day availability.
 */
export function useCarrierServiceZones(carrierId?: string, deliveryZoneId?: string) {
  return useQuery({
    queryKey: ['carrier', 'service-zones', carrierId, deliveryZoneId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (carrierId && carrierId.trim() && carrierId !== 'ALL') {
        params.append('carrier_id', carrierId.trim());
      }
      if (deliveryZoneId && deliveryZoneId.trim() && deliveryZoneId !== 'ALL') {
        params.append('delivery_zone_id', deliveryZoneId.trim());
      }
      const qs = params.toString();
      const endpoint = qs
        ? `${API_ENDPOINTS.CARRIER_SERVICE_ZONES}?${qs}`
        : API_ENDPOINTS.CARRIER_SERVICE_ZONES;

      const res = await apiClient<ApiResponseEnvelope<CarrierServiceZoneMatrixData>>(endpoint);
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
