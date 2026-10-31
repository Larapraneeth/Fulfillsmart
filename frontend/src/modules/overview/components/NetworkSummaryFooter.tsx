import { Warehouse, Truck, MapPin, Route } from 'lucide-react';
import { Card, CardContent } from '../../../components/common/Card';
import { NetworkTopologyData } from '../../../types/metrics';

export interface NetworkSummaryFooterProps {
  topology?: NetworkTopologyData;
  activeCarriersCount?: number;
}

export function NetworkSummaryFooter({
  topology,
  activeCarriersCount = 10,
}: NetworkSummaryFooterProps) {
  const nodesCount = topology?.nodes?.length ?? 20;
  const zonesCount = topology?.delivery_zones?.length ?? 50;

  return (
    <Card variant="default" className="border-midnight-700 bg-midnight-900/60">
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1: Fulfillment Nodes */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-midnight-950/60 border border-midnight-800">
            <div className="p-2 rounded-lg bg-tactical-cyan/10 border border-tactical-cyan/30 text-tactical-cyan shrink-0">
              <Warehouse className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-wider text-midnight-400 mb-0.5">
                Fulfillment Network
              </div>
              <div className="text-sm font-bold font-mono text-midnight-100">
                {nodesCount} Active Nodes
              </div>
              <div className="text-[11px] text-midnight-500 font-sans truncate">
                WGS-84 Coordinates Verified
              </div>
            </div>
          </div>

          {/* Pillar 2: Carrier Partners */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-midnight-950/60 border border-midnight-800">
            <div className="p-2 rounded-lg bg-tactical-indigo/10 border border-tactical-indigo/30 text-tactical-indigoLight shrink-0">
              <Truck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-wider text-midnight-400 mb-0.5">
                Carrier Partners
              </div>
              <div className="text-sm font-bold font-mono text-midnight-100">
                {activeCarriersCount} Carrier Networks
              </div>
              <div className="text-[11px] text-midnight-500 font-sans truncate">
                Standard, Express & Same-Day
              </div>
            </div>
          </div>

          {/* Pillar 3: Delivery Zones */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-midnight-950/60 border border-midnight-800">
            <div className="p-2 rounded-lg bg-tactical-teal/10 border border-tactical-teal/30 text-tactical-teal shrink-0">
              <MapPin className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-wider text-midnight-400 mb-0.5">
                Geographic Coverage
              </div>
              <div className="text-sm font-bold font-mono text-midnight-100">
                {zonesCount} Delivery Zones
              </div>
              <div className="text-[11px] text-midnight-500 font-sans truncate">
                Pan-India Urban City Centroids
              </div>
            </div>
          </div>

          {/* Pillar 4: Historical Corridors */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-midnight-950/60 border border-midnight-800">
            <div className="p-2 rounded-lg bg-tactical-amber/10 border border-tactical-amber/30 text-tactical-amber shrink-0">
              <Route className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono uppercase tracking-wider text-midnight-400 mb-0.5">
                Historical Corridors
              </div>
              <div className="text-sm font-bold font-mono text-midnight-100">
                150 historical corridors displayed
              </div>
              <div className="text-[11px] text-midnight-500 font-sans leading-tight mt-0.5">
                Top-volume node–zone–carrier combinations, selected from 2,710 unique combinations.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
