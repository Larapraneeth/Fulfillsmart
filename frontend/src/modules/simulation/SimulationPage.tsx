import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { API_ENDPOINTS } from '../../api/endpoints';

export default function SimulationPage() {
  // State management
  const [scenarios, setScenarios] = useState<Array<any>>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [scenarioDetail, setScenarioDetail] = useState<any>(null);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string>('');

  // Controls
  const [capacityMultiplier, setCapacityMultiplier] = useState(1.0);
  const [allowSplit, setAllowSplit] = useState(true);
  const [orderLimit, setOrderLimit] = useState<number | ''>('');
  const [disabledNodeIds, setDisabledNodeIds] = useState<string>('');
  const [disabledCarrierIds, setDisabledCarrierIds] = useState<string>('');

  // Run results
  const [runResult, setRunResult] = useState<any>(null);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [history, setHistory] = useState<Array<any>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch standard scenarios list
  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.SIMULATION_SCENARIOS_STANDARD);
        if (!res.ok) throw new Error('Failed to load scenarios');
        const json = await res.json();
        setScenarios(json.data);
        if (json.data.length > 0) setSelectedScenario(json.data[0].scenario_id);
      } catch (e:any) {
        setError(e.message);
      } finally {
        setLoadingScenarios(false);
      }
    };
    fetchScenarios();
  }, []);

  // Fetch detail for selected scenario
  useEffect(() => {
    if (!selectedScenario) return;
    setLoadingDetail(true);
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${API_ENDPOINTS.SIMULATION_SCENARIOS_STANDARD}/${encodeURIComponent(selectedScenario)}`);
        if (!res.ok) throw new Error('Failed to load scenario detail');
        const json = await res.json();
        setScenarioDetail(json.data);
      } catch (e:any) {
        setError(e.message);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedScenario]);

  const buildConfig = () => {
    const config: any = {
      scenario_id: selectedScenario,
      scenario_name: scenarioDetail?.scenario_name || '',
      description: scenarioDetail?.description || '',
      capacity_multiplier: capacityMultiplier,
      disabled_node_ids: disabledNodeIds ? disabledNodeIds.split(',').map(s => s.trim()) : [],
      node_capacity_overrides: {},
      inventory_deltas: {},
      disabled_carrier_ids: disabledCarrierIds ? disabledCarrierIds.split(',').map(s => s.trim()) : [],
      carrier_cutoff_overrides: {},
      transit_day_deltas: {},
      allow_split_shipments: allowSplit,
      order_priority_filter: null,
      date_range: null,
      order_limit: orderLimit || undefined,
      cost_config: null,
    };
    return config;
  };

  const runSimulation = async () => {
    setError('');
    setRunResult(null);
    const payload = {
      config: buildConfig(),
      persist: true,
      overwrite: false,
      run_id: undefined,
    };
    try {
      const res = await fetch(API_ENDPOINTS.SIMULATION_RUN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Run simulation failed');
      const json = await res.json();
      setRunResult(json.data);
    } catch (e:any) {
      setError(e.message);
    }
  };

  const compareSimulation = async () => {
    setError('');
    setCompareResult(null);
    const payload = {
      config: buildConfig(),
      persist: true,
      overwrite: false,
      run_id: undefined,
    };
    try {
      const res = await fetch(API_ENDPOINTS.SIMULATION_COMPARE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Compare simulation failed');
      const json = await res.json();
      setCompareResult(json.data);
    } catch (e:any) {
      setError(e.message);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.SIMULATION_HISTORY);
      if (!res.ok) throw new Error('Failed to load history');
      const json = await res.json();
      setHistory(json.data);
    } catch (e:any) {
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadRunDetail = async (runId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.SIMULATION_RUN_DETAIL(runId)}`);
      if (!res.ok) throw new Error('Failed to load run detail');
      const json = await res.json();
      setRunResult(json.data);
    } catch (e:any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loadingScenarios) return <LoadingSkeleton />;
  if (error) return <ErrorState title="Simulation Lab Error" message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-midnight-100 font-display">Simulation Lab</h2>
          <p className="text-sm text-midnight-400">
            What‑if scenario execution, cohort comparison, and trade‑off analysis.
          </p>
        </div>
        <Badge variant="indigo" size="sm">Phase 5 Module</Badge>
      </div>

      {/* Scenario selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Standard Scenarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded border border-midnight-600 bg-midnight-900 p-2 text-midnight-100"
            value={selectedScenario}
            onChange={e => setSelectedScenario(e.target.value)}
          >
            {scenarios.map(sc => (
              <option key={sc.scenario_id} value={sc.scenario_id}>
                {sc.scenario_name}
              </option>
            ))}
          </select>
          {loadingDetail && <LoadingSkeleton />}
          {scenarioDetail && (
            <div className="text-sm text-midnight-300 mt-2">
              {scenarioDetail.description}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Parameters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-midnight-300 mb-1">Capacity Multiplier</label>
            <input
              type="number"
              min="0"
              step="0.1"
              className="w-full rounded border border-midnight-600 bg-midnight-800 p-2 text-midnight-100"
              value={capacityMultiplier}
              onChange={e => setCapacityMultiplier(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="block text-midnight-300 mb-1">Allow Split Shipments</label>
            <input
              type="checkbox"
              checked={allowSplit}
              onChange={e => setAllowSplit(e.target.checked)}
              className="h-4 w-4 text-tactical-teal border-midnight-600 rounded"
            />
          </div>
          <div>
            <label className="block text-midnight-300 mb-1">Order Limit (optional)</label>
            <input
              type="number"
              min="1"
              className="w-full rounded border border-midnight-600 bg-midnight-800 p-2 text-midnight-100"
              value={orderLimit}
              onChange={e => setOrderLimit(e.target.value ? parseInt(e.target.value) : '')}
            />
          </div>
          <div>
            <label className="block text-midnight-300 mb-1">Disabled Node IDs (comma‑separated)</label>
            <input
              type="text"
              placeholder="e.g. nodeA,nodeB"
              className="w-full rounded border border-midnight-600 bg-midnight-800 p-2 text-midnight-100"
              value={disabledNodeIds}
              onChange={e => setDisabledNodeIds(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-midnight-300 mb-1">Disabled Carrier IDs (comma‑separated)</label>
            <input
              type="text"
              placeholder="e.g. carrierX,carrierY"
              className="w-full rounded border border-midnight-600 bg-midnight-800 p-2 text-midnight-100"
              value={disabledCarrierIds}
              onChange={e => setDisabledCarrierIds(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex space-x-4">
        <button
          className="px-4 py-2 bg-tactical-teal text-midnight-950 rounded hover:bg-tactical-teal/80 disabled:opacity-50"
          onClick={runSimulation}
        >Run Simulation</button>
        <button
          className="px-4 py-2 bg-tactical-indigo text-midnight-950 rounded hover:bg-tactical-indigo/80"
          onClick={compareSimulation}
        >Compare vs Baseline</button>
        <button
          className="px-4 py-2 bg-midnight-700 text-midnight-100 rounded hover:bg-midnight-600"
          onClick={loadHistory}
        >Load History</button>
      </div>

      {/* Results */}
      {runResult && (
        <Card>
          <CardHeader>
            <CardTitle>Simulation Run Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-midnight-200">
            <pre>{JSON.stringify(runResult, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {compareResult && (
        <Card>
          <CardHeader>
            <CardTitle>Baseline Comparison (Δ pp)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-midnight-200">
            <pre>{JSON.stringify(compareResult, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {/* History table */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading && <LoadingSkeleton />}
          {!historyLoading && history.length === 0 && (
            <EmptyState title="No History" description="No persisted simulation runs found." />
          )}
          {!historyLoading && history.length > 0 && (
            <table className="w-full text-sm text-midnight-200">
              <thead className="bg-midnight-800 text-midnight-100">
                <tr>
                  <th className="p-2 text-left">Run ID</th>
                  <th className="p-2 text-left">Scenario</th>
                  <th className="p-2 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr
                    key={item.run_id}
                    className="cursor-pointer hover:bg-midnight-700"
                    onClick={() => loadRunDetail(item.run_id)}
                  >
                    <td className="p-2">{item.run_id}</td>
                    <td className="p-2">{item.scenario_name}</td>
                    <td className="p-2">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {detailLoading && <LoadingSkeleton />}
        </CardContent>
      </Card>
    </div>
  );
}
