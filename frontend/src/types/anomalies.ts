/**
 * Type definitions for FulfillSmart Anomaly Module matching FastAPI backend schemas
 */

export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AnomalyCategory = 
  | 'CARRIER_UNAVAILABLE'
  | 'DELIVERY_DELAY'
  | 'SPLIT_ORDER_COMPLEXITY'
  | 'ALLOCATION_EXCEPTION'
  | 'TRACKING_IRREGULARITY'
  | 'ALLOCATION_EXCEEDS_AVAILABLE_STOCK'
  | 'CARRIER_UNSUPPORTED_ZONE'
  | 'DELIVERED_BEFORE_DISPATCH'
  | 'INCORRECT_SPLIT_SHIPMENT_STATUS_ROLLUP'
  | 'PROMISE_BEFORE_ORDER'
  | 'WAREHOUSE_CAPACITY_EXCEEDED';

export type AnomalyStatus = 'UNRESOLVED' | 'DELIVERED_HISTORICAL' | 'BENCHMARK_SYNTHETIC';

export interface AnomalyOverviewCategory {
  category: string;
  name: string;
  count: number;
  percentage: number;
  rate_against_baseline: number;
  denominator_entity: 'ORDER' | 'SHIPMENT';
  denominator_count: number;
  source_table: string;
  verification_type: 'VERIFIED_HISTORICAL_RECORD' | 'DERIVED_LOGISTICS_INDICATOR';
  description: string;
}

export interface AnomalyOverviewSeverity {
  severity: AnomalySeverity;
  count: number;
  percentage: number;
  classification_rule: string;
  is_derived: boolean;
}

export interface AnomalyOverviewStatus {
  status: string;
  count: number;
  percentage: number;
  description: string;
}

export interface AnomalyTimeTrendItem {
  month: string;
  carrier_unavailable_count: number;
  delivery_delay_count: number;
  split_order_count: number;
  total_count: number;
}

export interface AnomalyOverviewResponse {
  total_anomalies: number;
  total_orders_evaluated: number;
  total_shipments_evaluated: number;
  order_exception_rate_pct: number;
  shipment_delay_rate_pct: number;
  split_order_rate_pct: number;
  clean_records_audit_evaluated: number;
  clean_records_false_positives: number;
  clean_records_specificity_pct: number;
  synthetic_benchmark_cases: number;
  synthetic_benchmark_f1: number;
  categories: AnomalyOverviewCategory[];
  severities: AnomalyOverviewSeverity[];
  statuses: AnomalyOverviewStatus[];
  monthly_trends: AnomalyTimeTrendItem[];
  baseline_disclosure: string;
}

export interface AnomalyExplorerItem {
  anomaly_id: string;
  category: string;
  severity: AnomalySeverity;
  is_derived_severity: boolean;
  severity_rule: string;
  entity_type: string;
  entity_id: string;
  order_id: string;
  shipment_id?: string | null;
  node_id?: string | null;
  carrier_id?: string | null;
  service_level_id?: string | null;
  status: string;
  detected_date: string;
  destination_city?: string | null;
  destination_state?: string | null;
  title: string;
  explanation: string;
}

export interface AnomalyPaginatedResponse {
  items: AnomalyExplorerItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface AnomalyDetailResponse {
  anomaly_id: string;
  category: string;
  severity: AnomalySeverity;
  is_derived_severity: boolean;
  severity_rule: string;
  entity_type: string;
  entity_id: string;
  order_id: string;
  shipment_id?: string | null;
  node_id?: string | null;
  carrier_id?: string | null;
  service_level_id?: string | null;
  status: string;
  detected_date: string;
  title: string;
  explanation: string;
  source_table: string;
  verification_type: string;
  evidence: Record<string, any>;
  related_entities: Record<string, any>;
}

export interface AnomalyFinding {
  case_id?: string | null;
  entity_id: string;
  entity_type: string;
  anomaly_type: string;
  severity: string;
  explanation: string;
  detected_at_utc: string;
}

export interface MetricScore {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  support: number;
}

export interface AnomalyEvaluationReport {
  total_cases_evaluated: number;
  overall_micro: MetricScore;
  overall_macro_precision: number;
  overall_macro_recall: number;
  overall_macro_f1: number;
  category_scores: Record<string, MetricScore>;
}

export interface CleanDataCategoryScore {
  evaluated: number;
  false_positives: number;
}

export interface CleanDataAuditReport {
  records_evaluated: number;
  false_positives: number;
  false_positive_rate_pct: number;
  specificity_pct: number;
  per_category_evaluations: Record<string, CleanDataCategoryScore>;
}

export interface AnomalyQueryParams {
  page?: number;
  page_size?: number;
  category?: string;
  severity?: string;
  status?: string;
  carrier_id?: string;
  node_id?: string;
  search?: string;
  sort_by?: 'detected_date' | 'severity' | 'category' | 'anomaly_id' | 'order_id';
  sort_order?: 'asc' | 'desc';
}
