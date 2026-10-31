import { useState, useMemo, useCallback } from 'react';
import { useNetworkTopology } from '../../api/queries/useNetworkTopology';
import { ApiError } from '../../api/client';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  MapTransform,
  NodeTopologyItem,
  ZoneTopologyItem,
  HistoricalRouteCorridor,
} from '../../types/network';
import { MAP_DIMENSIONS } from './data/mapConfig';

import { NetworkMapHeader } from './components/NetworkMapHeader';
import { NetworkMapControls } from './components/NetworkMapControls';
import { NetworkMapCanvas } from './components/NetworkMapCanvas';
import { NetworkDetailPanel } from './components/NetworkDetailPanel';

import { Table, ShieldCheck } from 'lucide-react';

export default function NetworkMapPage() {
  const topologyQuery = useNetworkTopology();

  // -------------------------------------------------------------------------
  // 1. Filter & Selection State
  // -------------------------------------------------------------------------
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>('ALL');
  const [minShipmentCount, setMinShipmentCount] = useState<number>(0);

  const [showCorridors, setShowCorridors] = useState<boolean>(true);
  const [showDeliveryZones, setShowDeliveryZones] = useState<boolean>(true);
  const [showFulfillmentNodes, setShowFulfillmentNodes] = useState<boolean>(true);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<HistoricalRouteCorridor | null>(null);

  // Tabular Audit View Toggle
  const [showAuditTable, setShowAuditTable] = useState<boolean>(false);
  const [activeTableTab, setActiveTableTab] = useState<'nodes' | 'zones' | 'corridors'>('nodes');

  // -------------------------------------------------------------------------
  // 2. Viewport Transform (Zoom & Pan)
  // -------------------------------------------------------------------------
  const [transform, setTransform] = useState<MapTransform>({
    x: 0,
    y: 0,
    k: MAP_DIMENSIONS.defaultZoom,
  });

  const handleZoomIn = useCallback(() => {
    setTransform((t) => ({
      ...t,
      k: Math.min(MAP_DIMENSIONS.maxZoom, Number((t.k * 1.25).toFixed(2))),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform((t) => ({
      ...t,
      k: Math.max(MAP_DIMENSIONS.minZoom, Number((t.k / 1.25).toFixed(2))),
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setTransform({
      x: 0,
      y: 0,
      k: MAP_DIMENSIONS.defaultZoom,
    });
  }, []);

  // -------------------------------------------------------------------------
  // 3. Selection Handlers (Mutually Exclusive Coordinated Selection)
  // -------------------------------------------------------------------------
  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      setSelectedZoneId(null);
    }
  }, []);

  const handleSelectZone = useCallback((zoneId: string | null) => {
    setSelectedZoneId(zoneId);
    if (zoneId) {
      setSelectedNodeId(null);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedZoneId(null);
    setSelectedCorridor(null);
  }, []);

  // -------------------------------------------------------------------------
  // 4. Data Extraction & Memoized Processing
  // -------------------------------------------------------------------------
  const topologyData = topologyQuery.data;

  // Safe typed lists
  const nodes = useMemo<NodeTopologyItem[]>(() => {
    return (topologyData?.nodes as NodeTopologyItem[]) || [];
  }, [topologyData?.nodes]);

  const deliveryZones = useMemo<ZoneTopologyItem[]>(() => {
    return (topologyData?.delivery_zones as ZoneTopologyItem[]) || [];
  }, [topologyData?.delivery_zones]);

  const corridors = useMemo<HistoricalRouteCorridor[]>(() => {
    return (topologyData?.historical_corridors as HistoricalRouteCorridor[]) || [];
  }, [topologyData?.historical_corridors]);

  // Extract unique active carriers dynamically from actual corridor topology data
  const carriers = useMemo(() => {
    const carrierMap = new Map<string, string>();
    for (const c of corridors) {
      if (c.carrier_id && !carrierMap.has(c.carrier_id)) {
        carrierMap.set(c.carrier_id, c.carrier_name);
      }
    }
    return Array.from(carrierMap.entries())
      .map(([carrier_id, carrier_name]) => ({ carrier_id, carrier_name }))
      .sort((a, b) => a.carrier_name.localeCompare(b.carrier_name));
  }, [corridors]);

  // Filtered corridors for counting & controls
  const displayedCorridors = useMemo(() => {
    return corridors.filter((c) => {
      if (selectedCarrierId !== 'ALL' && c.carrier_id !== selectedCarrierId) {
        return false;
      }
      if (c.historical_shipment_count < minShipmentCount) {
        return false;
      }
      return true;
    });
  }, [corridors, selectedCarrierId, minShipmentCount]);

  // Selected item references for detail panel
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.node_id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return deliveryZones.find((z) => z.delivery_zone_id === selectedZoneId) || null;
  }, [deliveryZones, selectedZoneId]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    topologyQuery.refetch();
  }, [topologyQuery]);

  // -------------------------------------------------------------------------
  // 5. Loading State
  // -------------------------------------------------------------------------
  if (topologyQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading India fulfillment network topology">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-midnight-700">
          <div className="space-y-2">
            <LoadingSkeleton className="h-7 w-72" />
            <LoadingSkeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <LoadingSkeleton className="h-8 w-24" />
            <LoadingSkeleton className="h-8 w-24" />
            <LoadingSkeleton className="h-8 w-28" />
          </div>
        </div>

        {/* Controls Skeleton */}
        <div className="p-3 rounded-xl border border-midnight-700 bg-midnight-900/60 flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex gap-2">
            <LoadingSkeleton className="h-7 w-24" />
            <LoadingSkeleton className="h-7 w-24" />
            <LoadingSkeleton className="h-7 w-28" />
          </div>
          <div className="flex gap-2">
            <LoadingSkeleton className="h-7 w-32" />
            <LoadingSkeleton className="h-7 w-28" />
          </div>
        </div>

        {/* Canvas & Detail Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 xl:col-span-8">
            <LoadingSkeleton className="w-full h-[580px] rounded-xl" />
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <LoadingSkeleton className="w-full h-[580px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 6. Error State
  // -------------------------------------------------------------------------
  if (topologyQuery.isError) {
    const error = topologyQuery.error;
    const apiError = error instanceof ApiError ? error : null;

    return (
      <div className="space-y-6">
        <NetworkMapHeader
          carriers={[]}
          selectedCarrierId="ALL"
          onSelectCarrier={() => {}}
          onRefresh={handleRefresh}
          isFetching={topologyQuery.isFetching}
        />
        <ErrorState
          title="Network Topology Synchronization Failed"
          message="Unable to communicate with the fulfillment topology service. Verify that the backend service is running and API credentials are valid."
          problemDetails={apiError?.problemDetails}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 7. Empty State
  // -------------------------------------------------------------------------
  if (!topologyData || (nodes.length === 0 && deliveryZones.length === 0)) {
    return (
      <div className="space-y-6">
        <NetworkMapHeader
          carriers={[]}
          selectedCarrierId="ALL"
          onSelectCarrier={() => {}}
          onRefresh={handleRefresh}
          isFetching={topologyQuery.isFetching}
        />
        <EmptyState
          title="No Fulfillment Topology Records Available"
          description="The network topology service returned zero active fulfillment nodes or delivery zones. Initialize master facility and zone records in the database."
          action={
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-tactical-cyan text-midnight-950 font-semibold font-mono text-xs hover:bg-tactical-teal transition-colors"
            >
              Retry Sync
            </button>
          }
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 8. Main Render: Midnight Command Center Interactive Network Map
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* 1. Command Center Header & Telemetry Status Counters */}
      <NetworkMapHeader
        nodesCount={nodes.length}
        zonesCount={deliveryZones.length}
        corridorsCount={corridors.length}
        totalUniqueCombinations={2710}
        carriers={carriers}
        selectedCarrierId={selectedCarrierId}
        onSelectCarrier={setSelectedCarrierId}
        isFetching={topologyQuery.isFetching}
        onRefresh={handleRefresh}
      />

      {/* 2. Tactical Controls Bar: Layers, Min Volume & Zoom */}
      <NetworkMapControls
        zoomLevel={transform.k}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        showCorridors={showCorridors}
        showDeliveryZones={showDeliveryZones}
        showFulfillmentNodes={showFulfillmentNodes}
        onToggleCorridors={() => setShowCorridors((prev) => !prev)}
        onToggleDeliveryZones={() => setShowDeliveryZones((prev) => !prev)}
        onToggleFulfillmentNodes={() => setShowFulfillmentNodes((prev) => !prev)}
        minShipmentCount={minShipmentCount}
        onMinShipmentCountChange={setMinShipmentCount}
        displayedCorridorsCount={displayedCorridors.length}
        nodesCount={nodes.length}
        zonesCount={deliveryZones.length}
      />

      {/* 3. Main Operational Grid: Interactive Canvas & Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive D3-Geo SVG Vector Canvas */}
        <section
          className="lg:col-span-7 xl:col-span-8 space-y-3"
          aria-label="Interactive India Map Section"
        >
          <NetworkMapCanvas
            nodes={nodes}
            deliveryZones={deliveryZones}
            corridors={corridors}
            selectedNodeId={selectedNodeId}
            selectedZoneId={selectedZoneId}
            onSelectNode={handleSelectNode}
            onSelectZone={handleSelectZone}
            selectedCarrierId={selectedCarrierId}
            minShipmentCount={minShipmentCount}
            showCorridors={showCorridors}
            showDeliveryZones={showDeliveryZones}
            showFulfillmentNodes={showFulfillmentNodes}
            transform={transform}
            onTransformChange={setTransform}
            selectedCorridor={selectedCorridor}
            onSelectCorridor={setSelectedCorridor}
            className="w-full shadow-2xl"
          />

          {/* Interactive Help & Audit Toggle Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-lg bg-midnight-900/60 border border-midnight-800 text-xs font-mono text-midnight-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-tactical-teal shrink-0" aria-hidden="true" />
              <span>
                Displaying 150 top-volume corridors selected from 2,710 unique combinations.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAuditTable((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-midnight-950 hover:bg-midnight-800 border border-midnight-700 text-tactical-cyan hover:text-white transition-colors text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-cyan"
              aria-expanded={showAuditTable}
              aria-controls="accessible-topology-audit-table"
            >
              <Table className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showAuditTable ? 'Hide Tabular Audit Data' : 'View Tabular Audit Data'}</span>
            </button>
          </div>
        </section>

        {/* Right Column: Tactical Detail Inspection Panel */}
        <section
          className="lg:col-span-5 xl:col-span-4 sticky top-6"
          aria-label="Network Detail Inspection Section"
        >
          <NetworkDetailPanel
            selectedNode={selectedNode}
            selectedZone={selectedZone}
            corridors={corridors}
            onClearSelection={handleClearSelection}
            onSelectNode={handleSelectNode}
            onSelectZone={handleSelectZone}
            nodesCount={nodes.length}
            zonesCount={deliveryZones.length}
            displayedCorridorsCount={corridors.length}
            totalUniqueCombinations={2710}
          />
        </section>
      </div>

      {/* 4. Collapsible Accessible Tabular Audit Section */}
      {showAuditTable && (
        <Card variant="elevated" id="accessible-topology-audit-table" className="animate-in fade-in duration-200">
          <CardHeader
            headerIcon={<Table className="w-5 h-5 text-tactical-cyan" aria-hidden="true" />}
            subtitle="Accessible tabular audit records for fulfillment nodes, delivery zones, and historical route corridors."
            headerAction={
              <div className="flex items-center gap-1 p-1 bg-midnight-950 rounded-lg border border-midnight-800 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTableTab('nodes')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTableTab === 'nodes'
                      ? 'bg-tactical-teal text-midnight-950 font-semibold'
                      : 'text-midnight-400 hover:text-midnight-200'
                  }`}
                >
                  Nodes ({nodes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTableTab('zones')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTableTab === 'zones'
                      ? 'bg-tactical-cyan text-midnight-950 font-semibold'
                      : 'text-midnight-400 hover:text-midnight-200'
                  }`}
                >
                  Zones ({deliveryZones.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTableTab('corridors')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTableTab === 'corridors'
                      ? 'bg-tactical-amber text-midnight-950 font-semibold'
                      : 'text-midnight-400 hover:text-midnight-200'
                  }`}
                >
                  Corridors ({corridors.length})
                </button>
              </div>
            }
          >
            <CardTitle>Topology Tabular Audit Telemetry</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* Table Tab 1: Fulfillment Nodes */}
            {activeTableTab === 'nodes' && (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-midnight-950 sticky top-0 text-[11px] text-midnight-400 uppercase tracking-wider border-b border-midnight-800">
                    <tr>
                      <th className="py-2.5 px-4">Node ID</th>
                      <th className="py-2.5 px-4">Facility Name</th>
                      <th className="py-2.5 px-4">City / State</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4 text-right">Daily Cap (Orders)</th>
                      <th className="py-2.5 px-4 text-right">Allocated (260d)</th>
                      <th className="py-2.5 px-4 text-right">Utilization %</th>
                      <th className="py-2.5 px-4 text-right">Coordinates (WGS-84)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight-800 text-midnight-300">
                    {nodes.map((n) => (
                      <tr
                        key={n.node_id}
                        onClick={() => handleSelectNode(n.node_id)}
                        className={`cursor-pointer transition-colors hover:bg-midnight-800/60 ${
                          n.node_id === selectedNodeId ? 'bg-tactical-teal/10 text-tactical-teal' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-bold">{n.node_id}</td>
                        <td className="py-2.5 px-4 text-midnight-100">{n.node_name}</td>
                        <td className="py-2.5 px-4">{n.city}, {n.state}</td>
                        <td className="py-2.5 px-4">
                          <Badge variant="teal" size="sm">
                            {n.node_type.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right">{n.daily_order_capacity.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right">{n.allocated_orders_total.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right font-semibold">
                          {n.order_utilization_pct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right text-midnight-400">
                          {n.latitude.toFixed(4)}°N, {n.longitude.toFixed(4)}°E
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Tab 2: Delivery Zones */}
            {activeTableTab === 'zones' && (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-midnight-950 sticky top-0 text-[11px] text-midnight-400 uppercase tracking-wider border-b border-midnight-800">
                    <tr>
                      <th className="py-2.5 px-4">Zone ID</th>
                      <th className="py-2.5 px-4">Zone Name</th>
                      <th className="py-2.5 px-4">City / State</th>
                      <th className="py-2.5 px-4">Region</th>
                      <th className="py-2.5 px-4">Distance Band</th>
                      <th className="py-2.5 px-4 text-right">Synthetic Pincode</th>
                      <th className="py-2.5 px-4 text-right">Orders Received</th>
                      <th className="py-2.5 px-4 text-right">Urban Centroid (WGS-84)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight-800 text-midnight-300">
                    {deliveryZones.map((z) => (
                      <tr
                        key={z.delivery_zone_id}
                        onClick={() => handleSelectZone(z.delivery_zone_id)}
                        className={`cursor-pointer transition-colors hover:bg-midnight-800/60 ${
                          z.delivery_zone_id === selectedZoneId ? 'bg-tactical-cyan/10 text-tactical-cyan' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-bold">{z.delivery_zone_id}</td>
                        <td className="py-2.5 px-4 text-midnight-100">{z.zone_name}</td>
                        <td className="py-2.5 px-4">{z.city}, {z.state}</td>
                        <td className="py-2.5 px-4">{z.region}</td>
                        <td className="py-2.5 px-4">
                          <Badge variant="cyan" size="sm">
                            {z.distance_band}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right">{z.synthetic_pincode}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-tactical-cyan">
                          {z.total_orders_received.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right text-midnight-400">
                          {z.latitude.toFixed(4)}°N, {z.longitude.toFixed(4)}°E
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Tab 3: Historical Route Corridors */}
            {activeTableTab === 'corridors' && (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead className="bg-midnight-950 sticky top-0 text-[11px] text-midnight-400 uppercase tracking-wider border-b border-midnight-800">
                    <tr>
                      <th className="py-2.5 px-4">Origin Hub</th>
                      <th className="py-2.5 px-4">Destination Zone</th>
                      <th className="py-2.5 px-4">Carrier</th>
                      <th className="py-2.5 px-4 text-right">Shipments Fulfilled</th>
                      <th className="py-2.5 px-4 text-right">Haversine Distance (km)</th>
                      <th className="py-2.5 px-4">Distance Disclosure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight-800 text-midnight-300">
                    {corridors.map((c) => (
                      <tr
                        key={`${c.node_id}-${c.delivery_zone_id}-${c.carrier_id}`}
                        onClick={() => setSelectedCorridor(c)}
                        className={`cursor-pointer transition-colors hover:bg-midnight-800/60 ${
                          selectedCorridor?.node_id === c.node_id &&
                          selectedCorridor?.delivery_zone_id === c.delivery_zone_id &&
                          selectedCorridor?.carrier_id === c.carrier_id
                            ? 'bg-tactical-amber/10 text-tactical-amber'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-semibold text-tactical-teal">
                          {c.node_city} ({c.node_id})
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-tactical-cyan">
                          {c.zone_city} ({c.delivery_zone_id})
                        </td>
                        <td className="py-2.5 px-4 text-midnight-200">
                          {c.carrier_name} ({c.carrier_id})
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-tactical-amber">
                          {c.historical_shipment_count.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {c.haversine_distance_km.toFixed(1)} km
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-midnight-500 font-sans">
                          Straight-line spherical displacement
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Provenance, Methodology & Compliance Disclosure Banner */}
      <Card variant="glass">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-sans text-midnight-400">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-tactical-teal shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <span className="font-semibold text-midnight-200 font-mono">
                Cartographic Integrity & Coordinate Provenance Disclosure:
              </span>
              <p className="leading-relaxed">
                Warehouse facility coordinates (20 nodes) are exact WGS-84 coordinates sourced from the master database (<code className="text-midnight-300 font-mono">fulfillment_nodes</code>). Delivery zone coordinates (50 zones) represent representative urban city centroids from the internal network reference table (<code className="text-midnight-300 font-mono">geo_centroids.py</code>). Corridor distances represent straight-line geodesic spherical displacement (Haversine formula). Highway driving distances and road transit times are not calculated by this system.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 font-mono text-[11px]">
            <Badge variant="teal" size="sm">
              20 Hubs
            </Badge>
            <Badge variant="cyan" size="sm">
              50 Centroids
            </Badge>
            <Badge variant="amber" size="sm">
              150 Corridors
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
