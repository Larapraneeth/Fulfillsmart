import React, { useState, useMemo } from 'react';
import { Truck, ArrowUpDown, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { CarrierDeliveryPerformanceItem } from '../../../types/tracking';

interface CarrierDeliveryComparisonTableProps {
  carriers: CarrierDeliveryPerformanceItem[];
  onSelectCarrier?: (carrierId: string) => void;
}

type SortField = 'volume' | 'delays' | 'on_time' | 'delay_days' | 'name';
type SortOrder = 'asc' | 'desc';

export const CarrierDeliveryComparisonTable: React.FC<CarrierDeliveryComparisonTableProps> = ({
  carriers,
  onSelectCarrier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSortedCarriers = useMemo(() => {
    let list = [...carriers];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.carrier_name.toLowerCase().includes(q) ||
          c.carrier_id.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case 'volume':
          comp = a.shipment_count - b.shipment_count;
          break;
        case 'delays':
          comp = a.delayed_shipments - b.delayed_shipments;
          break;
        case 'on_time':
          comp = a.on_time_rate_pct - b.on_time_rate_pct;
          break;
        case 'delay_days':
          comp = a.average_delay_days - b.average_delay_days;
          break;
        case 'name':
          comp = a.carrier_name.localeCompare(b.carrier_name);
          break;
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    return list;
  }, [carriers, searchTerm, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const totalShipments = useMemo(() => {
    return carriers.reduce((sum, c) => sum + c.shipment_count, 0) || 49436;
  }, [carriers]);

  return (
    <Card className="bg-midnight-900/90 border-midnight-700/80 shadow-xl">
      <CardHeader className="pb-3 border-b border-midnight-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-midnight-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-tactical-teal" />
              <span>Carrier Delivery Performance Comparison</span>
              <Badge variant="teal" size="sm">
                10 Carriers
              </Badge>
            </CardTitle>
            <p className="text-xs text-midnight-400 mt-0.5">
              Comparative consignment volume, transit delay frequencies, and on-time delivery rates across 3PL carriers.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search carrier..."
              className="pl-8 pr-3 py-1 rounded-lg bg-midnight-950 border border-midnight-700 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-48"
            />
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
                  onClick={() => toggleSort('volume')}
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
                  onClick={() => toggleSort('delay_days')}
                  className="py-3 px-3 cursor-pointer hover:text-midnight-200 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Avg Delay</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('on_time')}
                  className="py-3 px-4 cursor-pointer hover:text-midnight-200 transition-colors min-w-[160px]"
                >
                  <div className="flex items-center gap-1">
                    <span>On-Time Rate</span>
                    <ArrowUpDown className="w-3 h-3 text-midnight-500" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight-800/40 text-xs text-midnight-200">
              {filteredAndSortedCarriers.map((c) => {
                const sharePct = ((c.shipment_count / totalShipments) * 100).toFixed(1);
                const rate = c.on_time_rate_pct;

                let rateColor = 'text-tactical-emerald';
                let barBg = 'bg-tactical-emerald';
                if (rate < 97.0) {
                  rateColor = 'text-tactical-amber';
                  barBg = 'bg-tactical-amber';
                } else if (rate < 97.5) {
                  rateColor = 'text-tactical-teal';
                  barBg = 'bg-tactical-teal';
                }

                return (
                  <tr
                    key={c.carrier_id}
                    className="hover:bg-midnight-800/40 transition-colors cursor-pointer"
                    onClick={() => onSelectCarrier && onSelectCarrier(c.carrier_id)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-midnight-100 hover:text-tactical-teal transition-colors">
                        {c.carrier_name}
                      </div>
                      <div className="text-[10px] font-mono text-midnight-400">{c.carrier_id}</div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-semibold text-midnight-100">
                        {c.shipment_count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-tactical-cyan">{sharePct}% share</div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-tactical-crimson font-semibold">
                      {c.delayed_shipments.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-midnight-300">
                      {c.average_delay_days.toFixed(2)}d
                    </td>

                    <td className="py-3 px-4 min-w-[160px]">
                      <div className="flex items-center justify-between mb-1 font-mono">
                        <span className={`font-bold ${rateColor}`}>{rate.toFixed(2)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-midnight-950 overflow-hidden">
                        <div
                          className={`h-full ${barBg} rounded-full`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
