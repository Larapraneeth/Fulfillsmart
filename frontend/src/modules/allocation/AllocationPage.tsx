import { useState } from 'react';
import { ErrorState } from '../../components/common/ErrorState';
import { DashboardCardSkeleton } from '../../components/common/LoadingSkeleton';
import { useAllocationOverview } from '../../api/queries/useAllocation';
import { AllocationHeader } from './components/AllocationHeader';
import { AllocationTabs, AllocationTabId } from './components/AllocationTabs';
import { AllocationHistoryLookup } from './components/AllocationHistoryLookup';
import { SplitOrdersAnalysis } from './components/SplitOrdersAnalysis';
import { WarehouseAllocationTable } from './components/WarehouseAllocationTable';
import { AllocationSandbox } from './components/AllocationSandbox';

export default function AllocationPage() {
  const [activeTab, setActiveTab] = useState<AllocationTabId>('overview');

  const {
    data: overviewData,
    isLoading,
    isError,
    error,
    refetch,
  } = useAllocationOverview();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardCardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Allocation Overview"
          message={(error as Error)?.message || 'An unexpected error occurred while fetching allocation data.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const summary = overviewData?.summary;
  const splitOrders = overviewData?.split_orders || [];
  const nodeDistribution = overviewData?.node_distribution || [];

  return (
    <div className="space-y-6">
      {/* 1. Allocation Header & Core Operational KPIs */}
      <AllocationHeader
        summary={summary}
        isLoading={isLoading}
        onRefresh={() => refetch()}
      />

      {/* 2. Navigation Tabs */}
      <AllocationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        splitCount={splitOrders.length}
      />

      {/* 3. Tab Contents */}
      <div className="pt-1">
        {activeTab === 'overview' && <AllocationHistoryLookup />}

        {activeTab === 'splits' && (
          <SplitOrdersAnalysis splitOrders={splitOrders} />
        )}

        {activeTab === 'capacity' && (
          <WarehouseAllocationTable nodes={nodeDistribution} />
        )}

        {activeTab === 'sandbox' && <AllocationSandbox />}
      </div>
    </div>
  );
}
