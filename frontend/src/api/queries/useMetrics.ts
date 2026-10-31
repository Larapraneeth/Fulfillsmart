import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { API_ENDPOINTS } from '../endpoints';
import { ApiResponseEnvelope } from '../../types/common';
import {
  HeadlineSummary,
  KpiItem,
  CarrierPerformanceItem,
  WarehouseUtilizationItem,
  MonthlyTrendItem,
} from '../../types/metrics';

/**
 * Query top-level executive snapshot: total orders, shipments, strict on-time rates, and capacity.
 */
export function useHeadlineMetrics() {
  return useQuery({
    queryKey: ['metrics', 'headline'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<HeadlineSummary>>(
        API_ENDPOINTS.METRICS_HEADLINE
      );
      return res.data.data;
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });
}

/**
 * Query all 20 standard operational KPIs (historical & strict definitions).
 */
export function useKpiSummary() {
  return useQuery({
    queryKey: ['metrics', 'kpi-summary'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<KpiItem[]>>(
        API_ENDPOINTS.METRICS_KPI_SUMMARY
      );
      return res.data.data;
    },
    staleTime: 60 * 1000,
    retry: 2,
  });
}

/**
 * Query monthly delivery outcome trends (11 months: Dec 2025 – Oct 2026).
 */
export function useMonthlyTrends() {
  return useQuery({
    queryKey: ['metrics', 'monthly-trends'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<MonthlyTrendItem[]>>(
        API_ENDPOINTS.METRICS_MONTHLY_TRENDS
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (historical baseline data)
    retry: 2,
  });
}

/**
 * Query carrier scorecard: shipment counts, delay counts, average/median delays, and on-time rates.
 */
export function useCarrierPerformance() {
  return useQuery({
    queryKey: ['metrics', 'carrier-performance'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<CarrierPerformanceItem[]>>(
        API_ENDPOINTS.METRICS_CARRIER_PERF
      );
      return res.data.data;
    },
    staleTime: 60 * 1000,
    retry: 2,
  });
}

/**
 * Query warehouse utilization across active operating node-days for all 20 fulfillment nodes.
 */
export function useWarehouseUtilization() {
  return useQuery({
    queryKey: ['metrics', 'warehouse-utilization'],
    queryFn: async () => {
      const res = await apiClient<ApiResponseEnvelope<WarehouseUtilizationItem[]>>(
        API_ENDPOINTS.METRICS_WAREHOUSE_UTIL
      );
      return res.data.data;
    },
    staleTime: 60 * 1000,
    retry: 2,
  });
}
