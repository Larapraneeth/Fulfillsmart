import React, { useState } from 'react';
import {
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Layers,
  Plus,
  Trash2,
  Zap,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  OrderRequestPayload,
  OrderLineRequestPayload,
  AllocationOutcome,
  AllocationPresetScenario,
} from '../../../types/allocation';
import { useAllocateOrderMutation, useAllocateBatchMutation } from '../../../api/queries/useAllocation';

// The 50 Indian Delivery Zones
const DELIVERY_ZONES = [
  { id: 'DZ-001', name: 'Hyderabad Urban', city: 'Hyderabad' },
  { id: 'DZ-002', name: 'Bengaluru Central', city: 'Bengaluru' },
  { id: 'DZ-003', name: 'Chennai Metro', city: 'Chennai' },
  { id: 'DZ-004', name: 'Visakhapatnam Port', city: 'Visakhapatnam' },
  { id: 'DZ-005', name: 'Kochi Coastal', city: 'Kochi' },
  { id: 'DZ-006', name: 'Mumbai City', city: 'Mumbai' },
  { id: 'DZ-007', name: 'Ahmedabad West', city: 'Ahmedabad' },
  { id: 'DZ-008', name: 'Panaji Urban', city: 'Panaji' },
  { id: 'DZ-009', name: 'Jaipur Central', city: 'Jaipur' },
  { id: 'DZ-010', name: 'Delhi Core', city: 'Delhi' },
  { id: 'DZ-011', name: 'Gurugram Tech', city: 'Gurugram' },
  { id: 'DZ-012', name: 'Ludhiana Industrial', city: 'Ludhiana' },
  { id: 'DZ-013', name: 'Lucknow Metro', city: 'Lucknow' },
  { id: 'DZ-014', name: 'Dehradun Valley', city: 'Dehradun' },
  { id: 'DZ-015', name: 'Shimla Ridge', city: 'Shimla' },
  { id: 'DZ-016', name: 'Jammu Hills', city: 'Jammu' },
  { id: 'DZ-017', name: 'Kolkata Central', city: 'Kolkata' },
  { id: 'DZ-018', name: 'Patna Urban', city: 'Patna' },
  { id: 'DZ-019', name: 'Bhubaneswar Capital', city: 'Bhubaneswar' },
  { id: 'DZ-020', name: 'Ranchi Plateau', city: 'Ranchi' },
  { id: 'DZ-028', name: 'Bhopal Central', city: 'Bhopal' },
  { id: 'DZ-031', name: 'Pune West', city: 'Pune' },
  { id: 'DZ-032', name: 'Nagpur Central', city: 'Nagpur' },
  { id: 'DZ-033', name: 'Surat Textile', city: 'Surat' },
  { id: 'DZ-035', name: 'Coimbatore South', city: 'Coimbatore' },
  { id: 'DZ-040', name: 'Noida Expressway', city: 'Noida' },
  { id: 'DZ-047', name: 'Indore Commercial', city: 'Indore' },
  { id: 'DZ-050', name: 'Faridabad Hub', city: 'Faridabad' },
];

