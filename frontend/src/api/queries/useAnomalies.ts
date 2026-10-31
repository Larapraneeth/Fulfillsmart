import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import {
  AnomalyOverviewResponse,
  AnomalyPaginatedResponse,
  AnomalyDetailResponse,
  AnomalyQueryParams,
  AnomalyFinding,
  AnomalyEvaluationReport,
  CleanDataAuditReport
} from '../../types/anomalies';

/**
 * Query aggregated historical anomaly overview metrics, baseline disclosures, and distributions.
 */
export function useAnomalyOverview() {
  return useQuery({
    queryKey: ['anomalies', 'overview'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<AnomalyOverviewResponse>>(
        API_ENDPOINTS.ANOMALIES_OVERVIEW
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Query server-side paginated operational anomalies with search, category, severity, and status filters.
 */
export function useAnomaliesPaginated(params: AnomalyQueryParams) {
  return useQuery({
    queryKey: ['anomalies', 'list', params],
    queryFn: async () => {
      const urlParams = new URLSearchParams();
      if (params.page) urlParams.append('page', params.page.toString());
      if (params.page_size) urlParams.append('page_size', params.page_size.toString());
      if (params.category && params.category !== 'ALL') urlParams.append('category', params.category);
      if (params.severity && params.severity !== 'ALL') urlParams.append('severity', params.severity);
      if (params.status && params.status !== 'ALL') urlParams.append('status', params.status);
      if (params.carrier_id && params.carrier_id !== 'ALL') urlParams.append('carrier_id', params.carrier_id);
      if (params.node_id && params.node_id !== 'ALL') urlParams.append('node_id', params.node_id);
      if (params.search && params.search.trim()) urlParams.append('search', params.search.trim());
      if (params.sort_by) urlParams.append('sort_by', params.sort_by);
      if (params.sort_order) urlParams.append('sort_order', params.sort_order);

      const qs = urlParams.toString();
      const endpoint = qs ? `${API_ENDPOINTS.ANOMALIES_LIST}?${qs}` : API_ENDPOINTS.ANOMALIES_LIST;

      const res = await apiClient<ApiResponseEnvelope<AnomalyPaginatedResponse>>(endpoint);
      return res.data.data;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/**
 * Query forensic evidence and related database records for a specific anomaly ID.
 */
export function useAnomalyDetail(anomalyId: string | null) {
  return useQuery({
    queryKey: ['anomalies', 'detail', anomalyId],
    queryFn: async () => {
      if (!anomalyId) throw new Error('Anomaly ID is required');
      const res = await apiClient<ApiResponseEnvelope<AnomalyDetailResponse>>(
        API_ENDPOINTS.ANOMALY_DETAIL(anomalyId)
      );
      return res.data.data;
    },
    enabled: Boolean(anomalyId && anomalyId.trim().length > 0),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Mutation to run single record inspection against the 6 deterministic business rules.
 */
export function useDetectAnomalyMutation() {
  return useMutation({
    mutationFn: async (scenario: Record<string, any>) => {
      const res = await apiClient<ApiResponseEnvelope<AnomalyFinding[]>>(
        API_ENDPOINTS.ANOMALIES_DETECT,
        {
          method: 'POST',
          body: JSON.stringify({ scenario }),
        }
      );
      return res.data.data;
    },
  });
}

/**
 * Mutation to trigger ground truth benchmark evaluation (976 replacement synthetic cases).
 */
export function useGroundTruthEvaluationMutation() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<AnomalyEvaluationReport>>(
        API_ENDPOINTS.ANOMALIES_EVALUATE_GROUND_TRUTH,
        {
          method: 'POST',
        }
      );
      return res.data.data;
    },
  });
}

/**
 * Mutation to trigger clean operational data audit (247,061 records).
 */
export function useCleanAuditEvaluationMutation() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<CleanDataAuditReport>>(
        API_ENDPOINTS.ANOMALIES_EVALUATE_CLEAN_AUDIT,
        {
          method: 'POST',
        }
      );
      return res.data.data;
    },
  });
}
