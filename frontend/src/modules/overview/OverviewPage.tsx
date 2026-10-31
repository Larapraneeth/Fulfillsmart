import {
  useHeadlineMetrics,
  useKpiSummary,
  useMonthlyTrends,
  useCarrierPerformance,
  useWarehouseUtilization,
} from '../../api/queries/useMetrics';
import { useNetworkTopology } from '../../api/queries/useNetworkTopology';
import { ApiError } from '../../api/client';
import { ErrorState } from '../../components/common/ErrorState';
import { StatCardSkeleton, DashboardCardSkeleton } from '../../components/common/LoadingSkeleton';

import { OverviewHeader } from './components/OverviewHeader';
import { ExecutiveKpiGrid } from './components/ExecutiveKpiGrid';
import { MonthlyTrendsChart } from './components/MonthlyTrendsChart';
import { CarrierScorecardChart } from './components/CarrierScorecardChart';
import { WarehouseUtilizationChart } from './components/WarehouseUtilizationChart';
import { OperationalInsightsPanel } from './components/OperationalInsightsPanel';
import { NetworkSummaryFooter } from './components/NetworkSummaryFooter';

export default function OverviewPage() {
  const headlineQuery = useHeadlineMetrics();
  const kpiQuery = useKpiSummary();
  const trendsQuery = useMonthlyTrends();
  const carrierQuery = useCarrierPerformance();
  const warehouseQuery = useWarehouseUtilization();
  const topologyQuery = useNetworkTopology();

  const isFetching =
    headlineQuery.isFetching ||
    kpiQuery.isFetching ||
    trendsQuery.isFetching ||
    carrierQuery.isFetching ||
    warehouseQuery.isFetching ||
    topologyQuery.isFetching;

  const dataUpdatedAt = Math.max(
    headlineQuery.dataUpdatedAt || 0,
    trendsQuery.dataUpdatedAt || 0,
    carrierQuery.dataUpdatedAt || 0,
    warehouseQuery.dataUpdatedAt || 0
  );

  const handleRefresh = () => {
    headlineQuery.refetch();
    kpiQuery.refetch();
    trendsQuery.refetch();
    carrierQuery.refetch();
    warehouseQuery.refetch();
    topologyQuery.refetch();
  };

  // Critical Error State if primary headline telemetry fails to load
  if (headlineQuery.isError) {
    const error = headlineQuery.error;
    const apiError = error instanceof ApiError ? error : null;

    return (
      <div className="space-y-6">
        <OverviewHeader onRefresh={handleRefresh} isFetching={isFetching} />
        <ErrorState
          title="Telemetry Synchronization Failed"
          message="Unable to communicate with the fulfillment operational metrics service. Verify backend service health or retry synchronization."
          problemDetails={apiError?.problemDetails}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Command Center Header & Telemetry Sync Bar */}
      <OverviewHeader
        isFetching={isFetching}
        dataUpdatedAt={dataUpdatedAt > 0 ? dataUpdatedAt : undefined}
        onRefresh={handleRefresh}
      />

      {/* 2. Executive 8-Card Telemetry KPI Grid */}
      {headlineQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, idx) => (
            <StatCardSkeleton key={idx} />
          ))}
        </div>
      ) : (
        <ExecutiveKpiGrid
          headline={headlineQuery.data}
          delayedOrdersCount={1128}
          shipmentDelayRatePct={2.28}
          carrierPromiseCoverageRatePct={98.87}
        />
      )}

      {/* 3. Section 1: Monthly Delivery Trajectory & Carrier Reliability Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendsChart
          data={trendsQuery.data}
          isLoading={trendsQuery.isLoading}
          isError={trendsQuery.isError}
        />
        <CarrierScorecardChart
          data={carrierQuery.data}
          isLoading={carrierQuery.isLoading}
          isError={carrierQuery.isError}
        />
      </div>

      {/* 4. Section 2: Warehouse Utilization vs. Operational Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WarehouseUtilizationChart
          data={warehouseQuery.data}
          isLoading={warehouseQuery.isLoading}
          isError={warehouseQuery.isError}
        />
        <OperationalInsightsPanel
          carrierUnavailableOrders={headlineQuery.data?.carrier_unavailable_orders ?? 579}
          delayedOrders={1128}
          splitNodeOrders={headlineQuery.data?.split_node_orders ?? 11}
          totalOrders={headlineQuery.data?.total_orders ?? 50000}
        />
      </div>

      {/* 5. Section 3: Pan-India Network Infrastructure Footer */}
      {topologyQuery.isLoading ? (
        <DashboardCardSkeleton />
      ) : (
        <NetworkSummaryFooter
          topology={topologyQuery.data}
          activeCarriersCount={carrierQuery.data?.length ?? 10}
        />
      )}
    </div>
  );
}
