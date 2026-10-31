import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../endpoints';
import { OverviewAnalytics, TrendsAnalytics, FulfillmentAnalytics, CarriersAnalytics, DeliveryAnalytics, AllocationAnalytics, ExportAnalytics } from '../../types/analytics';

/** Fetch analytics overview */
export const useAnalyticsOverview = (): UseQueryResult<OverviewAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_OVERVIEW);
      if (!res.ok) throw new Error('Failed to fetch analytics overview');
      const json = await res.json();
      return json.data as OverviewAnalytics;
    },
  });

/** Fetch monthly trends */
export const useAnalyticsTrends = (): UseQueryResult<TrendsAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_TRENDS);
      if (!res.ok) throw new Error('Failed to fetch analytics trends');
      const json = await res.json();
      return json.data as TrendsAnalytics;
    },
  });

/** Fulfillment node analytics */
export const useAnalyticsFulfillment = (): UseQueryResult<FulfillmentAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'fulfillment'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_FULFILLMENT);
      if (!res.ok) throw new Error('Failed to fetch fulfillment analytics');
      const json = await res.json();
      return json.data as FulfillmentAnalytics;
    },
  });

/** Carrier performance analytics */
export const useAnalyticsCarriers = (): UseQueryResult<CarriersAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'carriers'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_CARRIERS);
      if (!res.ok) throw new Error('Failed to fetch carriers analytics');
      const json = await res.json();
      return json.data as CarriersAnalytics;
    },
  });

/** Delivery outcome analytics */
export const useAnalyticsDelivery = (): UseQueryResult<DeliveryAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'delivery'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_DELIVERY);
      if (!res.ok) throw new Error('Failed to fetch delivery analytics');
      const json = await res.json();
      return json.data as DeliveryAnalytics;
    },
  });

/** Allocation analytics */
export const useAnalyticsAllocation = (): UseQueryResult<AllocationAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'allocation'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_ALLOCATION);
      if (!res.ok) throw new Error('Failed to fetch allocation analytics');
      const json = await res.json();
      return json.data as AllocationAnalytics;
    },
  });

/** Export analytics CSV placeholder */
export const useAnalyticsExport = (): UseQueryResult<ExportAnalytics> =>
  useQuery({
    queryKey: ['analytics', 'export'],
    queryFn: async () => {
      const res = await fetch(API_ENDPOINTS.ANALYTICS_EXPORT);
      if (!res.ok) throw new Error('Failed to fetch analytics export');
      const json = await res.json();
      return json.data as ExportAnalytics;
    },
  });
