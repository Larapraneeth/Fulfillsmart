import { useMemo } from 'react';
import {
  Building2,
  MapPin,
  Route,
  X,
  Gauge,
  Compass,
  Info,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  NodeTopologyItem,
  ZoneTopologyItem,
  HistoricalRouteCorridor,
} from '../../../types/network';

export interface NetworkDetailPanelProps {
  selectedNode: NodeTopologyItem | null;
  selectedZone: ZoneTopologyItem | null;
  corridors: HistoricalRouteCorridor[];
  onClearSelection: () => void;
  onSelectNode?: (nodeId: string) => void;
  onSelectZone?: (zoneId: string) => void;
  nodesCount?: number;
  zonesCount?: number;
  displayedCorridorsCount?: number;
  totalUniqueCombinations?: number;
}

export function NetworkDetailPanel({
  selectedNode,
  selectedZone,
  corridors,
  onClearSelection,
  onSelectNode,
  onSelectZone,
  nodesCount = 20,
  zonesCount = 50,
  displayedCorridorsCount = 150,
  totalUniqueCombinations = 2710,
}: NetworkDetailPanelProps) {
  // Compute connected corridors for the selected entity (outbound from node, inbound to zone)
  const connectedCorridors = useMemo(() => {
    if (selectedNode) {
      return corridors
        .filter((c) => c.node_id === selectedNode.node_id)
        .sort((a, b) => b.historical_shipment_count - a.historical_shipment_count);
    }
    if (selectedZone) {
      return corridors
        .filter((c) => c.delivery_zone_id === selectedZone.delivery_zone_id)
        .sort((a, b) => b.historical_shipment_count - a.historical_shipment_count);
    }
    return [];
  }, [selectedNode, selectedZone, corridors]);

  // Total shipments on connected corridors
  const connectedShipmentsTotal = useMemo(() => {
    return connectedCorridors.reduce((sum, c) => sum + c.historical_shipment_count, 0);
  }, [connectedCorridors]);

  // =========================================================================
  // STATE A: Selected Warehouse / Fulfillment Node Detail View
  // =========================================================================
  if (selectedNode) {
    const orderUtil = selectedNode.order_utilization_pct;
    const unitUtil = selectedNode.unit_utilization_pct;

    const getUtilColor = (val: number) => {
      if (val >= 90) return 'text-tactical-crimson bg-tactical-crimson';
      if (val >= 70) return 'text-tactical-amber bg-tactical-amber';
      return 'text-tactical-teal bg-tactical-teal';
    };

    return (
      <Card variant="elevated" accentBorder="teal" className="h-full flex flex-col">
        {/* Header */}
        <CardHeader
          headerIcon={<Building2 className="w-5 h-5 text-tactical-teal" aria-hidden="true" />}
          subtitle={`${selectedNode.city}, ${selectedNode.state} (Pincode: ${selectedNode.node_pincode})`}
          headerAction={
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 h-7 w-7 p-1"
              aria-label="Clear warehouse selection and return to overview"
              title="Deselect Warehouse"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          }
        >
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{selectedNode.node_name}</CardTitle>
            <Badge variant="teal" size="sm">
              {selectedNode.node_type.replace(/_/g, ' ')}
            </Badge>
            <span className="font-mono text-xs text-midnight-400">
              {selectedNode.node_id}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-22rem)] text-xs font-sans">
          {/* Coordinates & Provenance */}
          <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-midnight-400">
              <span className="flex items-center gap-1 text-tactical-teal">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Exact Facility Coordinates (WGS-84)
              </span>
              <span className="text-midnight-300">
                {selectedNode.latitude.toFixed(4)}°N, {selectedNode.longitude.toFixed(4)}°E
              </span>
            </div>
            <p className="text-[11px] text-midnight-400 leading-relaxed font-sans">
              Verified facility coordinates sourced directly from master database (<code className="text-midnight-300 font-mono">fulfillment_nodes</code> table).
            </p>
          </div>

          {/* Daily Capacity vs Cumulative Period Utilization Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono font-semibold text-midnight-200">
                <Gauge className="w-4 h-4 text-tactical-cyan" aria-hidden="true" />
                <span>Capacity & Period Utilization</span>
              </div>
              <Badge variant="outline" size="sm">
                260 Operating Days Baseline
              </Badge>
            </div>

            {/* Daily Nominal Limit Callout */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-midnight-950 border border-midnight-800">
                <div className="text-[10px] text-midnight-400 uppercase tracking-wider mb-0.5">
                  Daily Order Limit
                </div>
                <div className="text-base font-bold text-midnight-100">
                  {selectedNode.daily_order_capacity.toLocaleString()}
                </div>
                <div className="text-[10px] text-midnight-500 font-sans">orders / day nominal</div>
              </div>

              <div className="p-2.5 rounded-lg bg-midnight-950 border border-midnight-800">
                <div className="text-[10px] text-midnight-400 uppercase tracking-wider mb-0.5">
                  Daily Unit Limit
                </div>
                <div className="text-base font-bold text-midnight-100">
                  {selectedNode.daily_unit_capacity.toLocaleString()}
                </div>
                <div className="text-[10px] text-midnight-500 font-sans">units / day nominal</div>
              </div>
            </div>

            {/* Cumulative Period Utilization Breakdown */}
            <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 space-y-3">
              <div className="text-[11px] text-midnight-400 leading-tight">
                <span className="font-semibold text-midnight-200">Dataset Scope Disclosure:</span>{' '}
                Percentages represent cumulative orders/units fulfilled across the 260 operating-day historical baseline period vs nominal total period capacity. Not live instantaneous capacity.
              </div>

              {/* Order Utilization */}
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-midnight-300">Order Capacity Utilization:</span>
                  <span className={`font-semibold ${getUtilColor(orderUtil).split(' ')[0]}`}>
                    {orderUtil.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-1.5 w-full bg-midnight-900 rounded-full overflow-hidden border border-midnight-800"
                  role="progressbar"
                  aria-valuenow={orderUtil}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Order cumulative period utilization"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getUtilColor(orderUtil).split(' ')[1]}`}
                    style={{ width: `${Math.min(100, Math.max(0, orderUtil))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-midnight-500">
                  <span>Allocated: {selectedNode.allocated_orders_total.toLocaleString()} orders</span>
                  <span>Period Cap: {selectedNode.total_period_order_capacity.toLocaleString()}</span>
                </div>
              </div>

              {/* Unit Utilization */}
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-midnight-300">Unit Capacity Utilization:</span>
                  <span className={`font-semibold ${getUtilColor(unitUtil).split(' ')[0]}`}>
                    {unitUtil.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-1.5 w-full bg-midnight-900 rounded-full overflow-hidden border border-midnight-800"
                  role="progressbar"
                  aria-valuenow={unitUtil}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Unit cumulative period utilization"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getUtilColor(unitUtil).split(' ')[1]}`}
                    style={{ width: `${Math.min(100, Math.max(0, unitUtil))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-midnight-500">
                  <span>Allocated: {selectedNode.allocated_units_total.toLocaleString()} units</span>
                  <span>Period Cap: {selectedNode.total_period_unit_capacity.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Outbound Corridors List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono font-semibold text-midnight-200">
                <Route className="w-4 h-4 text-tactical-amber" aria-hidden="true" />
                <span>Outbound Historical Corridors</span>
              </div>
              <Badge variant="amber" size="sm">
                {connectedCorridors.length} in Top 150
              </Badge>
            </div>

            <p className="text-[11px] text-midnight-400">
              Showing active outbound corridors present within the {displayedCorridorsCount} top-volume displayed corridors (from {totalUniqueCombinations.toLocaleString()} combinations in database). Total volume: <span className="font-mono text-midnight-200 font-semibold">{connectedShipmentsTotal.toLocaleString()} shipments</span>.
            </p>

            {connectedCorridors.length === 0 ? (
              <div className="p-3 text-center rounded-lg bg-midnight-950 border border-midnight-800 text-midnight-500 text-xs">
                No outbound corridors from this warehouse are included in the top {displayedCorridorsCount} displayed volume corridors.
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1" aria-label="Connected outbound corridors">
                {connectedCorridors.map((c) => (
                  <li
                    key={`${c.node_id}-${c.delivery_zone_id}-${c.carrier_id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectZone && onSelectZone(c.delivery_zone_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onSelectZone) onSelectZone(c.delivery_zone_id);
                      }
                    }}
                    className="p-2 rounded-lg bg-midnight-950 border border-midnight-800 hover:border-tactical-cyan/40 hover:bg-midnight-800/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-cyan"
                    aria-label={`Inspect destination zone ${c.zone_city} via ${c.carrier_name}`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-semibold text-midnight-200 flex items-center gap-1">
                        <span>{selectedNode.city}</span>
                        <ArrowRight className="w-3 h-3 text-midnight-500 shrink-0" aria-hidden="true" />
                        <span className="text-tactical-cyan">{c.zone_city}</span>
                      </span>
                      <span className="text-tactical-amber font-semibold">
                        {c.historical_shipment_count.toLocaleString()} shp
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-midnight-400 font-mono mt-1">
                      <span>{c.carrier_name}</span>
                      <span className="text-midnight-400">
                        {c.haversine_distance_km.toFixed(1)} km (Haversine)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Straight-line Haversine Distance Disclosure */}
            <div className="p-2.5 rounded-lg bg-midnight-950/70 border border-midnight-800 text-[10px] text-midnight-400 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-tactical-amber shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="text-midnight-300">Distance Disclosure:</strong> Corridor distances represent straight-line geodesic spherical displacement (Haversine formula), not physical road driving distance.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // STATE B: Selected Delivery Zone Detail View
  // =========================================================================
  if (selectedZone) {
    return (
      <Card variant="elevated" accentBorder="cyan" className="h-full flex flex-col">
        {/* Header */}
        <CardHeader
          headerIcon={<MapPin className="w-5 h-5 text-tactical-cyan" aria-hidden="true" />}
          subtitle={`${selectedZone.city}, ${selectedZone.state} (Region: ${selectedZone.region})`}
          headerAction={
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800 h-7 w-7 p-1"
              aria-label="Clear delivery zone selection and return to overview"
              title="Deselect Zone"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          }
        >
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{selectedZone.zone_name}</CardTitle>
            <Badge variant="cyan" size="sm">
              {selectedZone.distance_band} Band
            </Badge>
            <span className="font-mono text-xs text-midnight-400">
              {selectedZone.delivery_zone_id}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-22rem)] text-xs font-sans">
          {/* Centroid Coordinates & Provenance Disclosure */}
          <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-midnight-400">
              <span className="flex items-center gap-1 text-tactical-amber">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                Approximate Urban Centroid
              </span>
              <span className="text-midnight-300">
                {selectedZone.latitude.toFixed(4)}°N, {selectedZone.longitude.toFixed(4)}°E
              </span>
            </div>
            <p className="text-[11px] text-midnight-400 leading-relaxed font-sans">
              Coordinates represent an approximate urban city centroid reference (derived from internal network reference table <code className="text-midnight-300 font-mono">geo_centroids.py</code>), not specific customer drop-off addresses or exact postal coordinates.
            </p>
            <div className="text-[10px] font-mono text-midnight-400 pt-1 border-t border-midnight-900">
              Synthetic Pincode Reference: <span className="text-midnight-300">{selectedZone.synthetic_pincode}</span>
            </div>
          </div>

          {/* Historical Demand Received */}
          <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-xs text-midnight-400 uppercase tracking-wider">
                Total Orders Received:
              </span>
              <span className="text-lg font-bold text-tactical-cyan">
                {selectedZone.total_orders_received.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-midnight-400 leading-relaxed">
              Cumulative customer order volume delivered to this urban cluster across the 260 operating-day baseline dataset period.
            </p>
          </div>

          {/* Inbound Corridors List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono font-semibold text-midnight-200">
                <Route className="w-4 h-4 text-tactical-amber" aria-hidden="true" />
                <span>Inbound Historical Corridors</span>
              </div>
              <Badge variant="amber" size="sm">
                {connectedCorridors.length} in Top 150
              </Badge>
            </div>

            <p className="text-[11px] text-midnight-400">
              Showing active fulfillment corridors serving this zone in the {displayedCorridorsCount} top-volume displayed corridors (from {totalUniqueCombinations.toLocaleString()} combinations in database). Total volume: <span className="font-mono text-midnight-200 font-semibold">{connectedShipmentsTotal.toLocaleString()} shipments</span>.
            </p>

            {connectedCorridors.length === 0 ? (
              <div className="p-3 text-center rounded-lg bg-midnight-950 border border-midnight-800 text-midnight-500 text-xs">
                No inbound corridors for this delivery zone are included in the top {displayedCorridorsCount} displayed volume corridors.
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1" aria-label="Connected inbound corridors">
                {connectedCorridors.map((c) => (
                  <li
                    key={`${c.node_id}-${c.delivery_zone_id}-${c.carrier_id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectNode && onSelectNode(c.node_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onSelectNode) onSelectNode(c.node_id);
                      }
                    }}
                    className="p-2 rounded-lg bg-midnight-950 border border-midnight-800 hover:border-tactical-teal/40 hover:bg-midnight-800/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-teal"
                    aria-label={`Inspect origin warehouse node in ${c.node_city} via ${c.carrier_name}`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-semibold text-midnight-200 flex items-center gap-1">
                        <span className="text-tactical-teal">{c.node_city}</span>
                        <ArrowRight className="w-3 h-3 text-midnight-500 shrink-0" aria-hidden="true" />
                        <span>{selectedZone.city}</span>
                      </span>
                      <span className="text-tactical-amber font-semibold">
                        {c.historical_shipment_count.toLocaleString()} shp
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-midnight-400 font-mono mt-1">
                      <span>{c.carrier_name}</span>
                      <span className="text-midnight-400">
                        {c.haversine_distance_km.toFixed(1)} km (Haversine)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Straight-line Haversine Distance Disclosure */}
            <div className="p-2.5 rounded-lg bg-midnight-950/70 border border-midnight-800 text-[10px] text-midnight-400 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-tactical-amber shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="text-midnight-300">Distance Disclosure:</strong> Corridor distances represent straight-line geodesic spherical displacement (Haversine formula), not physical road driving distance.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // =========================================================================
  // STATE C: Default Overview State (No Node or Zone Selected)
  // =========================================================================
  return (
    <Card variant="elevated" className="h-full flex flex-col">
      <CardHeader
        headerIcon={<Compass className="w-5 h-5 text-tactical-teal" aria-hidden="true" />}
        subtitle="Tactical Geographic Telemetry & Provenance"
      >
        <CardTitle>Network Inspection Panel</CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-22rem)] text-xs font-sans">
        <p className="text-midnight-300 leading-relaxed">
          Select any warehouse node or delivery zone on the map canvas to inspect facility capacity limits, centroid coordinates, and connected historical corridors.
        </p>

        {/* Quick Network Stat Cards */}
        <div className="grid grid-cols-2 gap-2 font-mono">
          <div className="p-2.5 rounded-lg bg-midnight-950 border border-midnight-800">
            <div className="text-[10px] text-midnight-400 uppercase tracking-wider mb-0.5">
              Active Hubs
            </div>
            <div className="text-lg font-bold text-tactical-teal">{nodesCount} Nodes</div>
            <div className="text-[10px] text-midnight-500 font-sans">Database coordinates</div>
          </div>

          <div className="p-2.5 rounded-lg bg-midnight-950 border border-midnight-800">
            <div className="text-[10px] text-midnight-400 uppercase tracking-wider mb-0.5">
              Delivery Zones
            </div>
            <div className="text-lg font-bold text-tactical-cyan">{zonesCount} Clusters</div>
            <div className="text-[10px] text-midnight-500 font-sans">Urban centroids</div>
          </div>

          <div className="p-2.5 rounded-lg bg-midnight-950 border border-midnight-800">
            <div className="text-[10px] text-midnight-400 uppercase tracking-wider mb-0.5">
              Corridors Shown
            </div>
            <div className="text-lg font-bold text-tactical-amber">{displayedCorridorsCount} Lanes</div>
            <div className="text-[10px] text-midnight-500 font-sans">From {totalUniqueCombinations.toLocaleString()} total</div>
          </div>

          <div className="p-2.5 rounded-lg bg-midnight-950 border border-midnight-800">
            <div className="text-[10px] text-midnight-400 uppercase tracking-wider mb-0.5">
              Operating Days
            </div>
            <div className="text-lg font-bold text-midnight-200">260 Days</div>
            <div className="text-[10px] text-midnight-500 font-sans">Dataset baseline</div>
          </div>
        </div>

        {/* Tactical Guidance */}
        <div className="p-3 rounded-lg bg-midnight-950 border border-midnight-800 space-y-2 text-[11px] text-midnight-400">
          <div className="font-semibold text-midnight-200 flex items-center gap-1.5 font-mono">
            <Info className="w-3.5 h-3.5 text-tactical-cyan" aria-hidden="true" />
            <span>Map Interaction Guide</span>
          </div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Click any teal dot (●) to inspect warehouse nominal capacity and cumulative utilization.</li>
            <li>Click any cyan diamond (◆) to inspect delivery zone centroid and inbound volume.</li>
            <li>Hover over corridor lines to view shipment volume and Haversine distance.</li>
            <li>Use the Controls bar above to filter by carrier, volume threshold, or toggle layers.</li>
          </ul>
        </div>

        {/* Cartographic & Distance Disclosures */}
        <div className="p-3 rounded-lg bg-midnight-950/60 border border-midnight-800/80 space-y-2 text-[11px] text-midnight-400">
          <div className="font-semibold text-midnight-300 font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-tactical-teal" aria-hidden="true" />
            <span>Cartographic & Data Disclosures</span>
          </div>
          <div className="space-y-1.5 text-[10px] leading-relaxed">
            <div>
              <strong className="text-midnight-300 font-mono">Node Coordinates:</strong> Exact facility coordinates from master database (<code className="text-midnight-400">fulfillment_nodes</code>).
            </div>
            <div>
              <strong className="text-midnight-300 font-mono">Zone Coordinates:</strong> Approximate urban city centroids (<code className="text-midnight-400">geo_centroids.py</code>), not specific drop-off addresses.
            </div>
            <div>
              <strong className="text-midnight-300 font-mono">Corridor Distances:</strong> Straight-line geodesic spherical displacement (Haversine formula). Highway driving distances and road transit times are not calculated.
            </div>
            <div>
              <strong className="text-midnight-300 font-mono">Corridor Scope:</strong> Displays the top {displayedCorridorsCount} route corridors ranked by volume from {totalUniqueCombinations.toLocaleString()} unique node–zone–carrier combinations in the complete dataset.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
