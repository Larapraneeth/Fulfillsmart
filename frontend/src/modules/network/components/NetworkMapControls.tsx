import { ZoomIn, ZoomOut, RotateCcw, Layers, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/common/Button';

export interface NetworkMapControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  showCorridors: boolean;
  showDeliveryZones: boolean;
  showFulfillmentNodes: boolean;
  onToggleCorridors: () => void;
  onToggleDeliveryZones: () => void;
  onToggleFulfillmentNodes: () => void;
  minShipmentCount: number;
  onMinShipmentCountChange: (count: number) => void;
  displayedCorridorsCount: number;
  nodesCount?: number;
  zonesCount?: number;
}

export function NetworkMapControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetView,
  showCorridors,
  showDeliveryZones,
  showFulfillmentNodes,
  onToggleCorridors,
  onToggleDeliveryZones,
  onToggleFulfillmentNodes,
  minShipmentCount,
  onMinShipmentCountChange,
  displayedCorridorsCount,
  nodesCount = 20,
  zonesCount = 50,
}: NetworkMapControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-midnight-700 bg-midnight-900/80 backdrop-blur-sm text-xs font-mono">
      {/* Group 1: Layer Visibility Toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-midnight-400 mr-1">
          <Layers className="w-3.5 h-3.5 text-tactical-teal" aria-hidden="true" />
          <span>Layers:</span>
        </div>

        {/* Nodes Layer Toggle */}
        <button
          type="button"
          onClick={onToggleFulfillmentNodes}
          className={`px-2.5 py-1 rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-teal ${
            showFulfillmentNodes
              ? 'bg-tactical-teal/15 border-tactical-teal/40 text-tactical-teal font-semibold'
              : 'bg-midnight-950 border-midnight-800 text-midnight-500 hover:text-midnight-300'
          }`}
          aria-pressed={showFulfillmentNodes}
          aria-label="Toggle fulfillment nodes layer visibility"
        >
          ● Nodes ({nodesCount})
        </button>

        {/* Delivery Zones Layer Toggle */}
        <button
          type="button"
          onClick={onToggleDeliveryZones}
          className={`px-2.5 py-1 rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-cyan ${
            showDeliveryZones
              ? 'bg-tactical-cyan/15 border-tactical-cyan/40 text-tactical-cyan font-semibold'
              : 'bg-midnight-950 border-midnight-800 text-midnight-500 hover:text-midnight-300'
          }`}
          aria-pressed={showDeliveryZones}
          aria-label="Toggle delivery zones layer visibility"
        >
          ◆ Zones ({zonesCount})
        </button>

        {/* Corridors Layer Toggle */}
        <button
          type="button"
          onClick={onToggleCorridors}
          className={`px-2.5 py-1 rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tactical-amber ${
            showCorridors
              ? 'bg-tactical-amber/15 border-tactical-amber/40 text-tactical-amber font-semibold'
              : 'bg-midnight-950 border-midnight-800 text-midnight-500 hover:text-midnight-300'
          }`}
          aria-pressed={showCorridors}
          aria-label="Toggle historical corridors layer visibility"
        >
          ⌒ Corridors ({displayedCorridorsCount})
        </button>
      </div>

      {/* Group 2: Volume Threshold & Zoom Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Shipment Volume Threshold Filter */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-midnight-950 border border-midnight-800">
          <SlidersHorizontal className="w-3.5 h-3.5 text-midnight-400" aria-hidden="true" />
          <label htmlFor="volume-threshold-select" className="text-midnight-400 text-[11px]">
            Min Volume:
          </label>
          <select
            id="volume-threshold-select"
            value={minShipmentCount}
            onChange={(e) => onMinShipmentCountChange(Number(e.target.value))}
            className="bg-transparent text-midnight-100 border-none outline-none cursor-pointer py-0.5 text-xs font-mono focus-visible:ring-1 focus-visible:ring-tactical-cyan rounded"
            aria-label="Filter corridors by minimum shipment volume"
          >
            <option value={0} className="bg-midnight-950 text-midnight-100">
              All Displayed Lanes (≥ 0)
            </option>
            <option value={90} className="bg-midnight-950 text-midnight-100">
              ≥ 90 Shipments
            </option>
            <option value={120} className="bg-midnight-950 text-midnight-100">
              ≥ 120 Shipments
            </option>
            <option value={150} className="bg-midnight-950 text-midnight-100">
              ≥ 150 Top Volume
            </option>
          </select>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-midnight-950 p-1 rounded-md border border-midnight-800">
          <span className="text-[11px] text-midnight-400 px-1.5 min-w-[3rem] text-center" aria-live="polite">
            {(zoomLevel * 100).toFixed(0)}%
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomIn}
            className="p-1 h-7 w-7 text-midnight-300 hover:text-tactical-cyan hover:bg-midnight-800"
            aria-label="Zoom in map"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomOut}
            className="p-1 h-7 w-7 text-midnight-300 hover:text-tactical-cyan hover:bg-midnight-800"
            aria-label="Zoom out map"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onResetView}
            className="p-1 h-7 w-7 text-midnight-300 hover:text-tactical-teal hover:bg-midnight-800"
            aria-label="Reset map view to default zoom and pan"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
