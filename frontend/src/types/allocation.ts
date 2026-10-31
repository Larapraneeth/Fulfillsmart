/**
 * FulfillSmart Fulfillment Allocation TypeScript Definitions
 * Directly maps to FastAPI backend schemas from src/api/schemas/allocation.py.
 */

export interface AllocationDecisionRecord {
  allocation_id: string;
  order_id: string;
  order_line_id: string;
  node_id: string;
  sku_id: string;
  allocated_qty: number;
  allocation_date: string;
  allocation_type: 'SINGLE_NODE' | 'SPLIT_NODE';
}

export interface AllocationException {
  exception_code: string;
  exception_detail: string;
}

export interface AllocationOutcome {
  order_id: string;
  status: 'ALLOCATED' | 'UNALLOCATED';
  allocation_type: 'SINGLE_NODE' | 'SPLIT_NODE' | 'NONE';
  allocated_node_count: number;
  total_units: number;
  decisions: AllocationDecisionRecord[];
  explanation: string;
  exceptions: AllocationException[];
}

export interface OrderLineRequestPayload {
  order_line_id: string;
  sku_id: string;
  quantity: number;
}

export interface OrderRequestPayload {
  order_id: string;
  customer_id: string;
  order_time: string;
  destination_zone_id: string;
  requested_service: 'STANDARD' | 'EXPRESS' | 'SAME_DAY';
  order_priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  allow_splits: boolean;
  lines: OrderLineRequestPayload[];
}

export interface BatchAllocationRequestPayload {
  orders: OrderRequestPayload[];
  allow_splits?: boolean;
}

export interface ParticipatingNode {
  node_id: string;
  node_name: string;
  city: string;
  state: string;
  allocated_units: number;
  line_count: number;
}

export interface SplitOrderLineDecision {
  allocation_id: string;
  order_line_id: string;
  node_id: string;
  node_name: string;
  city: string;
  sku_id: string;
  sku_name: string;
  allocated_qty: number;
  allocation_date: string;
}

export interface SplitOrderSummary {
  order_id: string;
  order_time: string;
  destination_zone_id: string;
  destination_city: string;
  destination_state: string;
  requested_service: string;
  order_priority: string;
  order_total_inr: number;
  allocated_node_count: number;
  total_units: number;
  line_count: number;
  participating_nodes: ParticipatingNode[];
  decisions: SplitOrderLineDecision[];
}

export interface NodeAllocationSummary {
  node_id: string;
  node_name: string;
  city: string;
  state: string;
  allocated_orders: number;
  allocated_units: number;
  network_volume_share_pct: number;
  order_capacity: number;
  unit_capacity: number;
  order_utilization_pct: number;
  unit_utilization_pct: number;
}

export interface AllocationMetricsSummary {
  total_orders: number;
  allocated_orders: number;
  allocation_success_rate_pct: number;
  single_node_orders: number;
  single_node_rate_pct: number;
  split_node_orders: number;
  split_node_rate_pct: number;
  total_units_allocated: number;
  single_node_units: number;
  split_node_units: number;
  allocation_decisions_count: number;
  sunday_orders_shifted: number;
  warehouse_order_capacity_utilization_pct: number;
  warehouse_unit_capacity_utilization_pct: number;
}

export interface AllocationOverviewData {
  summary: AllocationMetricsSummary;
  split_orders: SplitOrderSummary[];
  node_distribution: NodeAllocationSummary[];
}

export interface AllocationPresetScenario {
  id: string;
  title: string;
  description: string;
  tag: string;
  payload: OrderRequestPayload;
}
