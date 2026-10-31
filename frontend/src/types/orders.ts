/**
 * FulfillSmart Orders Module Type Contracts
 * Mirrors backend Pydantic schemas in src/api/schemas/orders.py
 * Supports 50,000 historical baseline orders, server-side pagination,
 * multi-shipment split allocations, and detailed SKU line inspection.
 */

export type OrderPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type RequestedService = 'STANDARD' | 'EXPRESS' | 'SAME_DAY';
export type DeliveryOutcomeStatus =
  | 'DELIVERED_ON_TIME'
  | 'DELIVERED_LATE'
  | 'CARRIER_UNAVAILABLE';

export type OrderSortField = 'order_time' | 'order_id' | 'order_priority';
export type SortOrderDirection = 'asc' | 'desc';

/**
 * Single order summary item in the paginated orders list grid
 */
export interface OrderListItem {
  order_id: string;
  customer_id: string;
  order_time: string;
  destination_zone_id: string;
  zone_name: string;
  zone_city: string;
  zone_state: string;
  requested_service: string;
  order_priority: string;
  line_count: number;
  total_units: number;
  delivery_outcome_status: DeliveryOutcomeStatus | string | null;
  delivery_on_time: number | null; // 1 = on-time, 0 = late/unavailable, null = pending
  primary_carrier_id: string | null;
  carrier_name: string | null;
  carrier_ids: string[];
  carrier_names: string[];
  allocated_nodes: string[];
  is_split: boolean;
  order_total_inr: number;
}

/**
 * Server-side paginated envelope payload
 */
export interface PaginatedOrdersData {
  total_count: number;
  total_pages: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
  items: OrderListItem[];
}

/**
 * Filter and pagination query parameters for GET /api/v1/orders
 */
export interface OrderFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  destinationZoneId?: string;
  orderPriority?: string;
  requestedService?: string;
  carrierId?: string;
  nodeId?: string;
  sortBy?: OrderSortField;
  sortOrder?: SortOrderDirection;
}

/**
 * Detailed SKU line item within an order
 */
export interface OrderLineItemDetail {
  order_line_id: string;
  line_number: number;
  sku_id: string;
  sku_name: string;
  sku_category: string;
  unit_weight_kg: number;
  quantity: number;
  unit_price_inr: number;
  line_total_inr: number;
}

/**
 * Complete order header and line items from GET /api/v1/orders/{order_id}
 */
export interface OrderDetail {
  order_id: string;
  customer_id: string;
  order_time: string;
  destination_zone_id: string;
  zone_name: string;
  destination_pincode: string;
  destination_city: string;
  destination_state: string;
  destination_region: string;
  requested_service: string;
  order_channel: string;
  order_priority: string;
  order_status: string;
  order_total_inr: number;
  total_lines: number;
  total_units: number;
  lines: OrderLineItemDetail[];
}

/**
 * Shipment record from GET /api/v1/tracking/history/{order_id}
 */
export interface OrderShipmentDetail {
  shipment_id: string;
  order_id: string;
  node_id: string;
  carrier_id: string;
  service_level_id: string;
  delivery_promise_id: string;
  dispatch_date: string;
  promised_delivery_date: string;
  actual_delivery_date: string;
  shipment_status: string;
  is_delayed: number;
  delay_days: number;
  package_line_count: number;
  package_unit_count: number;
}

/**
 * Chronological tracking event record
 */
export interface OrderTrackingEventDetail {
  tracking_event_id: string;
  shipment_id: string;
  order_id: string;
  event_sequence: number;
  event_type: string;
  event_timestamp: string;
  event_location: string;
  event_description: string;
}

/**
 * Delivery outcome record from tracking history
 */
export interface OrderDeliveryOutcomeDetail {
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

/**
 * Tracking history payload from GET /api/v1/tracking/history/{order_id}
 */
export interface OrderTrackingHistoryData {
  order_id: string;
  delivery_outcome: OrderDeliveryOutcomeDetail | null;
  shipments_count: number;
  tracking_events_count: number;
  shipments: OrderShipmentDetail[];
  tracking_events: OrderTrackingEventDetail[];
}

/**
 * Allocation decision record mapping SKU lines to warehouse nodes
 */
export interface OrderAllocationDecisionDetail {
  allocation_id: string;
  order_id: string;
  order_line_id: string;
  node_id: string;
  sku_id: string;
  allocated_qty: number;
  allocation_date: string;
  allocation_type: string;
}

/**
 * Allocation summary from GET /api/v1/allocation/history/{order_id}
 */
export interface OrderAllocationSummaryDetail {
  order_id: string;
  allocation_status: string;
  allocation_type: string;
  allocated_node_count: number;
  total_units: number;
}

/**
 * Allocation history payload from GET /api/v1/allocation/history/{order_id}
 */
export interface OrderAllocationHistoryData {
  summary: OrderAllocationSummaryDetail;
  decisions: OrderAllocationDecisionDetail[];
}
