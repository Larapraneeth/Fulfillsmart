/**
 * FulfillSmart Carrier Management TypeScript Definitions
 * Directly maps to FastAPI backend schemas from src/api/schemas/carrier.py.
 */

export interface CarrierServiceLevelDistribution {
  service_code: 'STANDARD' | 'EXPRESS' | 'SAME_DAY' | string;
  service_name: string;
  shipment_count: number;
  delayed_shipments: number;
  on_time_rate_pct: number;
}

export interface CarrierItem {
  carrier_id: string;
  carrier_name: string;
  carrier_type: string;
  supports_reverse_logistics: boolean;
  is_active: boolean;
  pickup_cutoff_time: string;
  dispatch_window_start: string;
  dispatch_window_end: string;
  shipment_count: number;
  delayed_shipments: number;
  average_delay_days: number;
  median_delay_days: number;
  on_time_rate_pct: number;
  delay_rate_pct: number;
  covered_zones_count: number;
  service_distribution: CarrierServiceLevelDistribution[];
}

export interface ServiceLevelPerformanceItem {
  service_level_id: string;
  carrier_id: string;
  carrier_name: string;
  service_code: string;
  service_name: string;
  nominal_transit_days: number;
  max_weight_kg: number;
  shipment_count: number;
  delayed_shipments: number;
  average_delay_days: number;
  on_time_rate_pct: number;
}

export interface MonthlyCarrierTrendItem {
  month: string;
  carrier_id: string;
  carrier_name: string;
  shipment_count: number;
  delayed_shipments: number;
  on_time_rate_pct: number;
}

export interface CarrierSummary {
  total_orders: number;
  total_shipments: number;
  delivered_on_time_shipments: number;
  delayed_shipments: number;
  shipment_on_time_rate_pct: number;
  shipment_delay_rate_pct: number;
  carrier_unavailable_orders: number;
  carrier_unavailable_rate_pct: number;
  total_carriers: number;
  active_carriers: number;
  total_service_levels: number;
  total_service_zone_routes: number;
  carrier_promise_coverage_rate_pct: number;
  strict_on_time_order_rate_pct: number;
}

export interface CarrierOverviewData {
  summary: CarrierSummary;
  carriers: CarrierItem[];
  service_levels: ServiceLevelPerformanceItem[];
  monthly_trends: MonthlyCarrierTrendItem[];
}

export interface CarrierShipmentItem {
  shipment_id: string;
  order_id: string;
  node_id: string;
  node_name: string;
  node_city: string;
  service_level_id: string;
  service_name: string;
  service_code: string;
  dispatch_date: string;
  promised_delivery_date: string;
  actual_delivery_date: string;
  shipment_status: string;
  is_delayed: number;
  delay_days: number;
  package_line_count: number;
  package_unit_count: number;
  destination_city: string;
  destination_zone_id: string;
}

export interface CarrierCoveredZone {
  delivery_zone_id: string;
  zone_name: string;
  city: string;
  state: string;
  region: string;
  standard_available: boolean;
  express_available: boolean;
  same_day_available: boolean;
}

export interface CarrierDetailData {
  carrier: CarrierItem;
  service_levels: ServiceLevelPerformanceItem[];
  covered_zones: CarrierCoveredZone[];
  recent_shipments: CarrierShipmentItem[];
}

export interface CarrierZoneCoverageItem {
  carrier_id: string;
  carrier_name: string;
  delivery_zone_id: string;
  zone_name: string;
  city: string;
  state: string;
  region: string;
  standard_available: boolean;
  express_available: boolean;
  same_day_available: boolean;
}

export interface CarrierServiceZoneMatrixData {
  total_matrix_entries: number;
  carriers: Array<{ carrier_id: string; carrier_name: string }>;
  coverage: CarrierZoneCoverageItem[];
}
