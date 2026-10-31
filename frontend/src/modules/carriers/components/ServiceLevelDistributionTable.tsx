import React, { useState, useMemo } from 'react';
import { Layers, Search, Filter, Clock, ShieldCheck, Weight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { ServiceLevelPerformanceItem } from '../../../types/carrier';

interface ServiceLevelDistributionTableProps {
  serviceLevels: ServiceLevelPerformanceItem[];
  carriers: Array<{ carrier_id: string; carrier_name: string }>;
  onSelectCarrier?: (carrierId: string) => void;
}

export const ServiceLevelDistributionTable: React.FC<ServiceLevelDistributionTableProps> = ({
  serviceLevels,
  carriers,
  onSelectCarrier,
}) => {
  const [selectedCarrier, setSelectedCarrier] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredTiers = useMemo(() => {
    return serviceLevels.filter((sl) => {
      if (selectedCarrier !== 'ALL' && sl.carrier_id !== selectedCarrier) {
        return false;
      }
      if (selectedTier !== 'ALL' && sl.service_code !== selectedTier) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          sl.service_name.toLowerCase().includes(q) ||
          sl.service_level_id.toLowerCase().includes(q) ||
          sl.carrier_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [serviceLevels, selectedCarrier, selectedTier, searchTerm]);

  // Aggregate stats by tier
  const tierAggregates = useMemo(() => {
    const agg: Record<
      string,
      { volume: number; delayed: number; totalOnTime: number; count: number }
    > = {
      STANDARD: { volume: 0, delayed: 0, totalOnTime: 0, count: 0 },
      EXPRESS: { volume: 0, delayed: 0, totalOnTime: 0, count: 0 },
      SAME_DAY: { volume: 0, delayed: 0, totalOnTime: 0, count: 0 },
    };

    serviceLevels.forEach((sl) => {
      const code = sl.service_code;
      if (agg[code]) {
        agg[code].volume += sl.shipment_count;
        agg[code].delayed += sl.delayed_shipments;
        agg[code].count += 1;
      }
    });

    return agg;
  }, [serviceLevels]);

  return (
    <div className="space-y-4">
      {/* 3 Tier Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Standard Tier */}
        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tactical-teal" />
                STANDARD (4 Nominal Days)
              </span>
              <Clock className="w-3.5 h-3.5 text-tactical-teal" />
            </div>
            <div className="text-lg font-bold font-mono text-midnight-100">
              {tierAggregates.STANDARD.volume.toLocaleString()}{' '}
              <span className="text-xs font-normal text-midnight-400">shipments</span>
            </div>
            <div className="text-xs font-mono text-tactical-teal mt-0.5">
              {tierAggregates.STANDARD.volume > 0
                ? `${(
                    (1 -
                      tierAggregates.STANDARD.delayed /
                        tierAggregates.STANDARD.volume) *
                    100
                  ).toFixed(2)}% on-time`
                : '---'}
              <span className="text-midnight-500 font-sans ml-1">
                ({tierAggregates.STANDARD.delayed} delays)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Express Tier */}
        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tactical-cyan" />
                EXPRESS (2 Nominal Days)
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-tactical-cyan" />
            </div>
            <div className="text-lg font-bold font-mono text-midnight-100">
              {tierAggregates.EXPRESS.volume.toLocaleString()}{' '}
              <span className="text-xs font-normal text-midnight-400">shipments</span>
            </div>
            <div className="text-xs font-mono text-tactical-cyan mt-0.5">
              {tierAggregates.EXPRESS.volume > 0
                ? `${(
                    (1 -
                      tierAggregates.EXPRESS.delayed /
                        tierAggregates.EXPRESS.volume) *
                    100
                  ).toFixed(2)}% on-time`
                : '---'}
              <span className="text-midnight-500 font-sans ml-1">
                ({tierAggregates.EXPRESS.delayed} delays)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Same Day Tier */}
        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tactical-amber" />
                SAME DAY (0 Transit Days)
              </span>
              <Layers className="w-3.5 h-3.5 text-tactical-amber" />
            </div>
            <div className="text-lg font-bold font-mono text-midnight-100">
              {tierAggregates.SAME_DAY.volume.toLocaleString()}{' '}
              <span className="text-xs font-normal text-midnight-400">shipments</span>
            </div>
            <div className="text-xs font-mono text-tactical-amber mt-0.5">
              {tierAggregates.SAME_DAY.volume > 0
                ? `${(
                    (1 -
                      tierAggregates.SAME_DAY.delayed /
                        tierAggregates.SAME_DAY.volume) *
                    100
                  ).toFixed(2)}% on-time`
                : '---'}
              <span className="text-midnight-500 font-sans ml-1">
                ({tierAggregates.SAME_DAY.delayed} delays)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="bg-midnight-900/90 border-midnight-700/80 shadow-xl">
        <CardHeader className="pb-3 border-b border-midnight-700/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-midnight-100 flex items-center gap-2">
                <span>All 30 Service Level Tiers</span>
                <Badge variant="teal" size="sm">
                  {filteredTiers.length} Showing
                </Badge>
              </CardTitle>
              <p className="text-xs text-midnight-400 mt-0.5">
                Transit commitments, payload weight limits, and delivery performance by carrier service level.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Carrier Dropdown */}
              <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
                <Filter className="w-3.5 h-3.5 text-midnight-400" />
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="ALL" className="bg-midnight-900">
                    All Carriers
                  </option>
                  {carriers.map((c) => (
                    <option key={c.carrier_id} value={c.carrier_id} className="bg-midnight-900">
                      {c.carrier_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Tier Dropdown */}
              <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="ALL" className="bg-midnight-900">
                    All Service Levels
                  </option>
                  <option value="STANDARD" className="bg-midnight-900">
                    STANDARD (4 days)
                  </option>
                  <option value="EXPRESS" className="bg-midnight-900">
                    EXPRESS (2 days)
                  </option>
                  <option value="SAME_DAY" className="bg-midnight-900">
                    SAME_DAY (0 days)
                  </option>
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search service name..."
                  className="pl-8 pr-3 py-1 rounded-lg bg-midnight-950 border border-midnight-700 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-44"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-midnight-700/60 bg-midnight-950/60 text-[11px] font-semibold text-midnight-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Service Level ID</th>
                  <th className="py-3 px-3">Carrier</th>
                  <th className="py-3 px-3">Service Code & Name</th>
                  <th className="py-3 px-3">Nominal Transit</th>
                  <th className="py-3 px-3">Max Weight</th>
                  <th className="py-3 px-3 text-right">Shipments</th>
                  <th className="py-3 px-3 text-right">Delays</th>
                  <th className="py-3 px-4">On-Time Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-800/40 text-xs text-midnight-200">
                {filteredTiers.map((sl) => {
                  let badgeVariant: 'teal' | 'cyan' | 'amber' = 'teal';
                  if (sl.service_code === 'EXPRESS') badgeVariant = 'cyan';
                  if (sl.service_code === 'SAME_DAY') badgeVariant = 'amber';

                  return (
                    <tr
                      key={sl.service_level_id}
                      className="hover:bg-midnight-800/40 transition-colors cursor-pointer"
                      onClick={() => onSelectCarrier && onSelectCarrier(sl.carrier_id)}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-midnight-100">
                        {sl.service_level_id}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-midnight-100 hover:text-tactical-teal transition-colors">
                          {sl.carrier_name}
                        </div>
                        <div className="text-[10px] font-mono text-midnight-400">
                          {sl.carrier_id}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeVariant} size="sm">
                            {sl.service_code}
                          </Badge>
                          <span className="text-midnight-300">{sl.service_name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <span className="text-midnight-100 font-semibold">
                          {sl.nominal_transit_days}
                        </span>{' '}
                        <span className="text-midnight-400 text-[11px]">business days</span>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-1 text-midnight-300">
                          <Weight className="w-3.5 h-3.5 text-midnight-500" />
                          <span>{sl.max_weight_kg} kg</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-midnight-100">
                        {sl.shipment_count.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-tactical-crimson">
                        {sl.delayed_shipments.toLocaleString()}
                        <div className="text-[10px] text-midnight-500">
                          {sl.average_delay_days.toFixed(2)}d avg
                        </div>
                      </td>

                      <td className="py-3 px-4 min-w-[150px]">
                        <div className="flex items-center justify-between mb-1 font-mono">
                          <span
                            className={`font-bold ${
                              sl.on_time_rate_pct >= 97.5
                                ? 'text-tactical-emerald'
                                : sl.on_time_rate_pct >= 97.0
                                ? 'text-tactical-teal'
                                : 'text-tactical-amber'
                            }`}
                          >
                            {sl.on_time_rate_pct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-midnight-950 overflow-hidden">
                          <div
                            className={`h-full ${
                              sl.on_time_rate_pct >= 97.5
                                ? 'bg-tactical-emerald'
                                : sl.on_time_rate_pct >= 97.0
                                ? 'bg-tactical-teal'
                                : 'bg-tactical-amber'
                            } rounded-full`}
                            style={{ width: `${sl.on_time_rate_pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredTiers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-midnight-400">
                      No service levels match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
