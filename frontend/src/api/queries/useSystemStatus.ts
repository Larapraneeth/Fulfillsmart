import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { HealthResponse, ReadyResponse, SystemInfoResponse } from '../../types/system';

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: async () => {
      const res = await apiClient<HealthResponse>(API_ENDPOINTS.HEALTH);
      return {
        ...res.data,
        roundTripMs: res.roundTripMs,
      };
    },
    refetchInterval: 10000, // Poll every 10s
    retry: 2,
  });
}

export function useSystemReadiness() {
  return useQuery({
    queryKey: ['system', 'ready'],
    queryFn: async () => {
      const res = await apiClient<ReadyResponse>(API_ENDPOINTS.READY);
      return {
        ...res.data,
        roundTripMs: res.roundTripMs,
      };
    },
    refetchInterval: 10000, // Poll every 10s
    retry: 2,
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: async () => {
      const res = await apiClient<SystemInfoResponse>(API_ENDPOINTS.SYSTEM_INFO);
      return res.data;
    },
    staleTime: Infinity, // System info is static for the session
    retry: 2,
  });
}
