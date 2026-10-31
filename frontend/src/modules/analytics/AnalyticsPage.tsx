import { Card, CardHeader, CardTitle, CardContent } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { LoadingSkeleton } from "../../components/common/LoadingSkeleton";
import { ErrorState } from "../../components/common/ErrorState";
import { useAnalyticsOverview, useAnalyticsTrends, useAnalyticsCarriers, useAnalyticsDelivery, useAnalyticsAllocation, useAnalyticsExport } from "../../api/queries/useAnalytics";

export default function AnalyticsPage() {
  const overview = useAnalyticsOverview();
  const trends = useAnalyticsTrends();
  const carriers = useAnalyticsCarriers();
  const delivery = useAnalyticsDelivery();
  const allocation = useAnalyticsAllocation();
  const exportData = useAnalyticsExport();

  const isLoading = overview.isLoading || trends.isLoading || carriers.isLoading || delivery.isLoading || allocation.isLoading;
  const isError = overview.isError || trends.isError || carriers.isError || delivery.isError || allocation.isError;

  const handleExport = async () => {
    if (exportData.isLoading) return;
    try {
      const csv = exportData.data?.csv_url ?? "";
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "analytics_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState title="Analytics Load Error" message="Failed to load analytics data." />;

  const ov = overview.data;
  const tr = trends.data;
  const ca = carriers.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-midnight-100 font-display">Analytics & KPIs</h2>
          <p className="text-sm text-midnight-400">Real-time operational metrics, trends, and performance insights.</p>
        </div>
        <Badge variant="teal" size="sm">Phase 5 Module</Badge>
      </div>

      {ov && (
        <Card variant="elevated">
          <CardHeader><CardTitle>KPI Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-midnight-800 rounded-lg p-3">
                <p className="text-midnight-400">Total Orders</p>
                <p className="text-xl font-bold text-midnight-100">{ov.total_orders.toLocaleString()}</p>
              </div>
              <div className="bg-midnight-800 rounded-lg p-3">
                <p className="text-midnight-400">Allocation Rate</p>
                <p className="text-xl font-bold text-tactical-teal">{ov.allocation_success_rate_pct}%</p>
              </div>
              <div className="bg-midnight-800 rounded-lg p-3">
                <p className="text-midnight-400">Order On-Time Rate</p>
                <p className="text-xl font-bold text-tactical-teal">{ov.order_on_time_rate_pct}%</p>
              </div>
              <div className="bg-midnight-800 rounded-lg p-3">
                <p className="text-midnight-400">Delayed Shipments</p>
                <p className="text-xl font-bold text-tactical-crimson">{ov.delayed_shipments.toLocaleString()} ({ov.delayed_shipments_pct}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tr && (
        <Card variant="elevated">
          <CardHeader><CardTitle>Monthly Delivery Trends</CardTitle></CardHeader>
          <CardContent className="text-sm text-midnight-200 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-midnight-700 text-midnight-400">
                  <th className="py-2 pr-4">Month</th><th className="py-2 pr-4">Orders</th>
                  <th className="py-2 pr-4">Shipments</th><th className="py-2 pr-4">On-Time</th>
                  <th className="py-2 pr-4">Delayed</th>
                </tr>
              </thead>
              <tbody>
                {tr.monthly.map(m => (
                  <tr key={m.month} className="border-b border-midnight-800 hover:bg-midnight-800/50">
                    <td className="py-2 pr-4 font-mono">{m.month}</td>
                    <td className="py-2 pr-4">{m.orders.toLocaleString()}</td>
                    <td className="py-2 pr-4">{m.shipments.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-tactical-teal">{m.on_time_shipments.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-tactical-crimson">{m.delayed_shipments.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {ca && (
        <Card variant="elevated">
          <CardHeader><CardTitle>Carrier Performance Scorecard</CardTitle></CardHeader>
          <CardContent className="text-sm text-midnight-200 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-midnight-700 text-midnight-400">
                  <th className="py-2 pr-4">Carrier</th><th className="py-2 pr-4">Shipments</th>
                  <th className="py-2 pr-4">On-Time</th><th className="py-2 pr-4">Delayed</th>
                  <th className="py-2 pr-4">On-Time %</th>
                </tr>
              </thead>
              <tbody>
                {ca.carriers.map(c => (
                  <tr key={c.carrier_id} className="border-b border-midnight-800 hover:bg-midnight-800/50">
                    <td className="py-2 pr-4 font-mono">{c.carrier_id}</td>
                    <td className="py-2 pr-4">{c.total_shipments.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-tactical-teal">{c.on_time_shipments.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-tactical-crimson">{c.delayed_shipments.toLocaleString()}</td>
                    <td className="py-2 pr-4">{c.on_time_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card variant="elevated">
        <CardHeader><CardTitle>Delivery Outcome Overview</CardTitle></CardHeader>
        <CardContent className="text-sm text-midnight-200">
          <pre>{JSON.stringify(delivery.data, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader><CardTitle>Allocation Insights</CardTitle></CardHeader>
        <CardContent className="text-sm text-midnight-200">
          <pre>{JSON.stringify(allocation.data, null, 2)}</pre>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <button className="px-4 py-2 bg-tactical-teal text-midnight-950 rounded hover:bg-tactical-teal/80" onClick={handleExport}>
          Export CSV
        </button>
      </div>
    </div>
  );
}