// 5 Comprehensive Engine Test Scenarios
const PRESET_SCENARIOS: AllocationPresetScenario[] = [
  {
    id: 'single_node',
    title: '1. Nearest Single-Node Match',
    description: 'Hyderabad Urban delivery zone; tests greedy single-node fulfillment from closest warehouse.',
    tag: 'Greedy Single Node',
    payload: {
      order_id: 'SIM-SINGLE-001',
      customer_id: 'CUST-SIM-001',
      order_time: '2026-05-20T10:00:00+05:30', // Wednesday
      destination_zone_id: 'DZ-001',
      requested_service: 'STANDARD',
      order_priority: 'NORMAL',
      allow_splits: true,
      lines: [{ order_line_id: 'SOL-001', sku_id: 'SKU-000001', quantity: 2 }],
    },
  },
  {
    id: 'sunday_shift',
    title: '2. Sunday Operating Shift Rule',
    description: 'Order placed on a Sunday; warehouse capacity is 0 on Sundays, shifting processing to Monday.',
    tag: 'Sunday Shift',
    payload: {
      order_id: 'SIM-SUNDAY-002',
      customer_id: 'CUST-SIM-002',
      order_time: '2026-05-17T14:30:00+05:30', // Sunday (weekday 6)
      destination_zone_id: 'DZ-001',
      requested_service: 'STANDARD',
      order_priority: 'NORMAL',
      allow_splits: true,
      lines: [{ order_line_id: 'SOL-002', sku_id: 'SKU-000001', quantity: 1 }],
    },
  },
  {
    id: 'split_fallback',
    title: '3. Multi-Node Split Fallback',
    description: 'Order quantity (250 units) exceeds single-warehouse capacity (148 units max); triggers multi-node split across nearest feasible nodes.',
    tag: 'Multi-Node Split',
    payload: {
      order_id: 'SIM-SPLIT-003',
      customer_id: 'CUST-SIM-003',
      order_time: '2026-05-20T10:00:00+05:30',
      destination_zone_id: 'DZ-001',
      requested_service: 'STANDARD',
      order_priority: 'NORMAL',
      allow_splits: true,
      lines: [
        { order_line_id: 'SOL-003', sku_id: 'SKU-000001', quantity: 250 },
      ],
    },
  },
  {
    id: 'split_disabled',
    title: '4. Split Policy Rejection',
    description: 'Order requires multi-node split (250 units), but allow_splits policy is disabled; engine rejects allocation with SPLIT_ALLOCATION_DISABLED.',
    tag: 'Policy Rejection',
    payload: {
      order_id: 'SIM-NOSPLIT-004',
      customer_id: 'CUST-SIM-004',
      order_time: '2026-05-20T10:00:00+05:30',
      destination_zone_id: 'DZ-001',
      requested_service: 'STANDARD',
      order_priority: 'NORMAL',
      allow_splits: false,
      lines: [
        { order_line_id: 'SOL-004', sku_id: 'SKU-000001', quantity: 250 },
      ],
    },
  },
  {
    id: 'stock_shortage',
    title: '5. Network Shortage & Zero Rollback',
    description: 'Quantity exceeds total network stock; engine rolls back staged deductions with zero partial reservations.',
    tag: 'Shortage Rollback',
    payload: {
      order_id: 'SIM-SHORTAGE-005',
      customer_id: 'CUST-SIM-005',
      order_time: '2026-05-20T10:00:00+05:30',
      destination_zone_id: 'DZ-001',
      requested_service: 'STANDARD',
      order_priority: 'NORMAL',
      allow_splits: true,
      lines: [{ order_line_id: 'SOL-005', sku_id: 'SKU-000001', quantity: 9999999 }],
    },
  },
];

