/**
 * FulfillSmart Operational Metrics & Analytics TypeScript Types
 * Directly matches FastAPI backend schemas from src/api/schemas/metrics.py
 * and src/api/schemas/network.py.
 */

export interface HeadlineSummary {
  total_orders: number;
  allocated_orders: number;
  allocation_success_rate_pct: number;
  shipments: number;
  order_on_time_rate_all_orders_pct: number;
  order_on_time_rate_completed_pct: number;
  order_on_time_rate_strict_all_orders_pct: number;
  order_on_time_rate_strict_completed_pct: number;
  carrier_unavailable_orders: number;
  split_node_orders: number;
  warehouse_order_capacity_utilization_pct: number;
  warehouse_unit_capacity_utilization_pct: number;
}

export interface KpiItem {
  metric: string;
  value: number;
  unit: string;
  definition: string;
}

export interface CarrierPerformanceItem {
  carrier_id: string;
  carrier_name: string;
  shipment_count: number;
  delayed_shipments: number;
  average_delay_days: number;
  median_delay_days: number;
  on_time_rate_pct: number;
  delay_rate_pct: number;
}

export interface WarehouseUtilizationItem {
  node_id: string;
  active_node_days: number;
  allocated_orders: number;
  allocated_units: number;
  order_capacity: number;
  unit_capacity: number;
  node_name: string;
  city: string;
  state: string;
  order_utilization_pct: number;
  unit_utilization_pct: number;
}

export interface MonthlyTrendItem {
  month: string;
  orders: number;
  on_time_orders: number;
  completed_orders: number;
  late_orders: number;
  carrier_unavailable_orders: number;
  on_time_rate_all_orders_pct: number;
  completion_rate_pct: number;
}

export interface NodeTopologyItem {
  node_id: string;
  node_name: string;
  city: string;
  state: string;
  node_pincode: string;
  node_type: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  daily_order_capacity: number;
  daily_unit_capacity: number;
  total_period_order_capacity: number;
  total_period_unit_capacity: number;
  allocated_orders_total: number;
  allocated_units_total: number;
  order_utilization_pct: number;
  unit_utilization_pct: number;
}

export interface ZoneTopologyItem {
  delivery_zone_id: string;
  zone_name: string;
  city: string;
  state: string;
  region: string;
  synthetic_pincode: string;
  distance_band: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  total_orders_received: number;
}

export interface HistoricalRouteCorridor {
  node_id: string;
  node_city: string;
  delivery_zone_id: string;
  zone_city: string;
  carrier_id: string;
  carrier_name: string;
  historical_shipment_count: number;
  haversine_distance_km: number;
  distance_type: string;
  distance_disclosure: string;
}

export interface NetworkTopologyData {
  nodes: NodeTopologyItem[];
  delivery_zones: ZoneTopologyItem[];
  historical_corridors: HistoricalRouteCorridor[];
}
