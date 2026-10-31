export interface OverviewAnalytics {
  total_orders: number;
  total_shipments: number;
  allocation_success_rate_pct: number;
  order_on_time_rate_pct: number;
  shipment_on_time_rate_pct: number;
  carrier_unavailable_count: number;
  delayed_shipments: number;
  delayed_shipments_pct: number;
}

export interface MonthlyTrendItem {
  month: string;
  orders: number;
  shipments: number;
  on_time_shipments: number;
  delayed_shipments: number;
  allocation_successful: number;
  allocation_failed: number;
}

export interface TrendsAnalytics {
  monthly: MonthlyTrendItem[];
}

export interface NodePerformanceItem {
  node_id: string;
  capacity_total: number;
  capacity_used: number;
  utilization_pct: number;
  allocated_orders: number;
  allocated_units: number;
}

export interface FulfillmentAnalytics {
  nodes: NodePerformanceItem[];
}

export interface CarrierPerformanceItem {
  carrier_id: string;
  total_shipments: number;
  on_time_shipments: number;
  delayed_shipments: number;
  on_time_pct: number;
  delayed_pct: number;
}

export interface CarriersAnalytics {
  carriers: CarrierPerformanceItem[];
}

export interface DeliveryOutcomeItem {
  outcome: string;
  count: number;
  pct_of_shipments: number;
}

export interface DeliveryAnalytics {
  outcomes: DeliveryOutcomeItem[];
}

export interface AllocationDistributionItem {
  type: string;
  count: number;
  pct_of_orders: number;
}

export interface AllocationAnalytics {
  total_orders: number;
  successful_allocations: number;
  failed_allocations: number;
  distribution: AllocationDistributionItem[];
}

export interface ExportAnalytics {
  csv_url?: string | null;
}
