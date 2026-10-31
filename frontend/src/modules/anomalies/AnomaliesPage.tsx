import { useState } from 'react';
import { 
  AlertOctagon, 
  ShieldCheck, 
  BarChart3 
} from 'lucide-react';
import { AnomaliesHeader } from './components/AnomaliesHeader';
import { AnomalyKpiCards } from './components/AnomalyKpiCards';
import { AnomalyFilters } from './components/AnomalyFilters';
import { AnomalyExplorer } from './components/AnomalyExplorer';
import { AnomalyCategoryDistribution } from './components/AnomalyCategoryDistribution';
import { AnomalySeverityDistribution } from './components/AnomalySeverityDistribution';
import { AnomalyDetailDrawer } from './components/AnomalyDetailDrawer';
import { AnomalyBenchmarkAuditTab } from './components/AnomalyBenchmarkAuditTab';
import { 
  useAnomalyOverview, 
  useAnomaliesPaginated 
} from '../../api/queries/useAnomalies';
import { AnomalyQueryParams } from '../../types/anomalies';

export type AnomaliesActiveTab = 'explorer' | 'distributions' | 'benchmark';

export default function AnomaliesPage() {
  const [activeTab, setActiveTab] = useState<AnomaliesActiveTab>('explorer');
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  // Pagination & filter state
  const [filters, setFilters] = useState<AnomalyQueryParams>({
    page: 1,
    page_size: 25,
    category: 'ALL',
    severity: 'ALL',
    status: 'ALL',
    carrier_id: 'ALL',
    node_id: 'ALL',
    search: '',
    sort_by: 'detected_date',
    sort_order: 'desc',
  });

  // Queries
  const { 
    data: overview, 
    isLoading: isOverviewLoading, 
    refetch: refetchOverview, 
    isRefetching: isOverviewRefetching 
  } = useAnomalyOverview();

  const { 
    data: paginatedData, 
    isLoading: isListLoading, 
    refetch: refetchList 
  } = useAnomaliesPaginated(filters);

  const handleFilterChange = (newFilters: Partial<AnomalyQueryParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      page_size: 25,
      category: 'ALL',
      severity: 'ALL',
      status: 'ALL',
      carrier_id: 'ALL',
      node_id: 'ALL',
      search: '',
      sort_by: 'detected_date',
      sort_order: 'desc',
    });
  };

  const handleRefreshAll = () => {
    refetchOverview();
    refetchList();
  };

  const tabs = [
    {
      id: 'explorer' as AnomaliesActiveTab,
      label: 'Operational Exceptions Explorer',
      icon: AlertOctagon,
      badge: overview ? `${overview.total_anomalies.toLocaleString()} Records` : '1,718 Records',
    },
    {
      id: 'distributions' as AnomaliesActiveTab,
      label: 'Category & Severity Distributions',
      icon: BarChart3,
      badge: overview ? `${overview.categories.length} Categories` : undefined,
    },
    {
      id: 'benchmark' as AnomaliesActiveTab,
      label: 'Rule Invariant Benchmark & Clean Audit',
      icon: ShieldCheck,
      badge: '6 Rules / 976 Cases',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <AnomaliesHeader 
        onRefresh={handleRefreshAll}
        isRefreshing={isOverviewRefetching}
      />

      {/* KPI Cards Grid */}
      <AnomalyKpiCards 
        overview={overview}
        isLoading={isOverviewLoading}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-midnight-700/80 pb-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-tactical-teal/15 text-tactical-teal border border-tactical-teal/30 shadow-sm'
                  : 'text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/40 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                  isActive
                    ? 'bg-tactical-teal/20 text-tactical-teal'
                    : 'bg-midnight-800 text-midnight-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Operational Exceptions Explorer */}
      {activeTab === 'explorer' && (
        <div className="space-y-4">
          <AnomalyFilters 
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            totalMatches={paginatedData?.total_count || 0}
          />

          <AnomalyExplorer 
            items={paginatedData?.items || []}
            totalCount={paginatedData?.total_count || 0}
            page={paginatedData?.page || 1}
            pageSize={paginatedData?.page_size || 25}
            totalPages={paginatedData?.total_pages || 1}
            hasNext={paginatedData?.has_next || false}
            hasPrevious={paginatedData?.has_previous || false}
            isLoading={isListLoading}
            onPageChange={(newPage) => handleFilterChange({ page: newPage })}
            onPageSizeChange={(newSize) => handleFilterChange({ page_size: newSize, page: 1 })}
            onInspect={(id) => setSelectedAnomalyId(id)}
          />
        </div>
      )}

      {/* Tab 2: Category & Severity Distributions */}
      {activeTab === 'distributions' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnomalyCategoryDistribution 
            categories={overview.categories}
            totalAnomalies={overview.total_anomalies}
          />
          <AnomalySeverityDistribution 
            severities={overview.severities}
            monthlyTrends={overview.monthly_trends}
            totalAnomalies={overview.total_anomalies}
          />
        </div>
      )}

      {/* Tab 3: Rule Benchmark & Clean Audit */}
      {activeTab === 'benchmark' && (
        <AnomalyBenchmarkAuditTab />
      )}

      {/* Slide-Over Forensic Inspection Drawer */}
      <AnomalyDetailDrawer 
        anomalyId={selectedAnomalyId}
        onClose={() => setSelectedAnomalyId(null)}
      />
    </div>
  );
}
