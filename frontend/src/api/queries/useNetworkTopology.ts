import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import { NetworkTopologyData } from '../../types/metrics';

/**
 * Query complete India fulfillment network topology: 20 nodes, 50 delivery zones, and historical corridors.
 */
export function useNetworkTopology() {
  return useQuery({
    queryKey: ['network', 'topology'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<NetworkTopologyData>>(
        API_ENDPOINTS.NETWORK_TOPOLOGY
      );
      return res.data.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (static network infrastructure)
    retry: 2,
  });
}
