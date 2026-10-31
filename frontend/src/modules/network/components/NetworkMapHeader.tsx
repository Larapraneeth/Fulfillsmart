import { RefreshCw, Filter, Network, Info } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';

export interface NetworkMapHeaderProps {
  nodesCount?: number;
  zonesCount?: number;
  corridorsCount?: number;
  totalUniqueCombinations?: number;
  carriers: Array<{ carrier_id: string; carrier_name: string }>;
  selectedCarrierId: string;
  onSelectCarrier: (carrierId: string) => void;
  isFetching?: boolean;
  onRefresh?: () => void;
}

export function NetworkMapHeader({
  nodesCount = 20,
  zonesCount = 50,
  corridorsCount = 150,
  totalUniqueCombinations = 2710,
  carriers,
  selectedCarrierId,
  onSelectCarrier,
  isFetching = false,
  onRefresh,
}: NetworkMapHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-midnight-700">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-midnight-100 font-display flex items-center gap-2.5">
            <Network className="w-6 h-6 text-tactical-teal shrink-0" aria-hidden="true" />
            Interactive India Network Map
          </h1>
          <Badge variant="teal" size="sm" pulse>
            Tactical Topology
          </Badge>
        </div>
        <p className="text-sm text-midnight-400 font-sans flex items-center gap-1.5 flex-wrap">
          <span>Pan-India fulfillment topology: {nodesCount} active nodes, {zonesCount} delivery zones, and {corridorsCount} displayed historical corridors</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-midnight-400 font-mono bg-midnight-900/60 px-2 py-0.5 rounded border border-midnight-800">
            <Info className="w-3 h-3 text-tactical-cyan shrink-0" aria-hidden="true" />
            Selected from {totalUniqueCombinations.toLocaleString()} combinations
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Status Counter Badges */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-midnight-900 border border-midnight-700 text-xs font-mono">
          <span className="text-midnight-400">Nodes:</span>
          <span className="font-semibold text-tactical-teal">{nodesCount} Active</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-midnight-900 border border-midnight-700 text-xs font-mono">
          <span className="text-midnight-400">Zones:</span>
          <span className="font-semibold text-tactical-cyan">{zonesCount} Centroids</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-midnight-900 border border-midnight-700 text-xs font-mono">
          <span className="text-midnight-400">Corridors:</span>
          <span className="font-semibold text-tactical-amber">{corridorsCount} Displayed</span>
        </div>

        {/* Carrier Filter Dropdown */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-midnight-900 border border-midnight-700 text-xs font-mono">
          <Filter className="w-3.5 h-3.5 text-midnight-400 shrink-0" aria-hidden="true" />
          <label htmlFor="carrier-filter-select" className="sr-only">
            Filter corridors by carrier
          </label>
          <select
            id="carrier-filter-select"
            value={selectedCarrierId}
            onChange={(e) => onSelectCarrier(e.target.value)}
            className="bg-transparent text-midnight-200 border-none outline-none cursor-pointer pr-1 py-0.5 font-mono text-xs focus-visible:ring-1 focus-visible:ring-tactical-cyan rounded"
            aria-label="Filter corridors by carrier"
          >
            <option value="ALL" className="bg-midnight-950 text-midnight-100">
              All Carriers {carriers.length > 0 ? `(${carriers.length})` : ''}
            </option>
            {carriers.map((c) => (
              <option
                key={c.carrier_id}
                value={c.carrier_id}
                className="bg-midnight-950 text-midnight-100"
              >
                {c.carrier_name} ({c.carrier_id})
              </option>
            ))}
          </select>
        </div>

        {/* Sync Telemetry Button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="gap-2 text-xs font-mono"
            aria-label="Refresh network topology data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-tactical-cyan ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isFetching ? 'Syncing...' : 'Sync Topology'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
