import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Clock,
  RotateCcw,
  Eye,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { CarrierItem } from '../../../types/carrier';

interface CarrierScorecardTableProps {
  carriers: CarrierItem[];
  onSelectCarrier: (carrierId: string) => void;
}

type SortField = 'shipments' | 'on_time' | 'delays' | 'cutoff' | 'name';
type SortOrder = 'asc' | 'desc';

export const CarrierScorecardTable: React.FC<CarrierScorecardTableProps> = ({
  carriers,
  onSelectCarrier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reverseLogisticsOnly, setReverseLogisticsOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('shipments');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSortedCarriers = useMemo(() => {
    let result = [...carriers];

    // Filter by search
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.carrier_name.toLowerCase().includes(q) ||
          c.carrier_id.toLowerCase().includes(q)
      );
    }

    // Filter by reverse logistics
    if (reverseLogisticsOnly) {
      result = result.filter((c) => c.supports_reverse_logistics);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'shipments':
          comparison = a.shipment_count - b.shipment_count;
          break;
        case 'on_time':
          comparison = a.on_time_rate_pct - b.on_time_rate_pct;
          break;
        case 'delays':
          comparison = a.delayed_shipments - b.delayed_shipments;
          break;
        case 'cutoff':
          comparison = a.pickup_cutoff_time.localeCompare(b.pickup_cutoff_time);
          break;
        case 'name':
          comparison = a.carrier_name.localeCompare(b.carrier_name);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [carriers, searchTerm, reverseLogisticsOnly, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const totalNetworkShipments = useMemo(() => {
    return carriers.reduce((sum, c) => sum + c.shipment_count, 0) || 49436;
  }, [carriers]);

  return (
    <Card className="bg-midnight-900/90 border-midnight-700/80 shadow-xl">
      <CardHeader className="pb-3 border-b border-midnight-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-midnight-100 flex items-center gap-2">
              <span>Carrier Performance Scorecard</span>
              <Badge variant="teal" size="sm">
                {filteredAndSortedCarriers.length} of {carriers.length} Active
              </Badge>
            </CardTitle>
            <p className="text-xs text-midnight-400 mt-0.5">
              Comparative reliability metrics, operating cutoffs, and delivery performance across all third-party carriers.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search carrier name or ID..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-midnight-950 border border-midnight-700 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-52"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-midnight-400 hover:text-midnight-200 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <Button
              variant={reverseLogisticsOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setReverseLogisticsOnly(!reverseLogisticsOnly)}
              className={`text-xs flex items-center gap-1.5 ${
                reverseLogisticsOnly
                  ? 'bg-tactical-teal/20 text-tactical-teal border-tactical-teal/40'
                  : 'border-midnight-700 text-midnight-300'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reverse Logistics Only</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-midnight-700/60 bg-midnight-950/60 text-[11px] font-semibold text-midnight-400 uppercase tracking-wider">
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-midnight-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Carrier</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('cutoff')}
                  className="py-3 px-3 cursor-pointer hover:text-midnight-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Cutoff & Window</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Logistics Support</th>
                <th className="py-3 px-3">Zones Covered</th>
                <th
                  onClick={() => toggleSort('shipments')}
                  className="py-3 px-3 cursor-pointer hover:text-midnight-200 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Volume</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('delays')}
                  className="py-3 px-3 cursor-pointer hover:text-midnight-200 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Delays</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('on_time')}
                  className="py-3 px-4 cursor-pointer hover:text-midnight-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>On-Time Rate</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Service Distribution</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight-800/40 text-xs text-midnight-200">
              {filteredAndSortedCarriers.map((carrier) => {
                const volumeSharePct = (
                  (carrier.shipment_count / totalNetworkShipments) *
                  100
                ).toFixed(1);
                const onTimeRate = carrier.on_time_rate_pct;

                let onTimeColor = 'text-tactical-emerald';
                let progressBg = 'bg-tactical-emerald';
                if (onTimeRate < 97.0) {
                  onTimeColor = 'text-tactical-amber';
                  progressBg = 'bg-tactical-amber';
                } else if (onTimeRate < 97.5) {
                  onTimeColor = 'text-tactical-teal';
                  progressBg = 'bg-tactical-teal';
                }

                return (
                  <tr
                    key={carrier.carrier_id}
                    className="hover:bg-midnight-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectCarrier(carrier.carrier_id)}
                  >
                    {/* Carrier Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-midnight-950 border border-midnight-700/80 flex items-center justify-center font-mono text-xs font-bold text-tactical-cyan">
                          {carrier.carrier_id.replace('CAR-', '')}
                        </div>
                        <div>
                          <div className="font-medium text-midnight-100 flex items-center gap-1.5">
                            <span>{carrier.carrier_name}</span>
                            <span className="text-[10px] font-mono text-midnight-400">
                              ({carrier.carrier_id})
                            </span>
                          </div>
                          <div className="text-[11px] text-midnight-400">
                            {carrier.carrier_type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cutoff & Dispatch Window */}
                    <td className="py-3 px-3 font-mono">
                      <div className="flex items-center gap-1 text-midnight-200">
                        <Clock className="w-3.5 h-3.5 text-tactical-amber" />
                        <span>{carrier.pickup_cutoff_time} Cutoff</span>
                      </div>
                      <div className="text-[10px] text-midnight-400 mt-0.5">
                        {carrier.dispatch_window_start} – {carrier.dispatch_window_end}
                      </div>
                    </td>

                    {/* Logistics Support */}
                    <td className="py-3 px-3">
                      {carrier.supports_reverse_logistics ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-tactical-emerald/15 text-tactical-emerald border border-tactical-emerald/30">
                          <RotateCcw className="w-3 h-3" />
                          <span>Reverse Enabled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-midnight-950 text-midnight-400 border border-midnight-700/60">
                          <span>Forward Only</span>
                        </span>
                      )}
                    </td>

                    {/* Zones Covered */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <MapPin className="w-3.5 h-3.5 text-tactical-cyan" />
                        <span className="font-semibold text-midnight-100">
                          {carrier.covered_zones_count}
                        </span>
                        <span className="text-midnight-500">/ 50</span>
                      </div>
                      <div className="text-[10px] text-midnight-400">
                        {((carrier.covered_zones_count / 50) * 100).toFixed(0)}% zone coverage
                      </div>
                    </td>

                    {/* Volume */}
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-semibold text-midnight-100">
                        {carrier.shipment_count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-tactical-cyan">
                        {volumeSharePct}% share
                      </div>
                    </td>

                    {/* Delays */}
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-semibold text-tactical-crimson">
                        {carrier.delayed_shipments.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-midnight-400">
                        avg {carrier.average_delay_days.toFixed(2)}d
                      </div>
                    </td>

                    {/* On-Time Rate with bar */}
                    <td className="py-3 px-4 min-w-[140px]">
                      <div className="flex items-center justify-between mb-1 font-mono">
                        <span className={`font-bold ${onTimeColor}`}>
                          {carrier.on_time_rate_pct.toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-midnight-400">
                          {carrier.delay_rate_pct.toFixed(2)}% delayed
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-midnight-950 overflow-hidden">
                        <div
                          className={`h-full ${progressBg} rounded-full`}
                          style={{ width: `${carrier.on_time_rate_pct}%` }}
                        />
                      </div>
                    </td>

                    {/* Service Distribution Micro-pills */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {carrier.service_distribution.map((sd) => {
                          let label = 'STD';
                          let pillColor = 'bg-midnight-950 text-midnight-300 border-midnight-700';
                          if (sd.service_code === 'EXPRESS') {
                            label = 'EXP';
                            pillColor = 'bg-tactical-cyan/10 text-tactical-cyan border-tactical-cyan/30';
                          } else if (sd.service_code === 'SAME_DAY') {
                            label = 'SAME';
                            pillColor = 'bg-tactical-amber/10 text-tactical-amber border-tactical-amber/30';
                          }
                          return (
                            <span
                              key={sd.service_code}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${pillColor}`}
                              title={`${sd.service_name}: ${sd.shipment_count.toLocaleString()} shipments (${sd.on_time_rate_pct}% on-time)`}
                            >
                              {label}: {sd.shipment_count.toLocaleString()}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectCarrier(carrier.carrier_id)}
                        className="text-xs text-tactical-teal hover:text-tactical-teal hover:bg-tactical-teal/10 flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filteredAndSortedCarriers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-midnight-400">
                    No carriers match the search criteria &ldquo;{searchTerm}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
