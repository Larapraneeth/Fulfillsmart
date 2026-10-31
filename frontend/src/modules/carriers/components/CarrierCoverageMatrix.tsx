import React, { useState, useMemo } from 'react';
import { MapPin, Search, Filter, Check, X, Globe, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { useCarrierServiceZones } from '../../../api/queries/useCarriers';

interface CarrierCoverageMatrixProps {
  carriers: Array<{ carrier_id: string; carrier_name: string }>;
  onSelectCarrier?: (carrierId: string) => void;
}

export const CarrierCoverageMatrix: React.FC<CarrierCoverageMatrixProps> = ({
  carriers,
  onSelectCarrier,
}) => {
  const [selectedCarrier, setSelectedCarrier] = useState<string>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data: matrixData, isLoading } = useCarrierServiceZones(
    selectedCarrier !== 'ALL' ? selectedCarrier : undefined
  );

  const coverageItems = matrixData?.coverage || [];

  const filteredItems = useMemo(() => {
    return coverageItems.filter((item) => {
      if (selectedRegion !== 'ALL' && item.region !== selectedRegion) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          item.zone_name.toLowerCase().includes(q) ||
          item.delivery_zone_id.toLowerCase().includes(q) ||
          item.city.toLowerCase().includes(q) ||
          item.state.toLowerCase().includes(q) ||
          item.carrier_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [coverageItems, selectedRegion, searchTerm]);

  // Aggregate metrics
  const stats = useMemo(() => {
    const total = filteredItems.length;
    const standard = filteredItems.filter((i) => i.standard_available).length;
    const express = filteredItems.filter((i) => i.express_available).length;
    const sameDay = filteredItems.filter((i) => i.same_day_available).length;
    return {
      total,
      standardPct: total ? ((standard / total) * 100).toFixed(1) : '0.0',
      expressPct: total ? ((express / total) * 100).toFixed(1) : '0.0',
      sameDayPct: total ? ((sameDay / total) * 100).toFixed(1) : '0.0',
      standard,
      express,
      sameDay,
    };
  }, [filteredItems]);

  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    coverageItems.forEach((i) => {
      if (i.region) set.add(i.region);
    });
    return Array.from(set).sort();
  }, [coverageItems]);

  return (
    <div className="space-y-4">
      {/* Coverage Availability KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium">Matching Routes</span>
              <Globe className="w-3.5 h-3.5 text-tactical-teal" />
            </div>
            <div className="text-xl font-bold font-mono text-midnight-100">
              {stats.total}
            </div>
            <div className="text-[10px] text-midnight-400 mt-0.5">
              of 335 total carrier-zone routes
            </div>
          </CardContent>
        </Card>

        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium">Standard Coverage</span>
              <Layers className="w-3.5 h-3.5 text-tactical-teal" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-teal">
              {stats.standardPct}%
            </div>
            <div className="text-[10px] text-midnight-400 mt-0.5">
              {stats.standard} of {stats.total} routes
            </div>
          </CardContent>
        </Card>

        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium">Express Coverage</span>
              <Layers className="w-3.5 h-3.5 text-tactical-cyan" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-cyan">
              {stats.expressPct}%
            </div>
            <div className="text-[10px] text-midnight-400 mt-0.5">
              {stats.express} of {stats.total} routes
            </div>
          </CardContent>
        </Card>

        <Card className="bg-midnight-900/70 border-midnight-700/60">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-midnight-400 mb-1">
              <span className="text-xs font-medium">Same Day Coverage</span>
              <Layers className="w-3.5 h-3.5 text-tactical-amber" />
            </div>
            <div className="text-xl font-bold font-mono text-tactical-amber">
              {stats.sameDayPct}%
            </div>
            <div className="text-[10px] text-midnight-400 mt-0.5">
              {stats.sameDay} of {stats.total} routes
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Coverage Explorer Card */}
      <Card className="bg-midnight-900/90 border-midnight-700/80 shadow-xl">
        <CardHeader className="pb-3 border-b border-midnight-700/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-midnight-100 flex items-center gap-2">
                <span>Master Carrier-to-Zone Service Availability</span>
                <Badge variant="teal" size="sm">
                  {filteredItems.length} Routes
                </Badge>
              </CardTitle>
              <p className="text-xs text-midnight-400 mt-0.5">
                Evaluates Standard, Express, and Same-Day service eligibility across 50 delivery zones and 10 third-party carriers.
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
                    All 10 Carriers
                  </option>
                  {carriers.map((c) => (
                    <option key={c.carrier_id} value={c.carrier_id} className="bg-midnight-900">
                      {c.carrier_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region Dropdown */}
              {uniqueRegions.length > 0 && (
                <div className="flex items-center gap-1.5 bg-midnight-950 border border-midnight-700 rounded-lg px-2.5 py-1 text-xs">
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="bg-transparent text-midnight-100 focus:outline-none text-xs cursor-pointer"
                  >
                    <option value="ALL" className="bg-midnight-900">
                      All Regions
                    </option>
                    {uniqueRegions.map((reg) => (
                      <option key={reg} value={reg} className="bg-midnight-900">
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search city, zone, state..."
                  className="pl-8 pr-3 py-1 rounded-lg bg-midnight-950 border border-midnight-700 text-xs text-midnight-100 placeholder-midnight-500 focus:outline-none focus:border-tactical-teal w-48"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-midnight-700/60 bg-midnight-950 text-[11px] font-semibold text-midnight-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-3">Delivery Zone</th>
                  <th className="py-3 px-3">Destination City & State</th>
                  <th className="py-3 px-3">Region</th>
                  <th className="py-3 px-3 text-center">Standard</th>
                  <th className="py-3 px-3 text-center">Express</th>
                  <th className="py-3 px-3 text-center">Same Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-midnight-800/40 text-xs text-midnight-200">
                {filteredItems.map((item) => (
                  <tr
                    key={`${item.carrier_id}-${item.delivery_zone_id}`}
                    className="hover:bg-midnight-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div
                        className="font-medium text-midnight-100 hover:text-tactical-teal transition-colors cursor-pointer"
                        onClick={() => onSelectCarrier && onSelectCarrier(item.carrier_id)}
                      >
                        {item.carrier_name}
                      </div>
                      <div className="text-[10px] font-mono text-midnight-400">
                        {item.carrier_id}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono">
                      <div className="flex items-center gap-1.5 text-midnight-100">
                        <MapPin className="w-3 h-3 text-tactical-teal" />
                        <span>{item.delivery_zone_id}</span>
                      </div>
                      <div className="text-[10px] text-midnight-400">{item.zone_name}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="text-midnight-200">{item.city}</div>
                      <div className="text-[10px] text-midnight-400">{item.state}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-midnight-950 border border-midnight-700/60 text-midnight-300">
                        {item.region}
                      </span>
                    </td>

                    {/* Standard Available */}
                    <td className="py-2.5 px-3 text-center">
                      {item.standard_available ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-midnight-950 text-midnight-600 border border-midnight-800">
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </td>

                    {/* Express Available */}
                    <td className="py-2.5 px-3 text-center">
                      {item.express_available ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-tactical-cyan/15 text-tactical-cyan border border-tactical-cyan/30">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-midnight-950 text-midnight-600 border border-midnight-800">
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </td>

                    {/* Same Day Available */}
                    <td className="py-2.5 px-3 text-center">
                      {item.same_day_available ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-tactical-amber/15 text-tactical-amber border border-tactical-amber/30">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-midnight-950 text-midnight-600 border border-midnight-800">
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-midnight-400">
                      No service coverage routes match the selected filters.
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
