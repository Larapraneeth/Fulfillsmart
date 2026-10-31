import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrackingHeader } from './components/TrackingHeader';
import { TrackingTabs, TrackingTabType } from './components/TrackingTabs';
import { ShipmentTrackingExplorer } from './components/ShipmentTrackingExplorer';
import { DeliveryPerformanceCards } from './components/DeliveryPerformanceCards';
import { CarrierDeliveryComparisonTable } from './components/CarrierDeliveryComparisonTable';
import { NodeDeliveryComparisonTable } from './components/NodeDeliveryComparisonTable';
import { ShipmentDetailDrawer } from './components/ShipmentDetailDrawer';
import { useTrackingOverview } from '../../api/queries/useTracking';
import { StatCardSkeleton, TableSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/ErrorState';

export default function TrackingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TrackingTabType>('explorer');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useTrackingOverview();

  const handleSelectShipment = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleNavigateToOrder = (orderId: string) => {
    navigate(`/orders?search=${encodeURIComponent(orderId)}`);
  };

  const summary = data?.summary;
  const delayDistribution = data?.delay_distribution || [];
  const carrierPerformance = data?.carrier_performance || [];
  const nodePerformance = data?.node_performance || [];

  const carriersSimple = carrierPerformance.map((c) => ({
    carrier_id: c.carrier_id,
    carrier_name: c.carrier_name,
  }));

  const nodesSimple = nodePerformance.map((n) => ({
    node_id: n.node_id,
    node_name: n.node_name,
  }));

  return (
    <div className="space-y-6">
      {/* Module Header & Operational KPIs */}
      <TrackingHeader
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
          title="Failed to Load Tracking Overview"
          message={
            error instanceof Error ? error.message : 'Unable to retrieve tracking overview metrics.'
          }
          onRetry={() => refetch()}
        />
      )}

      {/* Main Content Area */}
      {!isLoading && !isError && data && (
        <>
          {/* Navigation Tabs */}
          <TrackingTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            shipmentsCount={summary?.total_shipments || 49436}
            delayedCount={summary?.delayed_shipments || 1128}
          />

          {/* Active Tab View */}
          {activeTab === 'explorer' && (
            <ShipmentTrackingExplorer
              onSelectShipment={handleSelectShipment}
              carriers={carriersSimple}
              nodes={nodesSimple}
            />
          )}

          {activeTab === 'performance' && (
            <DeliveryPerformanceCards
              summary={summary}
              delayDistribution={delayDistribution}
            />
          )}

          {activeTab === 'carriers' && (
            <CarrierDeliveryComparisonTable
              carriers={carrierPerformance}
              onSelectCarrier={() => setActiveTab('explorer')}
            />
          )}

          {activeTab === 'nodes' && (
            <NodeDeliveryComparisonTable nodes={nodePerformance} />
          )}
        </>
      )}

      {/* Slide-over Consignment Detail & Timeline Drawer */}
      <ShipmentDetailDrawer
        shipmentId={selectedShipmentId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSelectShipment={handleSelectShipment}
        onNavigateToOrder={handleNavigateToOrder}
      />
    </div>
  );
}
