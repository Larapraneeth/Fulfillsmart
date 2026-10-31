import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarrierHeader } from './components/CarrierHeader';
import { CarrierTabs, CarrierTabType } from './components/CarrierTabs';
import { CarrierScorecardTable } from './components/CarrierScorecardTable';
import { ServiceLevelDistributionTable } from './components/ServiceLevelDistributionTable';
import { CarrierCoverageMatrix } from './components/CarrierCoverageMatrix';
import { CarrierMonthlyTrendsChart } from './components/CarrierMonthlyTrendsChart';
import { CarrierDetailDrawer } from './components/CarrierDetailDrawer';
import { useCarrierOverview } from '../../api/queries/useCarriers';
import { TableSkeleton, StatCardSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/ErrorState';

export default function CarriersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CarrierTabType>('scorecard');
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useCarrierOverview();

  const handleSelectCarrier = (carrierId: string) => {
    setSelectedCarrierId(carrierId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleNavigateToOrder = (orderId: string) => {
    navigate(`/orders?search=${encodeURIComponent(orderId)}`);
  };

  const carriers = data?.carriers || [];
  const serviceLevels = data?.service_levels || [];
  const monthlyTrends = data?.monthly_trends || [];
  const summary = data?.summary;

  const activeCarriersSimple = carriers.map((c) => ({
    carrier_id: c.carrier_id,
    carrier_name: c.carrier_name,
  }));

  return (
    <div className="space-y-6">
      {/* Module Header & Operational KPIs */}
      <CarrierHeader
        summary={summary}
        isLoading={isLoading}
        onRefresh={() => refetch()}
      />

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <TableSkeleton rows={8} />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Failed to Load Carrier Intelligence"
          message={
            error instanceof Error ? error.message : 'Unable to retrieve carrier overview metrics.'
          }
          onRetry={() => refetch()}
        />
      )}

      {/* Main Content Area */}
      {!isLoading && !isError && data && (
        <>
          {/* Navigation Tabs */}
          <CarrierTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            carriersCount={carriers.length}
            serviceLevelsCount={serviceLevels.length}
            coverageCount={summary?.total_service_zone_routes || 335}
          />

          {/* Active Tab View */}
          {activeTab === 'scorecard' && (
            <CarrierScorecardTable
              carriers={carriers}
              onSelectCarrier={handleSelectCarrier}
            />
          )}

          {activeTab === 'service_levels' && (
            <ServiceLevelDistributionTable
              serviceLevels={serviceLevels}
              carriers={activeCarriersSimple}
              onSelectCarrier={handleSelectCarrier}
            />
          )}

          {activeTab === 'coverage' && (
            <CarrierCoverageMatrix
              carriers={activeCarriersSimple}
              onSelectCarrier={handleSelectCarrier}
            />
          )}

          {activeTab === 'trends' && (
            <CarrierMonthlyTrendsChart
              trends={monthlyTrends}
              carriers={activeCarriersSimple}
              onSelectCarrier={handleSelectCarrier}
            />
          )}
        </>
      )}

      {/* Slide-over Inspection Drawer */}
      <CarrierDetailDrawer
        carrierId={selectedCarrierId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onNavigateToOrder={handleNavigateToOrder}
      />
    </div>
  );
}