export const AllocationSandbox: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('single_node');
  const [formData, setFormData] = useState<OrderRequestPayload>(PRESET_SCENARIOS[0].payload);
  const [singleOutcome, setSingleOutcome] = useState<AllocationOutcome | null>(null);
  const [batchOutcomes, setBatchOutcomes] = useState<AllocationOutcome[] | null>(null);

  const allocateOrderMutation = useAllocateOrderMutation();
  const allocateBatchMutation = useAllocateBatchMutation();

  const handleSelectScenario = (scenario: AllocationPresetScenario) => {
    setActiveScenarioId(scenario.id);
    setFormData(JSON.parse(JSON.stringify(scenario.payload)));
    setSingleOutcome(null);
    setBatchOutcomes(null);
  };

  const handleAddLine = () => {
    const nextLineIdx = formData.lines.length + 1;
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        {
          order_line_id: `SOL-${Date.now().toString().slice(-4)}-${nextLineIdx}`,
          sku_id: 'SKU-000001',
          quantity: 1,
        },
      ],
    });
  };

  const handleRemoveLine = (idx: number) => {
    if (formData.lines.length <= 1) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== idx),
    });
  };

  const handleLineChange = (idx: number, field: keyof OrderLineRequestPayload, value: string | number) => {
    const updated = [...formData.lines];
    if (field === 'quantity') {
      updated[idx] = { ...updated[idx], quantity: Math.max(1, Number(value) || 1) };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setFormData({ ...formData, lines: updated });
  };

  const handleEvaluateSingle = async () => {
    setBatchOutcomes(null);
    try {
      const result = await allocateOrderMutation.mutateAsync(formData);
      setSingleOutcome(result);
    } catch (err) {
      console.error('Failed to evaluate allocation:', err);
    }
  };

  const handleEvaluateAllBatch = async () => {
    setSingleOutcome(null);
    try {
      const orders = PRESET_SCENARIOS.map((s) => s.payload);
      const results = await allocateBatchMutation.mutateAsync({ orders, allow_splits: true });
      setBatchOutcomes(results);
    } catch (err) {
      console.error('Failed to evaluate batch:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Preset Scenario Selector */}
      <Card className="bg-midnight-900 border-midnight-700">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-tactical-teal/15 border border-tactical-teal/30 text-tactical-teal">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-midnight-100 font-display">
                  Interactive Fulfillment Node Allocation Sandbox
                </h3>
                <p className="text-xs text-midnight-400 mt-0.5">
                  Evaluate candidate orders statelessly in-memory using the actual production allocation engine.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluateAllBatch}
              disabled={allocateBatchMutation.isPending}
              className="flex items-center gap-1.5 border-tactical-teal/40 text-tactical-teal hover:bg-tactical-teal/10"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Evaluate All 5 Scenarios (Batch)</span>
            </Button>
          </div>

          {/* Scenario Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-midnight-800">
            {PRESET_SCENARIOS.map((scenario) => {
              const isSelected = activeScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => handleSelectScenario(scenario)}
                  className={`p-2.5 text-left rounded-lg border transition-all text-xs ${
                    isSelected
                      ? 'bg-midnight-800 border-tactical-teal text-midnight-100 shadow-[0_0_12px_rgba(0,242,254,0.15)]'
                      : 'bg-midnight-950 border-midnight-800 text-midnight-400 hover:text-midnight-200 hover:border-midnight-700'
                  }`}
                >
                  <div className="font-semibold truncate">{scenario.title}</div>
                  <div className="text-[10px] text-midnight-500 mt-1 line-clamp-1">
                    {scenario.tag}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Form on Left, Output on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Candidate Order Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-midnight-900 border-midnight-700">
            <CardHeader className="pb-3 border-b border-midnight-800">
              <CardTitle className="text-sm font-bold text-midnight-100 flex items-center justify-between">
                <span>Candidate Order Configuration</span>
                <span className="text-xs font-mono text-tactical-teal">{formData.order_id}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4 text-xs font-mono">
              {/* Destination Delivery Zone */}
              <div>
                <label className="block text-midnight-400 text-[11px] mb-1 font-sans">
                  Destination Delivery Zone:
                </label>
                <select
                  value={formData.destination_zone_id}
                  onChange={(e) => setFormData({ ...formData, destination_zone_id: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-midnight-950 border border-midnight-700 text-midnight-100 focus:outline-none focus:border-tactical-teal font-sans text-xs"
                >
                  {DELIVERY_ZONES.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.id} — {zone.name} ({zone.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Placement Timestamp */}
              <div>
                <label className="block text-midnight-400 text-[11px] mb-1 font-sans flex items-center justify-between">
                  <span>Order Timestamp (ISO 8601):</span>
                  <span className="text-tactical-cyan text-[10px]">
                    {new Date(formData.order_time).getDay() === 0 ? 'Sunday (Capacity = 0)' : 'Weekday'}
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.order_time}
                  onChange={(e) => setFormData({ ...formData, order_time: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-midnight-950 border border-midnight-700 text-midnight-100 focus:outline-none focus:border-tactical-teal text-xs"
                />
              </div>

              {/* Service & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-midnight-400 text-[11px] mb-1 font-sans">
                    Service Level:
                  </label>
                  <select
                    value={formData.requested_service}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requested_service: e.target.value as OrderRequestPayload['requested_service'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-midnight-950 border border-midnight-700 text-midnight-100 focus:outline-none focus:border-tactical-teal font-sans text-xs"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="EXPRESS">EXPRESS</option>
                    <option value="SAME_DAY">SAME_DAY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-midnight-400 text-[11px] mb-1 font-sans">
                    Priority Tier:
                  </label>
                  <select
                    value={formData.order_priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        order_priority: e.target.value as OrderRequestPayload['order_priority'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-midnight-950 border border-midnight-700 text-midnight-100 focus:outline-none focus:border-tactical-teal font-sans text-xs"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              {/* Allow Splits Policy Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded bg-midnight-950 border border-midnight-800">
                <div>
                  <div className="font-sans font-semibold text-midnight-200">Allow Multi-Node Splits:</div>
                  <div className="text-[10px] text-midnight-500 font-sans">
                    Permits fallback across multiple warehouses
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_splits}
                    onChange={(e) => setFormData({ ...formData, allow_splits: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-midnight-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-tactical-teal"></div>
                </label>
              </div>

              {/* SKU Line Items */}
              <div className="space-y-2 pt-2 border-t border-midnight-800">
                <div className="flex items-center justify-between font-sans">
                  <span className="text-midnight-400 font-semibold text-[11px]">
                    SKU Line Items ({formData.lines.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-[11px] text-tactical-teal hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formData.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded bg-midnight-950 border border-midnight-800"
                    >
                      <input
                        type="text"
                        value={line.sku_id}
                        onChange={(e) => handleLineChange(idx, 'sku_id', e.target.value)}
                        placeholder="SKU-000001"
                        className="w-28 px-2 py-1 rounded bg-midnight-900 border border-midnight-700 text-tactical-cyan text-xs focus:outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                        className="w-20 px-2 py-1 rounded bg-midnight-900 border border-midnight-700 text-midnight-100 text-right text-xs focus:outline-none"
                      />
                      <span className="text-midnight-500 text-[10px]">qty</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={formData.lines.length <= 1}
                        className="ml-auto text-midnight-500 hover:text-tactical-crimson disabled:opacity-30 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-midnight-800 flex gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleEvaluateSingle}
                  disabled={allocateOrderMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Play className={`w-4 h-4 ${allocateOrderMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>Execute Engine Allocation</span>
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    const preset = PRESET_SCENARIOS.find((s) => s.id === activeScenarioId);
                    if (preset) setFormData(JSON.parse(JSON.stringify(preset.payload)));
                    setSingleOutcome(null);
                    setBatchOutcomes(null);
                  }}
                  className="border-midnight-700 text-midnight-400"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engine Outcome Display (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {allocateOrderMutation.isPending || allocateBatchMutation.isPending ? (
            <Card className="bg-midnight-900 border-midnight-700 p-12 text-center h-full flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-tactical-teal mb-3" />
              <p className="text-sm text-midnight-300 font-mono">
                Executing request-scoped allocation evaluation...
              </p>
              <p className="text-xs text-midnight-500 font-mono mt-1">
                Checking inventory stock, daily warehouse capacity, and proximity ranking.
              </p>
            </Card>
          ) : singleOutcome ? (
            <div className="space-y-4">
              {/* Single Outcome Card */}
              <Card className="bg-midnight-900 border-midnight-700">
                <CardHeader className="pb-3 border-b border-midnight-800 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Badge
                      variant={singleOutcome.status === 'ALLOCATED' ? 'emerald' : 'crimson'}
                      size="md"
                    >
                      {singleOutcome.status === 'ALLOCATED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 mr-1 inline" />
                      )}
                      {singleOutcome.status}
                    </Badge>
                    <Badge
                      variant={
                        singleOutcome.allocation_type === 'SINGLE_NODE'
                          ? 'teal'
                          : singleOutcome.allocation_type === 'SPLIT_NODE'
                          ? 'amber'
                          : 'outline'
                      }
                      size="md"
                    >
                      {singleOutcome.allocation_type}
                    </Badge>
                  </div>
                  <div className="text-xs font-mono text-midnight-400">
                    Units: <span className="text-tactical-teal font-bold">{singleOutcome.total_units}</span> •
                    Nodes: <span className="text-midnight-100 font-bold">{singleOutcome.allocated_node_count}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Explanation Banner */}
                  <div
                    className={`p-3 rounded-lg border text-xs font-mono leading-relaxed ${
                      singleOutcome.status === 'ALLOCATED'
                        ? 'bg-midnight-950 border-tactical-teal/30 text-midnight-200'
                        : 'bg-tactical-crimson/10 border-tactical-crimson/30 text-tactical-crimson'
                    }`}
                  >
                    <span className="font-semibold block text-[11px] text-midnight-400 mb-1">
                      ENGINE EXPLANATION:
                    </span>
                    {singleOutcome.explanation}
                  </div>

                  {/* Decisions Table if Allocated */}
                  {singleOutcome.decisions.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-midnight-400 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-tactical-teal" />
                        Allocated Decisions ({singleOutcome.decisions.length})
                      </h4>
                      <div className="overflow-x-auto rounded border border-midnight-800 bg-midnight-950">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-midnight-800 text-midnight-400">
                              <th className="py-2 px-3">Order Line</th>
                              <th className="py-2 px-3">SKU ID</th>
                              <th className="py-2 px-3 text-right">Qty</th>
                              <th className="py-2 px-3">Warehouse Node</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-midnight-800/60">
                            {singleOutcome.decisions.map((dec) => (
                              <tr key={dec.allocation_id}>
                                <td className="py-2 px-3 text-midnight-400">{dec.order_line_id}</td>
                                <td className="py-2 px-3 text-tactical-cyan font-bold">{dec.sku_id}</td>
                                <td className="py-2 px-3 text-right font-bold text-midnight-100">
                                  {dec.allocated_qty}
                                </td>
                                <td className="py-2 px-3 text-midnight-200">
                                  <span className="inline-flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-tactical-teal" />
                                    {dec.node_id}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-midnight-300">{dec.allocation_date}</td>
                                <td className="py-2 px-3 text-tactical-teal">{dec.allocation_type}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Exceptions if Unallocated */}
                  {singleOutcome.exceptions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-tactical-crimson uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Allocation Exceptions ({singleOutcome.exceptions.length})
                      </h4>
                      <div className="space-y-1.5">
                        {singleOutcome.exceptions.map((exc, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded bg-midnight-950 border border-tactical-crimson/30 text-xs font-mono text-tactical-crimson"
                          >
                            <span className="font-bold mr-2">[{exc.exception_code}]</span>
                            <span>{exc.exception_detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stateless Isolation Guarantee Note */}
                  <div className="p-2 rounded bg-midnight-950 border border-midnight-800 text-[11px] font-mono text-tactical-cyan flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tactical-teal shrink-0" />
                    <span>Stateless Evaluation: Zero inventory or capacity deductions committed to database.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : batchOutcomes ? (
            <Card className="bg-midnight-900 border-midnight-700">
              <CardHeader className="pb-3 border-b border-midnight-800 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-midnight-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-tactical-teal" />
                  Batch Allocation Outcome Report ({batchOutcomes.length} Orders)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="overflow-x-auto rounded border border-midnight-800 bg-midnight-950">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-midnight-800 text-midnight-400">
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Units</th>
                        <th className="py-2.5 px-3">Nodes</th>
                        <th className="py-2.5 px-3">Explanation Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-midnight-800/60">
                      {batchOutcomes.map((out) => (
                        <tr key={out.order_id} className="hover:bg-midnight-850/50">
                          <td className="py-2.5 px-3 text-tactical-teal font-bold">{out.order_id}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                out.status === 'ALLOCATED'
                                  ? 'bg-tactical-emerald/15 text-tactical-emerald'
                                  : 'bg-tactical-crimson/15 text-tactical-crimson'
                              }`}
                            >
                              {out.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-midnight-300">{out.allocation_type}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-midnight-100">
                            {out.total_units}
                          </td>
                          <td className="py-2.5 px-3 text-midnight-300">{out.allocated_node_count}</td>
                          <td className="py-2.5 px-3 text-midnight-400 max-w-[280px] truncate">
                            {out.explanation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-2 rounded bg-midnight-950 border border-midnight-800 text-[11px] font-mono text-tactical-cyan flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-tactical-teal shrink-0" />
                  <span>Batch Chronological Evaluation: Evaluated in strict timestamp order with zero database mutation.</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-midnight-900 border-midnight-700 p-12 text-center h-full flex flex-col items-center justify-center">
              <Terminal className="w-12 h-12 text-midnight-600 mb-3" />
              <h3 className="text-sm font-bold text-midnight-200 font-display">
                Ready to Evaluate Allocation
              </h3>
              <p className="text-xs text-midnight-400 mt-1 max-w-sm">
                Select a preset scenario on the left or customize candidate parameters, then click &quot;Execute Engine Allocation&quot;.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
