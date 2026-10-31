/**
 * FulfillSmart Shipment Tracking & Rollup TypeScript Definitions
 * Directly maps to FastAPI backend schemas from src/api/schemas/tracking.py.
 */

export interface TrackingEvent {
  tracking_event_id: string;
  shipment_id: string;
  order_id: string;
  event_sequence: number;
  event_type: 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED' | 'EXCEPTION' | string;
  event_timestamp: string;
  event_location: string;
  event_description: string;
}

export interface DelayDistributionItem {
  delay_days: number;
  count: number;
  percentage: number;
}

export interface CarrierDeliveryPerformanceItem {
  carrier_id: string;
  carrier_name: string;
  shipment_count: number;
  delayed_shipments: number;
  on_time_rate_pct: number;
  average_delay_days: number;
}

export interface NodeDeliveryPerformanceItem {
  node_id: string;
  node_name: string;
  city: string;
  state: string;
  shipment_count: number;
  delayed_shipments: number;
  on_time_rate_pct: number;
  average_delay_days: number;
}

export interface TrackingOverviewSummary {
  total_orders: number;
  assigned_orders: number;
  carrier_unavailable_orders: number;
  carrier_unavailable_rate_pct: number;
  total_shipments: number;
  delivered_shipments: number;
  in_transit_shipments: number;
  on_time_shipments: number;
  delayed_shipments: number;
  shipment_on_time_rate_pct: number;
  shipment_delay_rate_pct: number;
  total_tracking_events: number;
  picked_up_events: number;
  delay_events: number;
  delivered_events: number;
}

export interface TrackingOverviewData {
  summary: TrackingOverviewSummary;
  delay_distribution: DelayDistributionItem[];
  carrier_performance: CarrierDeliveryPerformanceItem[];
  node_performance: NodeDeliveryPerformanceItem[];
}

export interface ShipmentExplorerItem {
  shipment_id: string;
  order_id: string;
  node_id: string;
  node_name: string;
  node_city: string;
  carrier_id: string;
  carrier_name: string;
  service_level_id: string;
  service_name: string;
  service_code: string;
  destination_city: string;
  destination_zone_id: string;
  dispatch_date: string;
  promised_delivery_date: string;
  actual_delivery_date: string | null;
  shipment_status: string;
  is_delayed: number;
  delay_days: number;
  package_line_count: number;
  package_unit_count: number;
  events_count: number;
  is_split: boolean;
}

export interface ShipmentPaginatedData {
  items: ShipmentExplorerItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface OrderDeliveryOutcome {
  order_id: string;
  order_time: string;
  requested_service: string;
  allocated_node_groups: number;
  shipment_count: number;
  delivered_shipment_count: number;
  latest_actual_delivery_date: string | null;
  latest_promised_delivery_date: string | null;
  delayed_shipment_count: number;
  delivery_outcome_status: string;
  delivery_completed: number;
  delivery_on_time: number | null;
}

export interface ShipmentDetailData {
  shipment: ShipmentExplorerItem;
  tracking_events: TrackingEvent[];
  parent_order?: {
    order_id: string;
    customer_id: string;
    order_time: string;
    destination_zone_id: string;
    destination_city: string;
    destination_state: string;
    requested_service: string;
    order_priority: string;
    order_total_inr: number;
  } | null;
  delivery_outcome?: OrderDeliveryOutcome | null;
  sibling_shipments: ShipmentExplorerItem[];
}

export interface ShipmentsQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  carrier_id?: string;
  node_id?: string;
  is_delayed?: number;
  service_code?: string;
}
